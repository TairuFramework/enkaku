/**
 * Enkaku RPC client for React.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/react
 * ```
 *
 * @module react
 */

export { EnkakuProvider, useEnkakuClient } from './context.js'
export { useSendEvent } from './event.js'
export { useRequest, useRequestResult, useSendRequest } from './request.js'
export { useCreateStream, useReceiveAll, useReceiveLatest } from './stream.js'
