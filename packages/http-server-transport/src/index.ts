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

import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { type Deferred, defer } from '@enkaku/util'

export type RequestHandler = (request: Request) => Promise<Response>

export type ServerBridge<Definitions extends AnyDefinitions> = {
  handleRequest: RequestHandler
  stream: ReadableWritablePair<AnyClientMessageOf<Definitions>, AnyServerMessageOf<Definitions>>
}

type ActiveSession = { controller: ReadableStreamDefaultController<string> | null }

type InflightRequest<Message> =
  | ({ type: 'request' } & Deferred<Response>)
  | { type: 'stream'; write: (msg: Message) => void }

export function createServerBridge<
  Definitions extends AnyDefinitions,
  Incoming extends AnyClientMessageOf<Definitions> = AnyClientMessageOf<Definitions>,
  Outgoing extends AnyServerMessageOf<Definitions> = AnyServerMessageOf<Definitions>,
>(): ServerBridge<Definitions> {
  const sessions: Map<string, ActiveSession> = new Map()
  const inflight: Map<string, InflightRequest<Outgoing>> = new Map()

  const [readable, controller] = createReadable<Incoming>()
  const writable = new WritableStream<Outgoing>({
    write(msg) {
      const request = inflight.get(msg.payload.rid)
      if (request == null) {
        return
      }
      if (request.type === 'request') {
        request.resolve(Response.json(msg))
        inflight.delete(msg.payload.rid)
      } else {
        request.write(msg)
      }
    },
  })

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
      const response = new Response(body, { status: 200 })
      response.headers.set('content-type', 'text/event-stream')
      response.headers.set('cache-control', 'no-store')
      return response
    }

    try {
      const message = (await request.json()) as Incoming
      // TODO: validate message structure

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
          const sid = request.headers.get('enkaku-session-id')
          if (!sid) {
            return Response.json(
              { error: 'Missing session ID header for stateful request' },
              { status: 400 },
            )
          }
          const session = sessions.get(sid)
          if (session == null) {
            return Response.json({ error: 'Invalid session ID' }, { status: 400 })
          }
          const ctrl = session.controller
          if (ctrl == null) {
            // The client hasn't connected to the SSE stream yet
            return Response.json({ error: 'Inactive session' }, { status: 400 })
          }

          // Client is ready to receive replies, keep track of request and provide sink to the SSE stream
          inflight.set(message.payload.rid, {
            type: 'stream',
            write: (msg) => {
              ctrl?.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
            },
          })
          controller.enqueue(message)
          // Replies will be send to the SSE stream, no content is returned here
          return new Response(null, { status: 204 })
        }
        default:
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
      }
    } catch (err) {
      console.log('handle request error', err)
      return Response.json({ error: (err as Error).message }, { status: 500 })
    }
  }

  return { handleRequest, stream: { readable, writable } }
}

export class ServerTransport<Definitions extends AnyDefinitions> extends Transport<
  AnyClientMessageOf<Definitions>,
  AnyServerMessageOf<Definitions>
> {
  #bridge: ServerBridge<Definitions>

  constructor() {
    const bridge = createServerBridge<Definitions>()
    super({ stream: bridge.stream })
    this.#bridge = bridge
  }

  handleRequest = async (request: Request): Promise<Response> => {
    return await this.#bridge.handleRequest(request)
  }
}
