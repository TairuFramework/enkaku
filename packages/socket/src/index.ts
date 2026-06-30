/**
 * Socket transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/socket
 * ```
 *
 * @module socket
 */

import { createConnection, type Socket } from 'node:net'
import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '@enkaku/otel'
import { Transport } from '@enkaku/transport'
import { AttributeKeys, withSpan } from '@sozai/otel'
import { type FromJSONLinesOptions, fromJSONLines, writeTo } from '@sozai/stream'

const tracer = createTracer('transport.socket')

export type SocketOrPromise = Socket | Promise<Socket>
export type SocketSource = SocketOrPromise | (() => SocketOrPromise)

export async function connectSocket(path: string): Promise<Socket> {
  return withSpan(
    tracer,
    EnkakuSpanNames.TRANSPORT_SOCKET_CONNECT,
    {
      attributes: {
        [EnkakuAttributeKeys.TRANSPORT_TYPE]: 'socket',
        [AttributeKeys.NET_PEER_NAME]: path,
      },
    },
    async () => {
      const socket = createConnection(path)
      return new Promise<Socket>((resolve, reject) => {
        socket.on('connect', () => resolve(socket))
        socket.on('error', (err) => reject(err))
      })
    },
  )
}

export async function createTransportStream<R, W>(
  source: SocketSource,
  options?: FromJSONLinesOptions<R>,
): Promise<ReadableWritablePair<R, W>> {
  const socket = await Promise.resolve(typeof source === 'function' ? source() : source)

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false
      function onData(buffer: Buffer): void {
        if (!settled) {
          controller.enqueue(buffer)
        }
      }
      function onClose(): void {
        if (settled) {
          return
        }
        settled = true
        detach()
        try {
          controller.close()
        } catch {
          // Controller already closed or errored
        }
      }
      function onError(err: Error): void {
        if (settled) {
          return
        }
        settled = true
        detach()
        controller.error(err)
      }
      function detach(): void {
        socket.off('data', onData)
        socket.off('close', onClose)
        socket.off('error', onError)
      }
      socket.on('data', onData)
      socket.on('close', onClose)
      socket.on('error', onError)
    },
  }).pipeThrough(fromJSONLines<R>(options))

  const writable = writeTo<W>(
    (msg) => {
      socket.write(`${JSON.stringify(msg)}\n`)
    },
    () => {
      socket.end()
      // Release the half-closed socket so it stops holding the event loop open
      socket.unref()
    },
  )

  return { readable, writable }
}

export type SocketTransportParams<R> = FromJSONLinesOptions<R> & {
  socket: SocketSource | string
  signal?: AbortSignal
}

export class SocketTransport<R, W> extends Transport<R, W> {
  constructor(params: SocketTransportParams<R>) {
    const { socket, signal, ...options } = params
    const source = typeof socket === 'string' ? connectSocket(socket) : socket
    super({ stream: () => createTransportStream(source, options), signal })
    // Release the socket on dispose
    if (typeof source !== 'function') {
      this.events.on('disposed', async () => {
        try {
          const sock = await source
          sock.unref()
        } catch {
          // Socket failed to connect or is already gone; nothing to release
        }
      })
    }
  }
}
