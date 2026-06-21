import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { fromUTF, toB64U } from '@sozai/codec'

const TOPIC_INFO_PREFIX = 'enkaku/topic/v1'
const SEP = '\0'
const TOPIC_ID_BYTES = 32

function encodeEpoch(epoch: number): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(epoch), true)
  return bytes
}

/**
 * Derive an opaque, secret-gated, epoch-rotating topic ID.
 *
 * `secret` is any keying material, `epoch` a rotation counter, `label` a
 * channel name, `scope` an optional subgroup/target discriminator. NUL
 * separators make the `label`/`scope` boundary unambiguous.
 */
export function deriveTopicID(
  secret: Uint8Array,
  epoch: number,
  label: string,
  scope = '',
): string {
  const info = fromUTF(`${TOPIC_INFO_PREFIX}${SEP}${label}${SEP}${scope}`)
  const okm = hkdf(sha256, secret, encodeEpoch(epoch), info, TOPIC_ID_BYTES)
  return toB64U(okm)
}
