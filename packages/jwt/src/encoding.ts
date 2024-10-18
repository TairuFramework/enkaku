import serialize from 'canonicalize'

export function serializeJSON(data: unknown): string {
  // @ts-ignore bad definition
  return serialize(data) as string
}

// Adapted from https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem

export function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (m) => m.codePointAt(0) as number)
}

export function bytesToBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(''))
}

export function base64URLToBytes(base64url: string) {
  return base64ToBytes(base64url.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''))
}

export function bytesToBase64URL(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function stringToBase64URL(value: string): string {
  return bytesToBase64URL(stringToBytes(value))
}

export function base64URLToString(base64url: string): string {
  return bytesToString(base64URLToBytes(base64url))
}

export function parseJSON<T = Record<string, unknown>>(base64url: string): T {
  return JSON.parse(base64URLToString(base64url))
}

export function stringifyJSON(value: Record<string, unknown>): string {
  return stringToBase64URL(serializeJSON(value))
}
