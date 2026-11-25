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
  AnyRequestArguments,
  ChannelCall,
  ChannelDefinitionsType,
  ClientDefinitionsType,
  ClientParams,
  EventDefinitionsType,
  RequestCall,
  RequestDefinitionsType,
  RequestOptions,
  StreamCall,
  StreamDefinitionsType,
} from './client.js'
export { Client } from './client.js'
export {
  type ErrorObjectType,
  RequestError,
  type RequestErrorParams,
  RequestTimeoutError,
} from './error.js'
export type { ClientEmitter, ClientEvents, ClientRequestStatus } from './events.js'
