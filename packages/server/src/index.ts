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

export type { ProcedureAccessRecord } from './access-control.js'
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
