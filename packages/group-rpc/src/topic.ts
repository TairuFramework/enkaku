import { deriveTopicID } from '@enkaku/broadcast'
import { fromUTF, toB64U } from '@enkaku/codec'
import { sha256 } from '@noble/hashes/sha2.js'

/** Reserved label for per-member unicast inbox topics. */
export const INBOX_LABEL = 'enkaku/inbox/v1'

const DISCOVERY_PREFIX = 'enkaku/discovery/v1'
const SEP = '\0'

/**
 * Group-scoped broadcast/multicast topic for an application protocol. Opaque to
 * the hub; derivable only by members holding the epoch secret. `scope`
 * discriminates a subgroup (e.g. an ephemeral room) sharing the protocol.
 */
export function protocolTopic(
  secret: Uint8Array,
  epoch: number,
  protocol: string,
  scope = '',
): string {
  return deriveTopicID(secret, epoch, protocol, scope)
}

/**
 * Group-scoped personal inbox topic for unicast/directed RPC to `memberDID`.
 * Opaque; derivable only by fellow members. Uses the reserved {@link INBOX_LABEL}
 * so it never collides with an application protocol of the same name.
 */
export function inboxTopic(secret: Uint8Array, epoch: number, memberDID: string): string {
  return deriveTopicID(secret, epoch, INBOX_LABEL, memberDID)
}

/**
 * Public, secretless pre-group rendezvous topic (invite / keypackage / Welcome).
 * `b64url(SHA-256(DISCOVERY_PREFIX ‖ SEP ‖ memberDID))` — intentionally
 * enumerable from the DID alone; the published domain-separation tag makes it
 * nothing-up-my-sleeve.
 */
export function discoveryTopic(memberDID: string): string {
  return toB64U(sha256(fromUTF(`${DISCOVERY_PREFIX}${SEP}${memberDID}`)))
}
