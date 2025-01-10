/**
 * Node streams transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/node-streams-transport
 * ```
 *
 * @module node-streams-transport
 */

import { Readable, Writable } from 'node:stream'
import { createPipe, fromJSONLines, toJSONLines } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

export type Streams = { readable: Readable; writable: Writable }
export type StreamsOrPromise = Streams | Promise<Streams>
export type StreamsSource = StreamsOrPromise | (() => StreamsOrPromise)

export async function createTransportStream<R, W>(
  source: StreamsSource,
): Promise<ReadableWritablePair<R, W>> {
  const streams = await Promise.resolve(typeof source === 'function' ? source() : source)

  const input = Readable.toWeb(streams.readable) as ReadableStream<Uint8Array | string>
  const readable = input.pipeThrough(fromJSONLines<R>())

  const pipe = createPipe<W>()
  pipe.readable.pipeThrough(toJSONLines()).pipeTo(Writable.toWeb(streams.writable))

  return { readable, writable: pipe.writable }
}

export type NodeStreamsTransportParams = {
  streams: StreamsSource
  signal?: AbortSignal
}

export class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: NodeStreamsTransportParams) {
    super({ stream: () => createTransportStream(params.streams), signal: params.signal })
  }
}
