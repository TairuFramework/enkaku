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

import { type Socket, createConnection } from 'node:net'
import { type FromJSONLinesOptions, fromJSONLines, writeTo } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

export type SocketOrPromise = Socket | Promise<Socket>
export type SocketSource = SocketOrPromise | (() => SocketOrPromise)

export async function connectSocket(path: string): Promise<Socket> {
  const socket = createConnection(path)
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      resolve(socket)
    })
    socket.on('error', (err) => {
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
