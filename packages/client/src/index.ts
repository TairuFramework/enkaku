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

export { Client } from './client.js'
export type {
  CallChannelReturn,
  CallReturn,
  CallStreamReturn,
  ChannelDefinitionsType,
  ClientDefinitionsType,
  ClientParams,
  EventDefinitionsType,
  ProcedureCall,
  RequestDefinitionsType,
  StreamDefinitionsType,
} from './client.js'
export { ABORTED } from './constants.js'
