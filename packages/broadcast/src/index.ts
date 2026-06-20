/**
 * Generic fan-out broadcast primitives for Enkaku RPC.
 *
 * @module broadcast
 */

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
export { defineGroupProtocol, type GroupProtocolDefinition } from './protocol.js'
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
  type Unwrap,
  type UnwrapResult,
} from './transport.js'
export { defaultJitter, defaultRandomID, defaultSleep, isSuppressible } from './utils.js'
