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
  EncryptionPolicy,
  ProcedureAccessConfig,
  ProcedureAccessRecord,
  ProcedureAccessValue,
} from './access-control.js'
export {
  createResourceLimiter,
  DEFAULT_RESOURCE_LIMITS,
  type ResourceLimiter,
  type ResourceLimits,
} from './limits.js'
export { type ServeParams, Server, type ServerParams, serve } from './server.js'
export type {
  ChannelHandler,
  ChannelHandlerContext,
  EventHandler,
  EventHandlerContext,
  HandlerReturn,
  ProcedureHandlers,
  RequestHandler,
  RequestHandlerContext,
  ServerEmitter,
  ServerEvents,
  StreamHandler,
  StreamHandlerContext,
} from './types.js'
