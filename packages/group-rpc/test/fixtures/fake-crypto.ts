import type { Unwrap } from '@enkaku/broadcast'
import { fromUTF, toUTF } from '@enkaku/codec'

import type { GroupCrypto } from '../../src/crypto.js'

export type FakeCryptoOptions = {
  epoch?: number
  secret?: Uint8Array
  /** XOR key byte. Must be non-zero to be observable. Shared by all members. */
  key?: number
  /** The local member DID stamped into every wrapped message. */
  localDID?: string
}

export type FakeCrypto = GroupCrypto & { setEpoch: (n: number) => void }

/**
 * Deterministic GroupCrypto for tests. `wrap` frames `[didLen][localDID][payload]`
 * then XORs; `unwrap` reverses it and returns the recovered `localDID` as
 * `senderDID` — modelling MLS authenticating the sender from the ciphertext.
 * NOT real encryption. All members in a test share `key` so they can decrypt
 * each other; different keys model different groups.
 */
export function createFakeCrypto(options: FakeCryptoOptions = {}): FakeCrypto {
  let epoch = options.epoch ?? 1
  const secret = options.secret ?? new Uint8Array(32).fill(0xab)
  const key = options.key ?? 0x5a
  const localDID = options.localDID ?? ''

  const xor = (bytes: Uint8Array): Uint8Array => {
    const out = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key
    return out
  }

  const wrap: GroupCrypto['wrap'] = (bytes) => {
    const did = fromUTF(localDID)
    const framed = new Uint8Array(2 + did.length + bytes.length)
    new DataView(framed.buffer).setUint16(0, did.length, true)
    framed.set(did, 2)
    framed.set(bytes, 2 + did.length)
    return xor(framed)
  }

  const unwrap: Unwrap = (bytes) => {
    const framed = xor(bytes)
    const didLen = new DataView(framed.buffer, framed.byteOffset, framed.byteLength).getUint16(
      0,
      true,
    )
    const senderDID = toUTF(framed.subarray(2, 2 + didLen))
    const payload = framed.subarray(2 + didLen)
    return { payload, senderDID }
  }

  return {
    epoch: () => epoch,
    exportSecret: () => secret,
    wrap,
    unwrap,
    setEpoch: (n) => {
      epoch = n
    },
  }
}
