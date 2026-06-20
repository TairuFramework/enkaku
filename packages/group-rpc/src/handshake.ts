/**
 * Framing for the raw MLS-handshake lane. Unlike application protocols, this
 * lane carries un-`wrap`ped bytes on a single non-rotating topic and multiplexes
 * three message kinds. Each frame is self-identifying:
 *
 *   [ MAGIC(2) | VERSION(1) | KIND(1) | payload... ]
 *
 * The magic marks the bytes as a handshake frame (fail-fast on garbage or a
 * mis-routed payload); the version allows the wire format to evolve without an
 * ambiguous unversioned migration; the kind discriminates the three messages.
 */

/** Leading marker identifying a handshake frame ("EK"). */
export const HANDSHAKE_MAGIC = Uint8Array.from([0x45, 0x4b])

/** Current handshake wire-format version. */
export const HANDSHAKE_VERSION = 1

const HEADER_LENGTH = HANDSHAKE_MAGIC.length + 2

/** The message kinds carried on the handshake lane. */
export const HANDSHAKE_KIND = {
  /** An MLS Commit fanned out to advance every member's epoch. */
  commit: 0,
  /** A stranded peer asking the group for current state. */
  recoveryRequest: 1,
  /** A member's reply carrying the state needed to re-sync. */
  recoveryReply: 2,
} as const

export type HandshakeKind = (typeof HANDSHAKE_KIND)[keyof typeof HANDSHAKE_KIND]

const KINDS = new Set<number>(Object.values(HANDSHAKE_KIND))

function isHandshakeKind(value: number): value is HandshakeKind {
  return KINDS.has(value)
}

/** Wrap a payload with the magic + version + kind header. */
export function encodeHandshakeFrame(kind: HandshakeKind, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(HEADER_LENGTH + payload.length)
  frame.set(HANDSHAKE_MAGIC, 0)
  frame[HANDSHAKE_MAGIC.length] = HANDSHAKE_VERSION
  frame[HANDSHAKE_MAGIC.length + 1] = kind
  frame.set(payload, HEADER_LENGTH)
  return frame
}

/**
 * Validate the header and split a frame into its kind and payload. Throws on a
 * short frame, a bad magic, an unsupported version, or an unknown kind.
 */
export function decodeHandshakeFrame(frame: Uint8Array): {
  kind: HandshakeKind
  payload: Uint8Array
} {
  if (frame.length < HEADER_LENGTH) {
    throw new Error('handshake frame is too short')
  }
  if (frame[0] !== HANDSHAKE_MAGIC[0] || frame[1] !== HANDSHAKE_MAGIC[1]) {
    throw new Error('handshake frame has a bad magic')
  }
  const version = frame[HANDSHAKE_MAGIC.length]
  if (version !== HANDSHAKE_VERSION) {
    throw new Error(`unsupported handshake version: ${version}`)
  }
  const kind = frame[HANDSHAKE_MAGIC.length + 1]
  if (!isHandshakeKind(kind)) {
    throw new Error(`unknown handshake kind: ${kind}`)
  }
  return { kind, payload: frame.subarray(HEADER_LENGTH) }
}
