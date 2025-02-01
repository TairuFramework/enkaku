/**
 * HTTP transport for Enkaku RPC clients.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/http-client-transport
 * ```
 *
 * @module http-client-transport
 */

import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ProtocolDefinition,
  TransportMessage,
  TransportMessagePayload,
} from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

const DEFAULT_LIVENESS_CHECK_INTERVAL = 120_000 // 2 mins
const HEADERS = { accept: 'application/json', 'content-type': 'application/json' }

export class ResponseError extends Error {
  #response: Response

  constructor(response: Response) {
    super(`Transport request failed with status ${response.status} (${response.statusText})`)
    this.#response = response
  }

  get response(): Response {
    return this.#response
  }
}

export type EventStreamParams<Protocol extends ProtocolDefinition> = {
  url: string
  onMessage: (msg: AnyServerMessageOf<Protocol> | TransportMessage) => void
  onError: (event: ErrorEvent) => void
}

export type EventStream = {
  id: string
  source: EventSource
}

export async function createEventStream(url: string): Promise<EventStream> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to access event source')
  }

  const data = (await res.json()) as { id: string }
  const sourceURL = new URL(url)
  sourceURL.searchParams.set('id', data.id)
  const source = new EventSource(sourceURL)
  return { id: data.id, source }
}

type EventStreamState =
  | { status: 'idle' }
  | { status: 'connecting'; promise: Promise<EventStream> }
  | {
      status: 'connected'
      stream: EventStream
      active: Set<string>
      lastMessage: number
      timer: NodeJS.Timeout
    }
  | { status: 'error'; error: Error }

export type TransportStreamParams = {
  livenessCheckInterval?: number
  onSourceError: (event: ErrorEvent) => void
  onErrorResponse?: (response: Response) => void
  url: string
}

export type TransportStream<Protocol extends ProtocolDefinition> = ReadableWritablePair<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Protocol>> }

export function createTransportStream<Protocol extends ProtocolDefinition>(
  params: TransportStreamParams,
): TransportStream<Protocol> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Protocol>>()
  const checkInterval = params.livenessCheckInterval ?? DEFAULT_LIVENESS_CHECK_INTERVAL
  let streamState: EventStreamState = { status: 'idle' }

  async function sendMessage(
    msg: AnyClientMessageOf<Protocol> | TransportMessage,
    sessionID?: string,
  ): Promise<Response> {
    const res = await fetch(params.url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
    })
    if (!res.ok) {
      controller.error(new ResponseError(res))
    }
    return res
  }

  async function sendTransportMessage(
    payload: TransportMessagePayload,
    sessionID: string,
  ): Promise<void> {
    const message: TransportMessage = {
      header: { typ: 'JWT', alg: 'none', src: 'transport' },
      payload,
    }
    await sendMessage(message, sessionID)
  }

  // Lazily get the SSE stream:
  // - Only connect if there is a stateful request (channel or stream)
  // - Only create a single SSE connection for all requests
  function getEventStream(): EventStream | Promise<EventStream> {
    switch (streamState.status) {
      case 'idle': {
        const promise = createEventStream(params.url)
        streamState = { status: 'connecting', promise }
        promise
          .then((eventStream) => {
            let lastPing = Date.now()
            const timer = setInterval(() => {
              if (streamState.status !== 'connected') {
                clearInterval(timer)
                return
              }

              const now = Date.now()
              if (now - lastPing > checkInterval) {
                // Server hasn't sent messages since last ping
                streamState.stream.source.close()
                if (streamState.active.size === 0) {
                  // No active procedures using the stream, we can safely close it
                  streamState = { status: 'idle' }
                } else {
                  // The client still has active procedures but the server is not responding, throw error
                  const error = new Error('EventSource connection timed out')
                  streamState = { status: 'error', error }
                  controller.error(error)
                }
                clearInterval(timer)
              } else if (now - streamState.lastMessage > checkInterval) {
                // No message received from server during interval, send a ping message to check the connection is still active
                lastPing = now
                void sendTransportMessage({ type: 'ping' }, streamState.stream.id)
              }
            }, checkInterval)

            streamState = {
              status: 'connected',
              stream: eventStream,
              active: new Set<string>(),
              lastMessage: 0,
              timer,
            }

            eventStream.source.addEventListener('error', (event) => {
              streamState = {
                status: 'error',
                error: new Error('EventSource error', { cause: event }),
              }
            })

            eventStream.source.addEventListener('message', (event) => {
              if (streamState.status !== 'connected') {
                return
              }
              streamState.lastMessage = Date.now()

              const msg = JSON.parse(event.data)
              if (msg.header.src === 'transport') {
                const payload = msg.payload as TransportMessagePayload
                if (payload.type === 'ping') {
                  void sendTransportMessage({ type: 'pong', id: payload.id }, streamState.stream.id)
                }
              } else {
                const message = msg as AnyServerMessageOf<Protocol>
                if (message.payload.typ === 'error' || message.payload.typ === 'result') {
                  // Remove from active procedures
                  streamState.active.delete(message.payload.rid)
                }
                controller.enqueue(message)
              }
            })
          })
          .catch((cause) => {
            streamState = {
              status: 'error',
              error: new Error('EventSource error', { cause }),
            }
          })
        return promise
      }
      case 'connecting':
        return streamState.promise
      case 'connected':
        return streamState.stream
      case 'error':
        throw streamState.error
    }
  }

  async function sendClientMessage(
    msg: AnyClientMessageOf<Protocol>,
    sessionID?: string,
  ): Promise<void> {
    const res = await sendMessage(msg, sessionID)
    if (res.ok && res.status !== 204) {
      res.json().then((msg) => controller.enqueue(msg))
    }
  }

  const writable = new WritableStream<AnyClientMessageOf<Protocol>>({
    async write(msg) {
      if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
        const session = await getEventStream()
        if (streamState.status === 'connected') {
          // Keep track of the active procedure
          streamState.active.add(msg.payload.rid)
        }
        await sendClientMessage(msg, session.id)
      } else {
        if (
          msg.payload.typ === 'abort' &&
          msg.payload.rsn !== 'Close' &&
          streamState.status === 'connected'
        ) {
          // Remove from active procedures
          streamState.active.delete(msg.payload.rid)
        }
        await sendClientMessage(msg)
      }
    },
    // The transport will call this method when disposing
    async close() {
      // Close the SSE stream if active
      if (streamState.status === 'connecting') {
        const eventStream = await streamState.promise
        eventStream.source.close()
      } else if (streamState.status === 'connected') {
        clearInterval(streamState.timer)
        streamState.stream.source.close()
      }
    },
  })

  return { controller, readable, writable }
}

export type ClientTransportParams = {
  url: string
  onErrorResponse?: (response: Response) => void
}

export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: ClientTransportParams) {
    super({
      stream: createTransportStream<Protocol>({
        ...params,
        onSourceError: () => {
          this.dispose()
        },
      }),
    })
  }
}
