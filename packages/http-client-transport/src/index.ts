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

import {
  AttributeKeys,
  createTracer,
  formatTraceparent,
  getActiveTraceContext,
  SpanNames,
  SpanStatusCode,
  withSpan,
} from '@enkaku/otel'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ProtocolDefinition,
  TransportMessage,
} from '@enkaku/protocol'
import { createReadable, writeTo } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { createParser } from 'eventsource-parser'

const tracer = createTracer('transport.http')

const HEADERS = { accept: 'application/json', 'content-type': 'application/json' }

export type FetchFunction = typeof globalThis.fetch

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

type SSESessionState =
  | { status: 'idle' }
  | { status: 'connecting'; promise: Promise<string> }
  | { status: 'connected'; sessionID: string }
  | { status: 'error'; error: Error }

export type TransportStreamParams = {
  url: string
  fetch?: FetchFunction
}

export type TransportStream<Protocol extends ProtocolDefinition> = ReadableWritablePair<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Protocol>> }

export function createTransportStream<Protocol extends ProtocolDefinition>(
  params: TransportStreamParams,
): TransportStream<Protocol> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Protocol>>()
  let sessionState: SSESessionState = { status: 'idle' }
  const abortController = new AbortController()
  const fetchFn = params.fetch ?? globalThis.fetch

  async function sendMessage(
    msg: AnyClientMessageOf<Protocol> | TransportMessage,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const sessionID = headers['enkaku-session-id']
    const span = tracer.startSpan(SpanNames.TRANSPORT_HTTP_REQUEST, {
      attributes: {
        [AttributeKeys.HTTP_METHOD]: 'POST',
        [AttributeKeys.TRANSPORT_TYPE]: 'http',
        ...(sessionID != null ? { [AttributeKeys.TRANSPORT_SESSION_ID]: sessionID } : {}),
      },
    })
    try {
      const traceCtx = getActiveTraceContext()
      const requestHeaders: Record<string, string> = { ...headers }
      if (traceCtx != null) {
        requestHeaders.traceparent = formatTraceparent(
          traceCtx.traceID,
          traceCtx.spanID,
          traceCtx.traceFlags,
        )
      }
      const res = await fetchFn(params.url, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: requestHeaders,
        signal,
      })
      span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
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

  function consumeSSEStream(response: Response): void {
    const parser = createParser({
      onEvent: (event) => {
        try {
          const message = JSON.parse(event.data) as AnyServerMessageOf<Protocol>
          controller.enqueue(message)
        } catch (cause) {
          controller.error(new Error('Failed to parse SSE event data', { cause }))
        }
      },
    })

    const body = response.body
    if (body == null) {
      controller.error(
        new Error('Response body is null — streaming may not be supported by this environment'),
      )
      return
    }
    const reader = body.getReader()
    const decoder = new TextDecoder()

    async function pump(): Promise<void> {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          parser.feed(decoder.decode(value, { stream: true }))
        }
      } catch {
        // Stream ended (e.g. aborted) — nothing to do
      }
    }

    pump()
  }

  function connectSSESession(msg: AnyClientMessageOf<Protocol>): Promise<string> {
    return withSpan(
      tracer,
      SpanNames.TRANSPORT_HTTP_SSE_CONNECT,
      { attributes: { [AttributeKeys.TRANSPORT_TYPE]: 'http-sse' } },
      async (span) => {
        const headers: Record<string, string> = {
          accept: 'text/event-stream',
          'content-type': 'application/json',
        }
        const res = await sendMessage(msg, headers, abortController.signal)
        if (!res.ok) {
          throw new ResponseError(res)
        }
        const sessionID = res.headers.get('enkaku-session-id')
        if (sessionID == null) {
          throw new Error('Missing enkaku-session-id header in SSE response')
        }
        span.setAttribute(AttributeKeys.TRANSPORT_SESSION_ID, sessionID)
        consumeSSEStream(res)
        return sessionID
      },
    )
  }

  function getSessionID(): string | Promise<string> {
    switch (sessionState.status) {
      case 'idle': {
        // Should not be called directly — use ensureSession
        throw new Error('Session not initialized')
      }
      case 'connecting':
        return sessionState.promise
      case 'connected':
        return sessionState.sessionID
      case 'error':
        throw sessionState.error
    }
  }

  async function sendClientMessage(
    msg: AnyClientMessageOf<Protocol>,
    sessionID?: string,
  ): Promise<void> {
    const headers: Record<string, string> = { ...HEADERS }
    if (sessionID != null) {
      headers['enkaku-session-id'] = sessionID
    }
    const res = await sendMessage(msg, headers)
    if (res.ok && res.status !== 204) {
      res.json().then(
        (msg) => controller.enqueue(msg),
        (cause) => controller.error(new Error('Failed to parse response', { cause })),
      )
    }
  }

  const writable = writeTo<AnyClientMessageOf<Protocol>>(
    async (msg) => {
      try {
        if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
          if (sessionState.status === 'idle') {
            // First stream/channel message — connect SSE session
            const promise = connectSSESession(msg)
            sessionState = { status: 'connecting', promise }
            promise
              .then((sessionID) => {
                sessionState = { status: 'connected', sessionID }
              })
              .catch((cause) => {
                const error = new Error('Failed to connect SSE session', { cause })
                sessionState = { status: 'error', error }
                controller.error(error)
              })
            await promise
          } else {
            // Subsequent stream/channel messages — wait for session and send with ID
            const sessionID = await getSessionID()
            await sendClientMessage(msg, sessionID)
          }
        } else {
          await sendClientMessage(msg)
        }
      } catch (cause) {
        controller.error(new Error('Transport write failed', { cause }))
      }
    },
    // The transport will call this method when disposing
    async () => {
      abortController.abort()
    },
  )

  return { controller, readable, writable }
}

export type ClientTransportParams = {
  url: string
  fetch?: FetchFunction
}

export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream<Protocol>(params) })
  }
}
