/**
 * Generic fan-out broadcast primitives for Enkaku RPC.
 *
 * @module broadcast
 */

export const PACKAGE_NAME = '@enkaku/broadcast'

export { type BroadcastBus, createMemoryBus } from './bus.js'
export {
  BroadcastClient,
  type BroadcastClientParams,
  type GatheredReply,
  type GatherOptions,
  type ReplyData,
  type RequestData,
  type RequestOptions,
} from './client.js'
export {
  type BroadcastHandler,
  type BroadcastResponderParams,
  createBroadcastResponder,
  type SuppressConfig,
  type SuppressibleHandler,
  suppressible,
} from './responder.js'
export { deriveTopicID } from './topic.js'
export {
  type BroadcastMessage,
  type BroadcastTransportParams,
  type ByteTransform,
  createBroadcastTransport,
} from './transport.js'
