/**
 * Generic transport for Enkaku RPC clients and servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/transport
 * ```
 *
 * @module transport
 */

import { type Disposer, createDisposer } from '@enkaku/async'
import { createConnection } from '@enkaku/stream'

export type TransportStream<R, W> = ReadableWritablePair<R, W> | Promise<ReadableWritablePair<R, W>>

export type TransportInput<R, W> = TransportStream<R, W> | (() => TransportStream<R, W>)

/**
 * Generic Transport object type implementing read and write functions.
 */
export type TransportType<R, W> = Disposer & {
  [Symbol.asyncIterator](): AsyncIterator<R, R | null>
  getWritable: () => WritableStream<W>
  read: () => Promise<ReadableStreamReadResult<R>>
  write: (value: W) => Promise<void>
}

export type TransportParams<R, W> = {
  signal?: AbortSignal
  stream: TransportInput<R, W>
}

/**
 * Base Transport class implementing TransportType.
 */
export class Transport<R, W> implements TransportType<R, W> {
  #disposer: Disposer
  #params: TransportParams<R, W>
  #reader: Promise<ReadableStreamDefaultReader<R>> | undefined
  #stream: Promise<ReadableWritablePair<R, W>> | undefined
  #writer: Promise<WritableStreamDefaultWriter<W>> | undefined

  constructor(params: TransportParams<R, W>) {
    this.#params = params
    this.#disposer = createDisposer(async () => {
      if (this.#stream != null) {
        const writer = await this.#getWriter()
        await writer.close()
      }
    })
  }

  #getStream(): Promise<ReadableWritablePair<R, W>> {
    if (this.#stream == null) {
      const { stream } = this.#params
      this.#stream = Promise.resolve(typeof stream === 'function' ? stream() : stream)
    }
    return this.#stream
  }

  #getReader(): Promise<ReadableStreamDefaultReader<R>> {
    if (this.#reader == null) {
      this.#reader = this.#getStream().then(({ readable }) => {
        return readable.getReader()
      })
    }
    return this.#reader
  }

  #getWriter(): Promise<WritableStreamDefaultWriter<W>> {
    if (this.#writer == null) {
      this.#writer = this.#getStream().then(({ writable }) => {
        return writable.getWriter()
      })
    }
    return this.#writer
  }

  get disposed(): Promise<void> {
    return this.#disposer.disposed
  }

  async dispose() {
    await this.#disposer.dispose()
  }

  getWritable(): WritableStream<W> {
    return new WritableStream({
      write: async (value) => {
        await this.write(value)
      },
    })
  }

  async read(): Promise<ReadableStreamReadResult<R>> {
    const reader = await this.#getReader()
    return await reader.read()
  }

  async write(value: W): Promise<void> {
    const writer = await this.#getWriter()
    await writer.write(value)
  }

  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        const reader = await this.#getReader()
        const next = await reader.read()
        return next.done ? { done: true as const, value: next.value ?? null } : next
      },
    }
  }
}

export type DirectTransportsOptions = {
  signal?: AbortSignal
}

/**
 * Couple of Transports for communication between a client and server in the same process.
 */
export type DirectTransports<ToClient, ToServer> = AsyncDisposable & {
  client: TransportType<ToClient, ToServer>
  server: TransportType<ToServer, ToClient>
  dispose: () => Promise<void>
  disposed: Promise<void>
}

/**
 * Create direct Transports for communication between a client and server in the same process.
 */
export function createDirectTransports<ToClient, ToServer>(
  options: DirectTransportsOptions = {},
): DirectTransports<ToClient, ToServer> {
  const [serverStream, clientStream] = createConnection<ToClient, ToServer>()
  const client = new Transport({ stream: clientStream, signal: options.signal })
  const server = new Transport({ stream: serverStream, signal: options.signal })

  const disposed = Promise.all([client.disposed, server.disposed]).then(() => {})
  let disposing = false
  async function dispose() {
    if (!disposing) {
      disposing = true
      await Promise.all([client.dispose(), server.dispose()])
    }
    return disposed
  }

  return { client, server, dispose, disposed, [Symbol.asyncDispose]: dispose }
}
