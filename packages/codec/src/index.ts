import serialize from 'canonicalize'

export function canonicalStringify(value: unknown): string {
  // @ts-ignore TS definition
  return serialize(value)
}

// Adapted from https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem

export function fromB64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (m) => m.codePointAt(0) as number)
}

export function fromB64U(base64url: string) {
  return fromB64(base64url.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''))
}

export function toB64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(''))
}

export function toB64U(bytes: Uint8Array) {
  return toB64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function fromUTF(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function toUTF(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function b64uFromUTF(value: string): string {
  return toB64U(fromUTF(value))
}

export function b64uFromJSON(value: Record<string, unknown>, canonicalize = true): string {
  return b64uFromUTF(canonicalize ? canonicalStringify(value) : JSON.stringify(value))
}

export function b64uToUTF(base64url: string): string {
  return toUTF(fromB64U(base64url))
}

export function b64uToJSON<T = Record<string, unknown>>(base64url: string): T {
  return JSON.parse(b64uToUTF(base64url))
}
