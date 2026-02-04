import { fromB64, toB64 } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'

export { fromB64 as decodePrivateKey, toB64 as encodePrivateKey }

/**
 * Generate a random private key.
 */
export const randomPrivateKey = ed25519.utils.randomSecretKey
