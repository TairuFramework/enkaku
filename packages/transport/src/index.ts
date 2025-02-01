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

import { Disposer } from '@enkaku/async'
import { EventEmitter } from '@enkaku/event'
import { createConnection } from '@enkaku/stream'

export type TransportStream<R, W> = ReadableWritablePair<R, W> | Promise<ReadableWritablePair<R, W>>

export type TransportInput<R, W> = TransportStream<R, W> | (() => TransportStream<R, W>)

export type TransportEvents = {
  writeFailed: { error: Error; rid: string }
}

/**
 * Generic Transport object type implementing read and write functions.
 */
export type TransportType<R, W> = Disposer & {
  [Symbol.asyncIterator](): AsyncIterator<R, R | null>
  get events(): EventEmitter<TransportEvents>
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
export class Transport<R, W> extends Disposer implements TransportType<R, W> {
  #events: EventEmitter<TransportEvents>
  #params: TransportParams<R, W>
  #reader: Promise<ReadableStreamDefaultReader<R>> | undefined
  #stream: Promise<ReadableWritablePair<R, W>> | undefined
  #writer: Promise<WritableStreamDefaultWriter<W>> | undefined

  constructor(params: TransportParams<R, W>) {
    super()
    this.#events = new EventEmitter<TransportEvents>()
    this.#params = params
  }

  get events(): EventEmitter<TransportEvents> {
    return this.#events
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

  async _dispose(): Promise<void> {
    if (this.#stream != null) {
      const writer = await this.#getWriter()
      await writer.close()
    }
  }

  getWritable(): WritableStream<W> {
    return new WritableStream({ write: async (value) => await this.write(value) })
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
 * Create direct Transports for communication between a client and server in the same process.
 */
export class DirectTransports<ToClient, ToServer> extends Disposer {
  #client: TransportType<ToClient, ToServer>
  #server: TransportType<ToServer, ToClient>

  constructor(options: DirectTransportsOptions = {}) {
    super(options)
    const [serverStream, clientStream] = createConnection<ToClient, ToServer>()
    this.#client = new Transport({ stream: clientStream })
    this.#server = new Transport({ stream: serverStream })
  }

  async _dispose(): Promise<void> {
    await Promise.all([this.#client.dispose(), this.#server.dispose()])
  }

  get client(): TransportType<ToClient, ToServer> {
    return this.#client
  }

  get server(): TransportType<ToServer, ToClient> {
    return this.#server
  }
}
