/**
 * Server logic for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/server
 * ```
 *
 * ## Replay protection
 *
 * Authenticated servers reject replayed signed messages (`EK09`) via a pluggable
 * {@link ReplayCache}, configured with the `replay?: {@link ReplayOptions}` server
 * option. See the dedicated guide for the threat model, configuration, custom
 * caches, and security considerations:
 * `docs/capabilities/domains/replay-protection.md`.
 *
 * @module server
 */

export type {
  AccessRule,
  AccessRules,
  AllowContext,
  AllowPredicate,
  EncryptionPolicy,
} from './access-control.js'
export { resolveEncryptionPolicy } from './access-control.js'
export {
  HandlerError,
  type HandlerErrorParams,
} from './error.js'
export {
  createResourceLimiter,
  DEFAULT_RESOURCE_LIMITS,
  type ResourceLimiter,
  type ResourceLimits,
} from './limits.js'
export {
  MemoryReplayCache,
  type ReplayCache,
  type ReplayOptions,
} from './replay.js'
export {
  type ServeParams,
  Server,
  type ServerAccessOptions,
  type ServerBaseParams,
  type ServerParams,
  serve,
} from './server.js'
export type {
  ChannelHandler,
  ChannelHandlerContext,
  EventHandler,
  EventHandlerContext,
  HandlerErrorCategory,
  HandlerErrorMessageType,
  HandlerReturn,
  ProcedureHandlers,
  RequestHandler,
  RequestHandlerContext,
  ServerEmitter,
  ServerEvents,
  StreamHandler,
  StreamHandlerContext,
} from './types.js'
