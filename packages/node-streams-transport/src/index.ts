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
import { createPipe } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

const SEPARATOR = '\n'

export type Streams = { readable: Readable; writable: Writable }
export type StreamsOrPromise = Streams | Promise<Streams>
export type StreamsSource = StreamsOrPromise | (() => StreamsOrPromise)

export async function createTransportStream<R, W>(
  source: StreamsSource,
): Promise<ReadableWritablePair<R, W>> {
  const decoder = new TextDecoder()
  const streams = await Promise.resolve(typeof source === 'function' ? source() : source)

  let buffered = ''
  const input = Readable.toWeb(streams.readable) as ReadableStream<Uint8Array | string>
  const readable = input.pipeThrough(
    new TransformStream<Uint8Array | string, R>({
      transform: (chunk, controller) => {
        buffered += typeof chunk === 'string' ? chunk : decoder.decode(chunk)
        let index = buffered.indexOf(SEPARATOR)
        while (index !== -1) {
          const value = buffered.slice(0, index)
          if (value !== '') {
            controller.enqueue(JSON.parse(value))
          }
          buffered = buffered.slice(index + SEPARATOR.length)
          index = buffered.indexOf(SEPARATOR)
        }
      },
    }),
  )

  const pipe = createPipe<W>()
  pipe.readable
    .pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          controller.enqueue(JSON.stringify(chunk) + SEPARATOR)
        },
      }),
    )
    .pipeTo(Writable.toWeb(streams.writable))

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
