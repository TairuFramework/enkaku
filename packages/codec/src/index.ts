/**
 * Enkaku codecs.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/codec
 * ```
 *
 * @module codec
 */

import serialize from 'canonicalize'

/** @internal */
export function canonicalStringify(value: unknown): string {
  // @ts-expect-error TS definition
  return serialize(value)
}

// Adapted from https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem

/**
 * Convert a base64-encoded string to a Uint8Array.
 */
export function fromB64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (m) => m.codePointAt(0) as number)
}

/**
 * Convert a base64url-encoded string to a Uint8Array.
 */
export function fromB64U(base64url: string) {
  return fromB64(base64url.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''))
}

/**
 * Convert a Uint8Array to a base64-encoded string.
 */
export function toB64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(''))
}

/**
 * Convert a Uint8Array to a base64url-encoded string.
 */
export function toB64U(bytes: Uint8Array) {
  return toB64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Convert a UTF string to a Uint8Array.
 */
export function fromUTF(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

/**
 * Convert a Uint8Array to a UTF string.
 */
export function toUTF(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * Convert a UTF string to a base64url-encoded string.
 */
export function b64uFromUTF(value: string): string {
  return toB64U(fromUTF(value))
}

/**
 * Convert a JSON object to a base64url-encoded string.
 */
export function b64uFromJSON(value: Record<string, unknown>, canonicalize = true): string {
  return b64uFromUTF(canonicalize ? canonicalStringify(value) : JSON.stringify(value))
}

/**
 * Convert a base64url-encoded string to a UTF string.
 */
export function b64uToUTF(base64url: string): string {
  return toUTF(fromB64U(base64url))
}

const MAX_JSON_DEPTH = 128

function checkJSONDepth(json: string): void {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = 0; i < json.length; i++) {
    const char = json[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{' || char === '[') {
      depth++
      if (depth > MAX_JSON_DEPTH) {
        throw new Error(`JSON exceeds maximum nesting depth of ${MAX_JSON_DEPTH}`)
      }
    } else if (char === '}' || char === ']') {
      depth--
    }
  }
}

/**
 * Convert a base64url-encoded string to a JSON object.
 */
export function b64uToJSON<T = Record<string, unknown>>(base64url: string): T {
  const json = b64uToUTF(base64url)
  checkJSONDepth(json)
  return JSON.parse(json)
}
