/**
 * Enkaku RPC client.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/client
 * ```
 *
 * @module client
 */

export {
  Client,
  type ClientParams,
  type InvokeChannelReturn,
  type InvokeReturn,
  type InvokeStreamReturn,
} from './client.js'
export { ABORTED } from './constants.js'
