/**
 * Enkaku RPC using Electron IPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/electron
 * ```
 *
 * @module electron-rpc
 */

export { isAllowedSenderURL, type SenderURLAllowlist } from './allowlist.js'
export type { PortHandler, PortInput, PortOrPromise, ServeProcessParams } from './main.js'
export {
  createMainTransportStream,
  type HandleProcessPortOptions,
  handleProcessPort,
  serveProcess,
} from './main.js'
export {
  createRendererClient,
  createRendererTransportStream,
  type RendererClientOptions,
} from './renderer.js'
export type { CreateProcess, MessageFunc } from './types.js'
