import type { Baggage } from '@opentelemetry/api'

import { logger } from './log.js'

export type BaggageProperty = { key: string; value?: string }
export type BaggageEntry = { key: string; value: string; properties?: Array<BaggageProperty> }

// RFC 7230 token characters.
const TOKEN_REGEX = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/

function isToken(key: string): boolean {
  return TOKEN_REGEX.test(key)
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function safeEncode(value: string): string | undefined {
  try {
    return encodeURIComponent(value)
  } catch {
    return undefined
  }
}

/**
 * Format a W3C baggage header value. Percent-encodes values, drops members and
 * properties with invalid (non-token) keys, preserves order. No entry cap.
 * Never throws.
 */
export function formatBaggage(entries: Array<BaggageEntry>): string {
  const out: Array<string> = []
  for (const entry of entries) {
    if (!isToken(entry.key)) {
      logger.warn('dropping invalid baggage member {key}', { key: entry.key })
      continue
    }
    const encodedValue = safeEncode(entry.value)
    if (encodedValue === undefined) {
      logger.warn('dropping baggage member with un-encodable value {key}', { key: entry.key })
      continue
    }
    let member = `${entry.key}=${encodedValue}`
    for (const prop of entry.properties ?? []) {
      if (!isToken(prop.key)) {
        logger.warn('dropping invalid baggage property {key}', { key: prop.key })
        continue
      }
      if (prop.value === undefined) {
        member += `;${prop.key}`
      } else {
        const encodedProp = safeEncode(prop.value)
        if (encodedProp === undefined) {
          logger.warn('dropping baggage property with un-encodable value {key}', { key: prop.key })
          continue
        }
        member += `;${prop.key}=${encodedProp}`
      }
    }
    out.push(member)
  }
  return out.join(',')
}

// Parse `;`-separated W3C property segments into structured properties. Shared by
// parseBaggage (member tail) and baggageToEntries (OTel opaque metadata string).
function parseProperties(segments: Array<string>): Array<BaggageProperty> {
  const properties: Array<BaggageProperty> = []
  for (const raw of segments) {
    const prop = raw.trim()
    if (prop === '') {
      continue
    }
    const pEq = prop.indexOf('=')
    if (pEq === -1) {
      if (!isToken(prop)) {
        continue
      }
      properties.push({ key: prop })
    } else {
      const pKey = prop.slice(0, pEq).trim()
      const pVal = safeDecode(prop.slice(pEq + 1).trim())
      if (!isToken(pKey) || pVal === undefined) {
        continue
      }
      properties.push({ key: pKey, value: pVal })
    }
  }
  return properties
}

/**
 * Parse a W3C baggage header value. Percent-decodes values, drops malformed
 * members and properties (including un-decodable percent sequences), and drops
 * duplicate keys keeping the first *valid* occurrence (a malformed earlier
 * member is dropped and does not reserve its key). Never throws. This function
 * assumes the percent-encoding contract produced by `formatBaggage` — a
 * literal `%` not part of a valid escape causes that member to be dropped.
 */
export function parseBaggage(header: string): Array<BaggageEntry> {
  const entries: Array<BaggageEntry> = []
  const seen = new Set<string>()
  for (const member of header.split(',')) {
    const parts = member.split(';')
    const kv = parts[0].trim()
    if (kv === '') {
      continue
    }
    const eq = kv.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = kv.slice(0, eq).trim()
    const rawValue = kv.slice(eq + 1).trim()
    if (!isToken(key)) {
      continue
    }
    if (seen.has(key)) {
      continue
    }
    const value = safeDecode(rawValue)
    if (value === undefined) {
      continue
    }
    const properties = parseProperties(parts.slice(1))
    const entry: BaggageEntry = { key, value }
    if (properties.length > 0) {
      entry.properties = properties
    }
    seen.add(key)
    entries.push(entry)
  }
  return entries
}

/**
 * Convert an OpenTelemetry `Baggage` into enkaku `BaggageEntry` records. OTel
 * collapses the W3C property tail into one opaque per-entry metadata string; we
 * parse it back into structured `properties` with the same grammar as
 * `parseBaggage`, so the result round-trips losslessly through `formatBaggage`
 * for W3C-conformant baggage. Malformed metadata segments are dropped (same
 * tolerance as `parseBaggage`).
 */
export function baggageToEntries(baggage: Baggage): Array<BaggageEntry> {
  return baggage.getAllEntries().map(([key, e]) => {
    const entry: BaggageEntry = { key, value: e.value }
    if (e.metadata != null) {
      const properties = parseProperties(e.metadata.toString().split(';'))
      if (properties.length > 0) {
        entry.properties = properties
      }
    }
    return entry
  })
}
