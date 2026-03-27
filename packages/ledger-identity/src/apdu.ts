import { LedgerAppNotOpenError, LedgerError, LedgerUserRejectedError } from './errors.js'

export const CLA = 0xe0

export const INS = {
  GET_APP_VERSION: 0x01,
  GET_PUBLIC_KEY: 0x02,
  SIGN_MESSAGE: 0x03,
  ECDH_X25519: 0x04,
} as const

const HARDENED_BIT = 0x80000000
const MAX_APDU_DATA = 255

export type APDUChunk = {
  p1: number
  p2: number
  data: Uint8Array
}

export function encodeDerivationPath(path: string): Uint8Array {
  const stripped = path.startsWith('m/') ? path.slice(2) : path
  const components = stripped.split('/')

  for (const component of components) {
    if (!component.endsWith("'")) {
      throw new Error(
        `Non-hardened component in path: "${component}" (Ed25519 requires hardened only)`,
      )
    }
  }

  const buf = new Uint8Array(1 + components.length * 4)
  const view = new DataView(buf.buffer)
  buf[0] = components.length

  for (let i = 0; i < components.length; i++) {
    const index = Number.parseInt(components[i].slice(0, -1), 10)
    view.setUint32(1 + i * 4, (index | HARDENED_BIT) >>> 0, false)
  }

  return buf
}

export function encodeSignMessageChunks(
  pathBytes: Uint8Array,
  message: Uint8Array,
): Array<APDUChunk> {
  const chunks: Array<APDUChunk> = []

  // First chunk: derivation path + as much message as fits
  const firstDataCapacity = MAX_APDU_DATA - pathBytes.length
  const firstMessageSlice = message.slice(0, firstDataCapacity)
  const firstData = new Uint8Array(pathBytes.length + firstMessageSlice.length)
  firstData.set(pathBytes)
  firstData.set(firstMessageSlice, pathBytes.length)

  const isOnly = firstMessageSlice.length >= message.length
  // P2: 0x00 = last/only chunk (sign now), 0x80 = more chunks follow
  chunks.push({ p1: 0x00, p2: isOnly ? 0x00 : 0x80, data: firstData })

  // Continuation chunks
  let offset = firstDataCapacity
  while (offset < message.length) {
    const slice = message.slice(offset, offset + MAX_APDU_DATA)
    offset += slice.length
    const isFinal = offset >= message.length
    // P2: 0x00 = last chunk (sign now), 0x80 = more chunks follow
    chunks.push({ p1: 0x80, p2: isFinal ? 0x00 : 0x80, data: slice })
  }

  return chunks
}

export function parsePublicKeyResponse(data: Uint8Array): Uint8Array {
  if (data.length < 32) {
    throw new LedgerError(`Invalid public key response: expected 32 bytes, got ${data.length}`, 0)
  }
  return data.slice(0, 32)
}

export function parseSignatureResponse(data: Uint8Array): Uint8Array {
  if (data.length < 64) {
    throw new LedgerError(`Invalid signature response: expected 64 bytes, got ${data.length}`, 0)
  }
  return data.slice(0, 64)
}

export function parseSharedSecretResponse(data: Uint8Array): Uint8Array {
  if (data.length < 32) {
    throw new LedgerError(
      `Invalid shared secret response: expected 32 bytes, got ${data.length}`,
      0,
    )
  }
  return data.slice(0, 32)
}

export function checkStatusWord(sw: number): void {
  if (sw === 0x9000) return

  switch (sw) {
    case 0x6985:
      throw new LedgerUserRejectedError()
    case 0x6a82:
      throw new LedgerAppNotOpenError()
    case 0x6a80:
      throw new LedgerError('Invalid derivation path', sw)
    case 0x6d00:
      throw new LedgerError('Unknown command', sw)
    case 0x6e00:
      throw new LedgerError('Unknown CLA', sw)
    default:
      throw new LedgerError(`Ledger error: 0x${sw.toString(16).padStart(4, '0')}`, sw)
  }
}
