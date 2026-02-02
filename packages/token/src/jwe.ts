import { sha256 } from '@noble/hashes/sha2.js'

export type ConcatKDFParams = {
  sharedSecret: Uint8Array
  keyLength: number
  algorithmID: string
  partyUInfo: Uint8Array
  partyVInfo: Uint8Array
}

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setUint32(0, value, false)
  return buf
}

function lengthPrefixed(data: Uint8Array): Uint8Array {
  const prefix = uint32BE(data.length)
  const result = new Uint8Array(4 + data.length)
  result.set(prefix)
  result.set(data, 4)
  return result
}

/**
 * Concat KDF per RFC 7518 Section 4.6.2.
 * Single SHA-256 iteration (sufficient for 256-bit keys).
 */
export function concatKDF(params: ConcatKDFParams): Uint8Array {
  const { sharedSecret, keyLength, algorithmID, partyUInfo, partyVInfo } = params
  const encoder = new TextEncoder()

  const algID = lengthPrefixed(encoder.encode(algorithmID))
  const apu = lengthPrefixed(partyUInfo)
  const apv = lengthPrefixed(partyVInfo)
  const keyDataLen = uint32BE(keyLength)

  // round = 1 (single iteration for 256-bit key)
  const round = uint32BE(1)

  // Hash(round || sharedSecret || algID || apu || apv || keyDataLen)
  const parts = [round, sharedSecret, algID, apu, apv, keyDataLen]
  let totalLength = 0
  for (const part of parts) {
    totalLength += part.length
  }
  const hashInput = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    hashInput.set(part, offset)
    offset += part.length
  }

  return sha256(hashInput).slice(0, keyLength / 8)
}
