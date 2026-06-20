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

/** Context delivered alongside a received Commit on the raw handshake lane. */
export type CommitContext = {
  /**
   * The hub-authenticated publisher of the frame. This is the transport sender,
   * NOT the MLS-cryptographic committer (the Commit authenticates its committer
   * internally) — auxiliary information (logging, rate-limiting), not an
   * authorization boundary.
   */
  senderDID?: string
}

/**
 * Consumer-supplied MLS lifecycle port. Sibling to {@link GroupCrypto}: where
 * `GroupCrypto` adapts application encrypt/decrypt, this drives the handshake
 * lane — applying Commits to advance the epoch and re-syncing a stranded peer.
 * group-rpc owns the transport + orchestration (subscribe the non-rotating
 * handshake topic, run these methods, resync when the epoch advances); the
 * consumer owns the MLS state and any storage/atomicity, entirely below this
 * interface.
 */
export type GroupMLS = {
  /**
   * Apply a received Commit to the MLS state and durably persist the result,
   * returning whether the epoch advanced (the signal to resync the app lane).
   * Implementations make this atomic; the orchestration only requires that the
   * write is durable before it resolves.
   */
  processCommit(commit: Uint8Array, context: CommitContext): Promise<{ advanced: boolean }>
  /** Export current group state for a recovery responder to send a stranded peer. */
  exportGroupInfo(): Promise<Uint8Array>
  /** Re-sync from a recovery reply, returning whether the epoch advanced. */
  applyRecovery(groupInfo: Uint8Array): Promise<{ advanced: boolean }>
  /**
   * The epoch-independent secret for the non-rotating handshake/recovery topic.
   * Stable for the group's whole life so a stranded peer on any epoch can always
   * derive the rendezvous.
   */
  exportRecoverySecret(): Uint8Array | Promise<Uint8Array>
}
