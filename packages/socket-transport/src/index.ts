/**
 * Socket transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/socket-transport
 * ```
 *
 * @module socket-transport
 */

import { createConnection, type Socket } from 'node:net'
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { type FromJSONLinesOptions, fromJSONLines, writeTo } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.socket')

export type SocketOrPromise = Socket | Promise<Socket>
export type SocketSource = SocketOrPromise | (() => SocketOrPromise)

export async function connectSocket(path: string): Promise<Socket> {
  const span = tracer.startSpan(SpanNames.TRANSPORT_WS_CONNECT, {
    attributes: { [AttributeKeys.TRANSPORT_TYPE]: 'socket', 'net.peer.name': path },
  })
  const socket = createConnection(path)
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
      resolve(socket)
    })
    socket.on('error', (err) => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
      span.recordException(err)
      span.end()
      reject(err)
    })
  })
}

export async function createTransportStream<R, W>(
  source: SocketSource,
  options?: FromJSONLinesOptions<R>,
): Promise<ReadableWritablePair<R, W>> {
  const socket = await Promise.resolve(typeof source === 'function' ? source() : source)

  const readable = new ReadableStream({
    start(controller) {
      socket.on('data', (buffer) => {
        controller.enqueue(buffer.toString())
      })
      socket.on('close', () => controller.close())
      socket.on('error', (err) => controller.error(err))
    },
  }).pipeThrough(fromJSONLines<R>(options))

  const writable = writeTo<W>(
    (msg) => {
      socket.write(`${JSON.stringify(msg)}\n`)
    },
    () => {
      socket.end()
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
  }
}
