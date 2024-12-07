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

export type { CommandAccessRecord } from './access-control.js'
export { AbortRejection, ErrorRejection, type RejectionType } from './rejections.js'
export { type ServeParams, Server, type ServerParams, serve } from './server.js'
export type {
  ChannelHandler,
  ChannelHandlerContext,
  CommandHandlers,
  EventHandler,
  EventHandlerContext,
  HandlerReturn,
  RequestHandler,
  RequestHandlerContext,
  StreamHandler,
  StreamHandlerContext,
} from './types.js'
