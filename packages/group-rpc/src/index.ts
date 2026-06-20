/**
 * High-level MLS-aware group RPC for Enkaku.
 *
 * @module group-rpc
 */

export { defineGroupProtocol, type GroupProtocolDefinition } from '@enkaku/broadcast'
export type { CommitContext, GroupCrypto, GroupMLS } from './crypto.js'
export {
  decodeHandshakeFrame,
  encodeHandshakeFrame,
  HANDSHAKE_KIND,
  HANDSHAKE_MAGIC,
  HANDSHAKE_VERSION,
  type HandshakeKind,
} from './handshake.js'
export {
  createGroupPeer,
  type GroupPeer,
  type GroupPeerParams,
  type ProtocolSurface,
} from './peer.js'
export { discoveryTopic, INBOX_LABEL, inboxTopic, protocolTopic } from './topic.js'
