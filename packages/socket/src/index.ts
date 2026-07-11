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

const DEFAULT_HIGH_WATER_MARK = 1_048_576 // 1 MiB

export type CreateTransportStreamOptions<R> = FromJSONLinesOptions<R> & {
  /** Bytes to buffer before pausing the socket / awaiting drain. Defaults to 1 MiB. */
  highWaterMark?: number
}

/**
 * Resolve when the socket drains. Reject if it closes or errors first, so a
 * write can never hang on a drain event that will never arrive.
 */
function waitForDrain(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    function cleanup(): void {
      socket.off('drain', onDrain)
      socket.off('close', onClose)
      socket.off('error', onError)
    }
    function onDrain(): void {
      cleanup()
      resolve()
    }
    function onClose(): void {
      cleanup()
      reject(new Error('Socket closed while draining'))
    }
    function onError(err: Error): void {
      cleanup()
      reject(err)
    }
    socket.on('drain', onDrain)
    socket.on('close', onClose)
    socket.on('error', onError)
  })
}

export async function createTransportStream<R, W>(
  source: SocketSource,
  options?: CreateTransportStreamOptions<R>,
): Promise<ReadableWritablePair<R, W>> {
  const socket = await Promise.resolve(typeof source === 'function' ? source() : source)
  const { highWaterMark = DEFAULT_HIGH_WATER_MARK, ...jsonOptions } = options ?? {}

  // Attached once and never removed. A socket with zero 'error' listeners
  // escalates any late error (a write on a destroyed socket, an EPIPE) to an
  // uncaught exception, which takes the process down.
  let socketError: Error | null = null
  socket.on('error', (err: Error) => {
    socketError = err
  })

  const readable = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let settled = false
        function onData(buffer: Buffer): void {
          if (settled) {
            return
          }
          controller.enqueue(buffer)
          if ((controller.desiredSize ?? 0) <= 0) {
            socket.pause()
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
      pull() {
        // The consumer drained below the high-water mark — let data flow again.
        socket.resume()
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark }),
  ).pipeThrough(fromJSONLines<R>(jsonOptions))

  const writable = writeTo<W>(
    async (msg) => {
      if (socketError != null) {
        throw socketError
      }
      if (socket.destroyed || socket.writableEnded) {
        throw new Error('Socket is closed')
      }
      if (!socket.write(`${JSON.stringify(msg)}\n`)) {
        // Returning a promise makes WritableStream apply backpressure upstream.
        await waitForDrain(socket)
      }
    },
    () => {
      socket.end()
      // Release the half-closed socket so it stops holding the event loop open
      socket.unref()
    },
  )

  return { readable, writable }
}

export type SocketTransportParams<R> = CreateTransportStreamOptions<R> & {
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
