/**
 * Server logic for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/server
 * ```
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
