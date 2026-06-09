import { getEnkakuLogger } from '@enkaku/log'

const logger = getEnkakuLogger('otel')

export type TracestateEntry = { key: string; value: string }

const MAX_ENTRIES = 32

// Key: simple-key (lcalpha then up to 255 of lcalpha/DIGIT/_-*/) or
// multi-tenant tenant@system form.
const KEY_REGEX =
  /^[a-z][a-z0-9_\-*/]{0,255}$|^[a-z0-9][a-z0-9_\-*/]{0,240}@[a-z][a-z0-9_\-*/]{0,13}$/
// Value: 1-256 chars from 0x20-0x7E excluding ',' (0x2C) and '=' (0x3D),
// last char must not be a space.
const VALUE_REGEX = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/

function isValidKey(key: string): boolean {
  return KEY_REGEX.test(key)
}

function isValidValue(value: string): boolean {
  return VALUE_REGEX.test(value)
}

/**
 * Format a W3C tracestate header value. Drops members with invalid keys or
 * values, caps at 32 entries, and preserves the given order. Never throws.
 */
export function formatTracestate(entries: Array<TracestateEntry>): string {
  const out: Array<string> = []
  for (const entry of entries) {
    if (!isValidKey(entry.key) || !isValidValue(entry.value)) {
      logger.warn('dropping invalid tracestate member {key}', { key: entry.key })
      continue
    }
    if (out.length >= MAX_ENTRIES) {
      logger.warn('tracestate exceeds 32 entries, dropping {key}', { key: entry.key })
      continue
    }
    out.push(`${entry.key}=${entry.value}`)
  }
  return out.join(',')
}

/**
 * Parse a W3C tracestate header value. Drops malformed members and duplicate
 * keys (keeping the first occurrence), caps at 32 entries. Never throws.
 */
export function parseTracestate(header: string): Array<TracestateEntry> {
  const entries: Array<TracestateEntry> = []
  const seen = new Set<string>()
  for (const member of header.split(',')) {
    const trimmed = member.trim()
    if (trimmed === '') {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (!isValidKey(key) || !isValidValue(value)) {
      continue
    }
    if (seen.has(key)) {
      continue
    }
    if (entries.length >= MAX_ENTRIES) {
      break
    }
    seen.add(key)
    entries.push({ key, value })
  }
  return entries
}
