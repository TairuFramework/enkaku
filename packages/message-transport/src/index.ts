/**
 * MessagePort transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/message-transport
 * ```
 *
 * @module message-transport
 */

import { Transport } from '@enkaku/transport'

export type PortOrPromise = MessagePort | Promise<MessagePort>
export type PortSource = PortOrPromise | (() => PortOrPromise)

export async function createTransportStream<R, W>(
  source: PortSource,
): Promise<ReadableWritablePair<R, W>> {
  const port = await Promise.resolve(typeof source === 'function' ? source() : source)

  const readable = new ReadableStream({
    start(controller) {
      port.onmessage = (msg) => {
        controller.enqueue(msg.data)
      }
      port.start()
    },
  })

  const writable = new WritableStream({
    write(msg) {
      port.postMessage(msg)
    },
  })

  return { readable, writable }
}

export type MessageTransportParams = {
  port: PortSource
  signal?: AbortSignal
}

export class MessageTransport<R, W> extends Transport<R, W> {
  constructor(params: MessageTransportParams) {
    super({ stream: () => createTransportStream(params.port), signal: params.signal })
  }
}
