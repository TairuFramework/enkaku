import type { ByteTransform, Unwrap } from '@enkaku/broadcast'

/**
 * Consumer-supplied MLS crypto port. The consumer adapts its live MLS group into
 * this shape (epoch number, an epoch-bound topic-derivation secret, byte-level
 * encrypt via `wrap`, and decrypt-plus-recover-sender via `unwrap`). group-rpc
 * never imports MLS.
 *
 * `epoch()` and `exportSecret()` are read on init and on every
 * {@link "peer".GroupPeer.resync}. `wrap`/`unwrap` close over the live group, so
 * they always use current epoch state. `unwrap` returns the authenticated
 * sender (`senderDID`) recovered from the ciphertext.
 */
export type GroupCrypto = {
  epoch(): number
  exportSecret(): Uint8Array | Promise<Uint8Array>
  wrap: ByteTransform
  unwrap: Unwrap
}
