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

export type {
  ChannelCall,
  ChannelDefinitionsType,
  ClientDefinitionsType,
  ClientParams,
  EventDefinitionsType,
  RequestCall,
  RequestDefinitionsType,
  StreamCall,
  StreamDefinitionsType,
} from './client.js'
export { Client } from './client.js'
export { type ErrorObjectType, RequestError, type RequestErrorParams } from './error.js'
