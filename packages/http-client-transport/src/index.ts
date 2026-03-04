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
} from '@enkaku/protocol'
import { createReadable, writeTo } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.http')

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

export type EventStream = {
  id: string
  source: EventSource
}

export async function createEventStream(url: string): Promise<EventStream> {
  const span = tracer.startSpan('enkaku.transport.http.sse_connect', {
    attributes: { 'enkaku.transport.type': 'http-sse' },
  })
  let spanEnded = false
  try {
    const res = await fetch(url)
    if (!res.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      span.end()
      spanEnded = true
      throw new ResponseError(res)
    }

    const data = (await res.json()) as { id: string }
    span.setAttribute('enkaku.transport.session_id', data.id)
    const sourceURL = new URL(url)
    sourceURL.searchParams.set('id', data.id)
    const source = new EventSource(sourceURL)

    // Wait for the SSE connection to be established before returning.
    // The server sets the session controller when processing this GET —
    // without waiting, a subsequent POST can arrive before the controller
    // exists, causing a "Invalid request" / "Inactive session" error.
    await new Promise<void>((resolve, reject) => {
      source.addEventListener('open', () => resolve(), { once: true })
      source.addEventListener(
        'error',
        (event) => reject(new Error('EventSource connection failed', { cause: event })),
        { once: true },
      )
    })

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
    return { id: data.id, source }
  } catch (error) {
    if (!spanEnded) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      span.end()
    }
    throw error
  }
}

type EventStreamState =
  | { status: 'idle' }
  | { status: 'connecting'; promise: Promise<EventStream> }
  | { status: 'connected'; stream: EventStream }
  | { status: 'error'; error: Error }

export type TransportStreamParams = {
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
  let streamState: EventStreamState = { status: 'idle' }

  async function sendMessage(
    msg: AnyClientMessageOf<Protocol> | TransportMessage,
    sessionID?: string,
  ): Promise<Response> {
    const span = tracer.startSpan('enkaku.transport.http.request', {
      attributes: {
        'http.method': 'POST',
        'enkaku.transport.type': 'http',
        ...(sessionID != null ? { 'enkaku.transport.session_id': sessionID } : {}),
      },
    })
    try {
      const res = await fetch(params.url, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
      })
      span.setAttribute('http.status_code', res.status)
      if (!res.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
        controller.error(new ResponseError(res))
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      return res
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
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
            streamState = { status: 'connected', stream: eventStream }

            eventStream.source.addEventListener('error', (event) => {
              // Close the EventSource to prevent automatic reconnection —
              // the server deletes the session on disconnect so reconnecting
              // to the same URL would always fail with "Invalid ID".
              eventStream.source.close()
              const error = new Error('EventSource error', { cause: event })
              streamState = { status: 'error', error }
              controller.error(error)
            })

            eventStream.source.addEventListener('message', (event) => {
              if (streamState.status !== 'connected') {
                return
              }
              const message = JSON.parse(event.data) as AnyServerMessageOf<Protocol>
              controller.enqueue(message)
            })
          })
          .catch((cause) => {
            const error = new Error('Failed to create EventSource', { cause })
            streamState = { status: 'error', error }
            controller.error(error)
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

  const writable = writeTo<AnyClientMessageOf<Protocol>>(
    async (msg) => {
      try {
        if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
          const session = await getEventStream()
          await sendClientMessage(msg, session.id)
        } else {
          await sendClientMessage(msg)
        }
      } catch (cause) {
        controller.error(new Error('Transport write failed', { cause }))
      }
    },
    // The transport will call this method when disposing
    async () => {
      // Close the SSE stream if active
      if (streamState.status === 'connecting') {
        const eventStream = await streamState.promise
        eventStream.source.close()
      } else if (streamState.status === 'connected') {
        streamState.stream.source.close()
      }
    },
  )

  return { controller, readable, writable }
}

export type ClientTransportParams = {
  url: string
}

export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream<Protocol>(params) })
  }
}
