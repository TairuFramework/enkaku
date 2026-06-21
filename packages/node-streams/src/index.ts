/**
 * Node streams transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/node-streams
 * ```
 *
 * @module node-streams-transport
 */

import { Readable, Writable } from 'node:stream'
import { Transport } from '@enkaku/transport'
import { createPipe, type FromJSONLinesOptions, fromJSONLines, toJSONLines } from '@sozai/stream'

export type Streams = { readable: Readable; writable: Writable }
export type StreamsOrPromise = Streams | Promise<Streams>
export type StreamsSource = StreamsOrPromise | (() => StreamsOrPromise)

export type CreateTransportStreamOptions<R = unknown> = FromJSONLinesOptions<R> & {
  onWriteError?: (error: Error) => void
}

export async function createTransportStream<R, W>(
  source: StreamsSource,
  options: CreateTransportStreamOptions<R> = {},
): Promise<ReadableWritablePair<R, W>> {
  const { onWriteError, ...streamOptions } = options
  const streams = await Promise.resolve(typeof source === 'function' ? source() : source)

  const input = Readable.toWeb(streams.readable) as ReadableStream<Uint8Array | string>
  const readable = input.pipeThrough(fromJSONLines<R>(streamOptions))

  const pipe = createPipe<W>()
  pipe.readable
    .pipeThrough(toJSONLines())
    .pipeTo(Writable.toWeb(streams.writable))
    .catch((cause) => {
      onWriteError?.(cause instanceof Error ? cause : new Error(String(cause)))
    })

  return { readable, writable: pipe.writable }
}

export type NodeStreamsTransportParams<R = unknown> = FromJSONLinesOptions<R> & {
  streams: StreamsSource
  signal?: AbortSignal
}

export class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: NodeStreamsTransportParams<R>) {
    const { streams, signal, ...streamOptions } = params
    super({
      stream: () =>
        createTransportStream<R, W>(streams, {
          ...streamOptions,
          onWriteError: (error) => {
            this.events.emit('writeFailed', { error })
          },
        }),
      signal,
    })
  }
}
