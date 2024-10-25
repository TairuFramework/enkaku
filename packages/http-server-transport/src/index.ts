import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { createReadable } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'
import { type Deferred, defer } from '@enkaku/util'

export type RequestHandler = (request: Request) => Promise<Response>

export type ServerBridge<Definitions extends AnyDefinitions> = {
  handleRequest: RequestHandler
  stream: ReadableWritablePair<AnyClientMessageOf<Definitions>, AnyServerMessageOf<Definitions>>
}

type InflightRequest =
  | ({ type: 'request' } & Deferred<Response>)
  | { type: 'stream'; controller: ReadableStreamDefaultController<string> }

export function createServerBridge<
  Definitions extends AnyDefinitions,
  Incoming extends AnyClientMessageOf<Definitions> = AnyClientMessageOf<Definitions>,
  Outgoing extends AnyServerMessageOf<Definitions> = AnyServerMessageOf<Definitions>,
>(): ServerBridge<Definitions> {
  const inflight: Map<string, InflightRequest> = new Map()
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
        request.controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
        if (msg.payload.typ !== 'receive') {
          request.controller.close()
          inflight.delete(msg.payload.rid)
        }
      }
    },
  })

  async function handleRequest(request: Request): Promise<Response> {
    const message = (await request.json()) as Incoming
    // TODO: check message is valid token
    // should be provided protocol for all valid requests to validate JSON schema
    // !!! this should be part of the protocol package

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
        return response.promise
      }
      // Stateful response message
      case 'channel':
      case 'stream': {
        const [body, controller] = createReadable<string>()
        inflight.set(message.payload.rid, { type: 'stream', controller })
        const response = new Response(body, { status: 200 })
        response.headers.set('content-type', 'text/event-stream')
        response.headers.set('cache-control', 'no-store')
        return response
      }
      default:
        return Response.json({ error: 'Invalid payload' }, { status: 400 })
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

  async handleRequest(request: Request): Promise<Response> {
    return await this.#bridge.handleRequest(request)
  }
}
