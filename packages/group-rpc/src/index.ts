/**
 * High-level MLS-aware group RPC for Enkaku.
 *
 * @module group-rpc
 */

export const PACKAGE_NAME = '@enkaku/group-rpc'

export { defineGroupProtocol, type GroupProtocolDefinition } from '@enkaku/broadcast'
export type { GroupCrypto } from './crypto.js'
export {
  createGroupPeer,
  type GroupPeer,
  type GroupPeerParams,
  type ProtocolSurface,
} from './peer.js'
export { discoveryTopic, INBOX_LABEL, inboxTopic, protocolTopic } from './topic.js'
