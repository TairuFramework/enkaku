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

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

export type ConnectSocketOptions = {
  /** Milliseconds before the connect attempt is abandoned. Defaults to 10_000. `0` disables the timeout. */
  timeoutMs?: number
  /** Aborts a pending connect attempt, destroying the socket. */
  signal?: AbortSignal
}

export async function connectSocket(
  path: string,
  options: ConnectSocketOptions = {},
): Promise<Socket> {
  const { timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS, signal } = options
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
      signal?.throwIfAborted()
      const socket = createConnection(path)
      return new Promise<Socket>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined

        function cleanup(): void {
          if (timer != null) {
            clearTimeout(timer)
          }
          socket.off('connect', onConnect)
          socket.off('error', onError)
          signal?.removeEventListener('abort', onAbort)
        }
        function onConnect(): void {
          cleanup()
          resolve(socket)
        }
        function onError(error: Error): void {
          cleanup()
          reject(error)
        }
        function abandon(reason: unknown): void {
          cleanup()
          // The abandoned attempt may still fail (a late ECONNREFUSED). With no
          // 'error' listener at all, Node escalates that to an uncaught throw.
          socket.on('error', () => {})
          socket.destroy()
          reject(reason)
        }
        function onAbort(): void {
          abandon(signal?.reason ?? new Error('Socket connect aborted'))
        }

        socket.once('connect', onConnect)
        socket.once('error', onError)
        signal?.addEventListener('abort', onAbort, { once: true })

        if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
          timer = setTimeout(() => {
            abandon(new Error(`Socket connect timed out after ${timeoutMs}ms`))
          }, timeoutMs)
          // The timer must not hold the event loop open on its own
          timer.unref()
        }
      })
    },
  )
}

const DEFAULT_HIGH_WATER_MARK = 1_048_576 // 1 MiB
const END_GRACE_MS = 2_000 // Max wait for a half-close to flush before giving up

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
    async () => {
      // Wait for queued writes to actually flush, so a caller that closes the
      // writer (or disposes the transport) does not cut off its own last message.
      await new Promise<void>((resolve) => {
        if (socket.destroyed || socket.writableEnded || socketError != null) {
          resolve()
          return
        }
        // A stalled peer must not hang the close
        const timer = setTimeout(resolve, END_GRACE_MS)
        timer.unref()
        socket.end(() => {
          clearTimeout(timer)
          resolve()
        })
      })
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
