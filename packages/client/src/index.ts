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
  type CallChannelReturn,
  type CallReturn,
  type CallStreamReturn,
  type ProcedureCall,
} from './client.js'
export { ABORTED } from './constants.js'
