/**
 * MessagePort transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/message
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

  let readableController: ReadableStreamDefaultController<R> | undefined
  function shutdown(): void {
    // Detach the message handler first so no enqueue races a closed controller
    port.onmessage = null
    try {
      readableController?.close()
    } catch {
      // Readable already closed or errored
    }
    port.close()
  }

  const readable = new ReadableStream<R>({
    start(controller) {
      readableController = controller
      port.onmessage = (msg) => {
        controller.enqueue(msg.data)
      }
      port.start()
    },
    cancel() {
      port.onmessage = null
      port.close()
    },
  })

  const writable = new WritableStream<W>({
    write(msg) {
      port.postMessage(msg)
    },
    close() {
      shutdown()
    },
    abort() {
      shutdown()
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
