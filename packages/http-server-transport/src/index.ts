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

type ActiveSession = { controller: ReadableStreamDefaultController<string> | null }

type InflightRequest =
  | ({ type: 'request' } & Deferred<Response>)
  | { type: 'stream'; sessionID: string }

export type ServerBridgeOptions = {
  onWriteError?: (event: TransportEvents['writeFailed']) => void
}

export function createServerBridge<Protocol extends ProtocolDefinition>(
  options: ServerBridgeOptions = {},
): ServerBridge<Protocol> {
  type Incoming = AnyClientMessageOf<Protocol>
  type Outgoing = AnyServerMessageOf<Protocol>

  const sessions: Map<string, ActiveSession> = new Map()
  const inflight: Map<string, InflightRequest> = new Map()

  const [readable, controller] = createReadable<Incoming>()
  const writable = writeTo<Outgoing>((msg) => {
    const { rid } = msg.payload
    const request = inflight.get(rid)
    if (request == null) {
      options.onWriteError?.({ error: new Error('Request not found'), rid })
      return
    }
    if (request.type === 'request') {
      request.resolve(Response.json(msg))
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

  async function handleRequest(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      // GET request to access the SSE stream
      const url = new URL(request.url)
      const sessionID = url.searchParams.get('id')
      if (sessionID == null) {
        // No session ID, create one and return its ID to the client
        const id = globalThis.crypto.randomUUID()
        sessions.set(id, { controller: null })
        return Response.json({ id })
      }

      // Unknown session ID
      if (!sessions.has(sessionID)) {
        return Response.json({ error: 'Invalid ID' }, { status: 400 })
      }

      // Create SSE feed and track controller
      const [body, controller] = createReadable<string>()
      sessions.set(sessionID, { controller })

      request.signal.addEventListener('abort', () => {
        controller.close()
        sessions.delete(sessionID)
      })

      return new Response(body.pipeThrough(new TextEncoderStream()), {
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
        status: 200,
      })
    }

    try {
      const message = (await request.json()) as Incoming
      switch (message.payload.typ) {
        // Fire and forget messages
        case 'abort':
        case 'event':
        case 'send':
          controller.enqueue(message)
          return new Response(null, { status: 204 })
        // Immediate response message
        case 'request': {
          const response = defer<Response>()
          inflight.set(message.payload.rid, { type: 'request', ...response })
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
          return new Response(null, { status: 204 })
        }
        default:
          throw new Error('Invalid payload')
      }
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 })
    }
  }

  return { handleRequest, stream: { readable, writable } }
}

export class ServerTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
> {
  #bridge: ServerBridge<Protocol>

  constructor() {
    const bridge = createServerBridge<Protocol>({
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
