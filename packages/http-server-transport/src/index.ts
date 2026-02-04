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
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createReadable, writeTo } from '@enkaku/stream'
import { Transport, type TransportEvents } from '@enkaku/transport'

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
    : [options.allowedOrigin ?? '*']
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

  function getRequestSessionController(
    request: Request,
  ): [string, ReadableStreamDefaultController<string>] {
    const sid = request.headers.get('enkaku-session-id')
    if (!sid) {
      throw new Error('Missing session ID header for stateful request')
    }
    const session = sessions.get(sid)
    if (session == null) {
      throw new Error('Invalid session ID')
    }
    const ctrl = session.controller
    if (ctrl == null) {
      // The client hasn't connected to the SSE stream yet
      throw new Error('Inactive session')
    }
    return [sid, ctrl]
  }

  function checkRequestOrigin(request: Request): Response | string {
    const origin = request.headers.get('origin')
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
    return new Response(null, {
      headers: getAccessControlHeaders(checkedOrigin),
      status: 204,
    })
  }

  function handleGetRequest(request: Request): Response {
    const checkedOrigin = checkRequestOrigin(request)
    if (checkedOrigin instanceof Response) {
      return checkedOrigin
    }

    const headers = getAccessControlHeaders(checkedOrigin)

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

    const headers = getAccessControlHeaders(checkedOrigin)
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
          const [sid] = getRequestSessionController(request)
          // Client is ready to receive replies, keep track of request and provide sink to the SSE stream
          inflight.set(message.payload.rid, { type: 'stream', sessionID: sid })
          controller.enqueue(message)
          // Replies will be send to the SSE stream, no content is returned here
          return new Response(null, { headers, status: 204 })
        }
        default:
          throw new Error('Invalid payload')
      }
    } catch {
      return Response.json({ error: 'Invalid request' }, { headers, status: 400 })
    }
  }

  async function handleRequest(request: Request): Promise<Response> {
    switch (request.method) {
      case 'OPTIONS':
        return handleOptionsRequest(request)
      case 'GET':
        return handleGetRequest(request)
      case 'POST':
        return await handlePostRequest(request)
      default:
        return Response.json(
          { error: 'Method not allowed' },
          { headers: { Allow: 'GET, POST, OPTIONS' }, status: 405 },
        )
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
