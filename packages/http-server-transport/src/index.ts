/**
 * HTTP transport for Enkaku RPC servers.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/http-server-transport
 * ```
 *
 * @module http-server-transport
 */

import { type Deferred, defer } from '@enkaku/async'
import {
  AttributeKeys,
  type Context,
  createTracer,
  extractTraceContext,
  parseTraceparent,
  SpanNames,
  SpanStatusCode,
} from '@enkaku/otel'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createReadable, writeTo } from '@enkaku/stream'
import { Transport, type TransportEvents } from '@enkaku/transport'

const tracer = createTracer('transport.http')

export type RequestHandler = (request: Request) => Promise<Response>

export type ServerBridge<Protocol extends ProtocolDefinition> = {
  handleRequest: RequestHandler
  stream: ReadableWritablePair<AnyClientMessageOf<Protocol>, AnyServerMessageOf<Protocol>>
}

type ActiveSession = {
  controller: ReadableStreamDefaultController<string> | null
  lastAccess: number
}

type InflightRequest =
  | ({ type: 'request'; headers: Record<string, string> } & Deferred<Response>)
  | { type: 'stream'; sessionID: string }

export type ServerBridgeOptions = {
  allowedOrigin?: string | Array<string>
  onWriteError?: (event: TransportEvents['writeFailed']) => void
  maxSessions?: number
  sessionTimeoutMs?: number
  maxInflightRequests?: number
  requestTimeoutMs?: number
}

const VALID_PAYLOAD_TYPES = new Set(['abort', 'channel', 'event', 'request', 'send', 'stream'])

const ALLOWED_ORIGIN_SCHEMES = new Set(['http:', 'https:'])

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return ALLOWED_ORIGIN_SCHEMES.has(url.protocol)
  } catch {
    return false
  }
}

export function createServerBridge<Protocol extends ProtocolDefinition>(
  options: ServerBridgeOptions = {},
): ServerBridge<Protocol> {
  type Incoming = AnyClientMessageOf<Protocol>
  type Outgoing = AnyServerMessageOf<Protocol>

  const allowedOrigins = Array.isArray(options.allowedOrigin)
    ? options.allowedOrigin
    : options.allowedOrigin != null
      ? [options.allowedOrigin]
      : []
  const maxSessions = options.maxSessions ?? 1000
  const sessionTimeoutMs = options.sessionTimeoutMs ?? 300_000 // 5 minutes
  const maxInflightRequests = options.maxInflightRequests ?? 10_000
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000 // 30 seconds
  const sessions: Map<string, ActiveSession> = new Map()
  const inflight: Map<string, InflightRequest> = new Map()
  const inflightTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // Periodic cleanup of expired sessions
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [id, session] of sessions) {
        if (now - session.lastAccess > sessionTimeoutMs) {
          if (session.controller != null) {
            try {
              session.controller.close()
            } catch {}
          }
          sessions.delete(id)
        }
      }
    },
    Math.min(sessionTimeoutMs, 60_000),
  )
  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref()
  }

  const [readable, controller] = createReadable<Incoming>()
  const writable = writeTo<Outgoing>((msg) => {
    const { rid } = msg.payload
    const request = inflight.get(rid)
    if (request == null) {
      options.onWriteError?.({ error: new Error('Request not found'), rid })
      return
    }
    if (request.type === 'request') {
      const timer = inflightTimers.get(rid)
      if (timer != null) {
        clearTimeout(timer)
        inflightTimers.delete(rid)
      }
      request.resolve(Response.json(msg, { headers: request.headers }))
      inflight.delete(msg.payload.rid)
    } else {
      const session = sessions.get(request.sessionID)
      if (session == null) {
        options.onWriteError?.({
          error: new Error(`Session not found: ${request.sessionID}`),
          rid,
        })
        return
      }
      if (session.controller == null) {
        options.onWriteError?.({
          error: new Error(`No controller for session: ${request.sessionID}`),
          rid,
        })
        return
      }
      try {
        session.controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
      } catch (cause) {
        options.onWriteError?.({
          error: new Error(`Error writing to SSE feed for session: ${request.sessionID}`, {
            cause,
          }),
          rid,
        })
        sessions.delete(request.sessionID)
      }
    }
  })

  function checkRequestOrigin(request: Request): Response | string | null {
    const origin = request.headers.get('origin')
    if (allowedOrigins.length === 0) {
      if (origin != null) {
        return Response.json({ error: 'Origin not allowed' }, { status: 403 })
      }
      return null
    }
    if (allowedOrigins.includes('*')) {
      if (origin == null) {
        return '*'
      }
      if (!isValidOrigin(origin)) {
        return Response.json({ error: 'Origin not allowed' }, { status: 403 })
      }
      return origin
    }
    if (origin == null || !allowedOrigins.includes(origin)) {
      return Response.json({ error: 'Origin not allowed' }, { status: 403 })
    }
    return origin
  }

  function getAccessControlHeaders(origin: string) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, enkaku-session-id',
      'Access-Control-Max-Age': '86400', // 24 hours
    }
  }

  function handleOptionsRequest(request: Request): Response {
    const checkedOrigin = checkRequestOrigin(request)
    if (checkedOrigin instanceof Response) {
      return checkedOrigin
    }
    const headers = checkedOrigin != null ? getAccessControlHeaders(checkedOrigin) : {}
    return new Response(null, { headers, status: 204 })
  }

  function handleGetRequest(request: Request): Response {
    const checkedOrigin = checkRequestOrigin(request)
    if (checkedOrigin instanceof Response) {
      return checkedOrigin
    }

    const headers = checkedOrigin != null ? getAccessControlHeaders(checkedOrigin) : {}

    // GET request to access the SSE stream
    const url = new URL(request.url)
    const sessionID = url.searchParams.get('id')
    if (sessionID == null) {
      // No session ID, create one and return its ID to the client
      if (sessions.size >= maxSessions) {
        return Response.json({ error: 'Session limit reached' }, { headers, status: 503 })
      }
      const id = globalThis.crypto.randomUUID()
      sessions.set(id, { controller: null, lastAccess: Date.now() })
      return Response.json({ id }, { headers })
    }

    const existing = sessions.get(sessionID)
    if (existing == null) {
      // Unknown session ID
      return Response.json({ error: 'Invalid ID' }, { headers, status: 400 })
    }

    // Create SSE feed and track controller, refresh timeout
    const [body, controller] = createReadable<string>()
    // Send an SSE comment to flush response headers immediately.
    // Without this, Node.js HTTP frameworks may buffer the response
    // until the first data chunk, preventing EventSource 'open' from firing.
    controller.enqueue(':\n\n')
    sessions.set(sessionID, { controller, lastAccess: Date.now() })

    request.signal.addEventListener('abort', () => {
      controller.close()
      sessions.delete(sessionID)
    })

    return new Response(body.pipeThrough(new TextEncoderStream()), {
      headers: {
        ...headers,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
      },
      status: 200,
    })
  }

  async function handlePostRequest(request: Request): Promise<Response> {
    const checkedOrigin = checkRequestOrigin(request)
    if (checkedOrigin instanceof Response) {
      return checkedOrigin
    }

    const headers = checkedOrigin != null ? getAccessControlHeaders(checkedOrigin) : {}
    try {
      const message = (await request.json()) as Incoming
      if (!VALID_PAYLOAD_TYPES.has(message?.payload?.typ)) {
        return Response.json({ error: 'Invalid message type' }, { headers, status: 400 })
      }
      switch (message.payload.typ) {
        // Fire and forget messages
        case 'abort':
        case 'event':
        case 'send':
          controller.enqueue(message)
          return new Response(null, { headers, status: 204 })
        // Immediate response message
        case 'request': {
          if (inflight.size >= maxInflightRequests) {
            return Response.json(
              { error: 'Inflight request limit reached' },
              { headers, status: 503 },
            )
          }
          const rid = message.payload.rid
          const response = defer<Response>()
          inflight.set(rid, { type: 'request', headers, ...response })

          // Set timeout for this request
          const timer = setTimeout(() => {
            const entry = inflight.get(rid)
            if (entry != null && entry.type === 'request') {
              entry.resolve(
                Response.json(
                  { error: 'Request timeout' },
                  { headers: entry.headers, status: 504 },
                ),
              )
              inflight.delete(rid)
              inflightTimers.delete(rid)
            }
          }, requestTimeoutMs)
          if (typeof timer === 'object' && 'unref' in timer) {
            timer.unref()
          }
          inflightTimers.set(rid, timer)

          controller.enqueue(message)
          // Wait for reply from message handler
          return response.promise
        }
        // Stateful response message
        case 'channel':
        case 'stream': {
          const sid = request.headers.get('enkaku-session-id')
          if (sid != null) {
            // Existing session — validate and route through it
            const session = sessions.get(sid)
            if (session == null) {
              return Response.json({ error: 'Invalid session ID' }, { headers, status: 400 })
            }
            if (session.controller == null) {
              return Response.json({ error: 'Inactive session' }, { headers, status: 400 })
            }
            session.lastAccess = Date.now()
            inflight.set(message.payload.rid, { type: 'stream', sessionID: sid })
            controller.enqueue(message)
            return new Response(null, { headers, status: 204 })
          }

          // No session — create one and return SSE stream
          if (sessions.size >= maxSessions) {
            return Response.json({ error: 'Session limit reached' }, { headers, status: 503 })
          }
          const sessionID = globalThis.crypto.randomUUID()
          const [body, sseController] = createReadable<string>()
          // Send an SSE comment to flush response headers immediately.
          sseController.enqueue(':\n\n')
          sessions.set(sessionID, { controller: sseController, lastAccess: Date.now() })

          request.signal.addEventListener('abort', () => {
            try {
              sseController.close()
            } catch {}
            sessions.delete(sessionID)
          })

          inflight.set(message.payload.rid, { type: 'stream', sessionID })
          controller.enqueue(message)

          return new Response(body.pipeThrough(new TextEncoderStream()), {
            headers: {
              ...headers,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-store',
              'enkaku-session-id': sessionID,
            },
            status: 200,
          })
        }
        default:
          throw new Error('Invalid payload')
      }
    } catch {
      return Response.json({ error: 'Invalid request' }, { headers, status: 400 })
    }
  }

  async function handleRequest(request: Request): Promise<Response> {
    const traceparentHeader = request.headers.get('traceparent')
    const traceparentData =
      traceparentHeader != null ? parseTraceparent(traceparentHeader) : undefined

    let parentCtx: Context | undefined
    if (traceparentData != null) {
      parentCtx = extractTraceContext({
        tid: traceparentData.traceID,
        sid: traceparentData.spanID,
      })
    }

    const span = tracer.startSpan(
      SpanNames.TRANSPORT_HTTP_REQUEST,
      {
        attributes: {
          [AttributeKeys.HTTP_METHOD]: request.method,
          [AttributeKeys.TRANSPORT_TYPE]: 'http-server',
        },
      },
      parentCtx,
    )
    try {
      let response: Response
      switch (request.method) {
        case 'OPTIONS':
          response = handleOptionsRequest(request)
          break
        case 'GET':
          response = handleGetRequest(request)
          break
        case 'POST':
          response = await handlePostRequest(request)
          break
        default:
          response = Response.json(
            { error: 'Method not allowed' },
            { headers: { Allow: 'GET, POST, OPTIONS' }, status: 405 },
          )
      }
      span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, response.status)
      if (response.status >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` })
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      return response
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

  return { handleRequest, stream: { readable, writable } }
}

export type ServerTransportOptions = {
  allowedOrigin?: string | Array<string>
  maxSessions?: number
  sessionTimeoutMs?: number
  maxInflightRequests?: number
  requestTimeoutMs?: number
}

export class ServerTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
> {
  #bridge: ServerBridge<Protocol>

  constructor(options: ServerTransportOptions = {}) {
    const bridge = createServerBridge<Protocol>({
      allowedOrigin: options.allowedOrigin,
      maxSessions: options.maxSessions,
      sessionTimeoutMs: options.sessionTimeoutMs,
      maxInflightRequests: options.maxInflightRequests,
      requestTimeoutMs: options.requestTimeoutMs,
      onWriteError: (event) => {
        this.events.emit('writeFailed', event)
      },
    })
    super({ stream: bridge.stream })
    this.#bridge = bridge
  }

  fetch = async (request: Request): Promise<Response> => {
    return await this.#bridge.handleRequest(request)
  }
}
