/**
 * Enkaku RPC using Electron IPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/electron-rpc
 * ```
 *
 * @module electron-rpc
 */

export type { PortHandler, PortInput, PortOrPromise, ServeProcessParams } from './main.js'
export { createMainTransportStream, serveProcess } from './main.js'
export {
  createRendererClient,
  createRendererTransportStream,
  type RendererClientOptions,
} from './renderer.js'
export type { CreateProcess, MessageFunc } from './types.js'
