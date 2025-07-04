import { DisposeInterruption, Disposer } from '@enkaku/async'
import { EventEmitter } from '@enkaku/event'
import {
  type AnyClientMessageOf,
  type AnyServerPayloadOf,
  createClientMessageSchema,
  type ProtocolDefinition,
  type ServerTransportOf,
} from '@enkaku/protocol'
import {
  createValidator,
  type StandardSchemaV1,
  ValidationError,
  type Validator,
} from '@enkaku/schema'
import { createUnsignedToken, isSignedToken, type SignedToken, type Token } from '@enkaku/token'

import { checkClientToken, type ProcedureAccessRecord } from './access-control.js'
import { type ChannelMessageOf, handleChannel } from './handlers/channel.js'
import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { handleRequest, type RequestMessageOf } from './handlers/request.js'
import { handleStream, type StreamMessageOf } from './handlers/stream.js'
import type {
  ChannelController,
  HandlerContext,
  HandlerController,
  ProcedureHandlers,
  ServerEmitter,
  ServerEvents,
} from './types.js'

type ProcessMessageOf<Protocol extends ProtocolDefinition> =
  | EventMessageOf<Protocol>
  | RequestMessageOf<Protocol>
  | StreamMessageOf<Protocol>
  | ChannelMessageOf<Protocol>

export type AccessControlParams =
  | { public: true; serverID?: string; access?: ProcedureAccessRecord }
  | { public: false; serverID: string; access: ProcedureAccessRecord }

export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  signal: AbortSignal
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}

async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { events, handlers, signal, transport, validator } = params

  const controllers: Record<string, HandlerController> = Object.create(null)
  const context: HandlerContext<Protocol> = {
    controllers,
    events,
    handlers,
    send: (payload) => transport.write(createUnsignedToken(payload)),
  }
  const running: Record<string, Promise<void>> = Object.create(null)

  const disposer = new Disposer({
    dispose: async () => {
      const interruption = new DisposeInterruption()
      // Abort all currently running handlers
      for (const controller of Object.values(controllers)) {
        controller.abort(interruption)
      }
      // Wait until all running handlers are done
      await Promise.all(Object.values(running))
    },
    signal,
  })

  // Abort inflight handlers when the transport fails to write
  transport.events.on('writeFailed', (event) => {
    controllers[event.rid]?.abort('Transport')
  })

  const processMessage = validator
    ? (message: unknown) => {
        const result = validator(message)
        if (result instanceof ValidationError) {
          events.emit('invalidMessage', {
            error: new Error('Invalid protocol message', { cause: result }),
            message,
          })
          return null
        }
        return (result as StandardSchemaV1.SuccessResult<AnyClientMessageOf<Protocol>>).value
      }
    : (message: unknown) => message as AnyClientMessageOf<Protocol>

  function processHandler(
    message: ProcessMessageOf<Protocol>,
    handle: () => Error | Promise<void>,
  ) {
    const returned = handle()
    if (returned instanceof Error) {
      const rid = message.payload.typ === 'event' ? undefined : message.payload.rid
      events.emit('handlerError', { error: returned, payload: message.payload, rid })
    } else {
      const id =
        message.payload.typ === 'event' ? Math.random().toString(36).slice(2) : message.payload.rid
      running[id] = returned
      returned.then(() => {
        delete running[id]
      })
    }
  }

  const process = params.public
    ? processHandler
    : async (message: ProcessMessageOf<Protocol>, handle: () => Error | Promise<void>) => {
        try {
          if (!params.public) {
            if (!isSignedToken(message as Token)) {
              throw new Error('Message is not signed')
            }
            await checkClientToken(
              params.serverID,
              params.access,
              message as unknown as SignedToken,
            )
          }
        } catch (err) {
          const errorMessage = (err as Error).message ?? 'Access denied'
          if (message.payload.typ === 'event') {
            events.emit('handlerError', {
              error: new Error(errorMessage, { cause: err }),
              payload: message.payload,
            })
          } else {
            context.send({
              typ: 'error',
              rid: message.payload.rid,
              code: 'EK02',
              msg: errorMessage,
            } as AnyServerPayloadOf<Protocol>)
          }
          return
        }
        processHandler(message, handle)
      }

  async function handleNext() {
    const next = await transport.read()
    if (next.done) {
      await disposer.dispose()
      return
    }

    const msg = processMessage(next.value)
    if (msg != null) {
      switch (msg.payload.typ) {
        case 'abort':
          controllers[msg.payload.rid]?.abort(msg.payload.rsn)
          break
        case 'channel': {
          const message = msg as ChannelMessageOf<Protocol>
          // @ts-ignore type instantiation too deep
          process(message, () => handleChannel(context, message))
          break
        }
        case 'event': {
          const message = msg as EventMessageOf<Protocol>
          process(message, () => handleEvent(context, message))
          break
        }
        case 'request': {
          const message = msg as unknown as RequestMessageOf<Protocol>
          process(message, () => handleRequest(context, message))
          break
        }
        case 'send': {
          const controller = controllers[msg.payload.rid] as ChannelController | undefined
          controller?.writer.write(msg.payload.val)
          break
        }
        case 'stream': {
          const message = msg as unknown as StreamMessageOf<Protocol>
          process(message, () => handleStream(context, message))
          break
        }
      }
    }

    handleNext()
  }
  handleNext()

  return disposer.disposed
}

type HandlingTransport<Protocol extends ProtocolDefinition> = {
  done: Promise<void>
  transport: ServerTransportOf<Protocol>
}

export type ServerParams<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  handlers: ProcedureHandlers<Protocol>
  id?: string
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}

export type HandleOptions = { public?: boolean; access?: ProcedureAccessRecord }

export class Server<Protocol extends ProtocolDefinition> extends Disposer {
  #abortController: AbortController
  #accessControl: AccessControlParams
  #events: ServerEmitter
  #handlers: ProcedureHandlers<Protocol>
  #handling: Array<HandlingTransport<Protocol>> = []
  #validator?: Validator<AnyClientMessageOf<Protocol>>

  constructor(params: ServerParams<Protocol>) {
    super({
      dispose: async () => {
        // Signal messages handler to stop execution and run cleanup logic
        this.#abortController.abort()
        // Dispose of all handling transports
        await Promise.all(
          // @ts-ignore type instantiation too deep
          this.#handling.map(async (handling) => {
            // Wait until all handlers are done - they might still need to flush messages to the transport
            await handling.done
            // Dispose transport
            await handling.transport.dispose()
          }),
        )
      },
      signal: params.signal,
    })
    this.#abortController = new AbortController()
    this.#events = new EventEmitter<ServerEvents>()
    this.#handlers = params.handlers

    if (params.id == null) {
      if (params.public) {
        this.#accessControl = { public: true, access: params.access }
      } else {
        throw new Error(
          'Invalid server parameters: either the server "id" must be provided or the "public" parameter must be set to true',
        )
      }
    } else {
      this.#accessControl = {
        public: !!params.public,
        serverID: params.id,
        access: params.access ?? {},
      }
    }

    if (params.protocol != null) {
      this.#validator = createValidator(createClientMessageSchema(params.protocol))
    }

    for (const transport of params.transports ?? []) {
      this.handle(transport)
    }
  }

  get events(): ServerEmitter {
    return this.#events
  }

  handle(transport: ServerTransportOf<Protocol>, options: HandleOptions = {}): Promise<void> {
    const publicAccess = options.public ?? this.#accessControl.public
    const access = options.access ?? this.#accessControl.access ?? {}

    let accessControl: AccessControlParams
    if (publicAccess) {
      accessControl = { public: true, access }
    } else {
      const serverID = this.#accessControl.serverID
      if (serverID == null) {
        return Promise.reject(new Error('Server ID is required to enable access control'))
      }
      accessControl = { public: false, serverID, access }
    }

    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      signal: this.#abortController.signal,
      transport,
      validator: this.#validator,
      ...accessControl,
    })
    this.#handling.push({ done, transport })
    return done
  }
}

export type ServeParams<Protocol extends ProtocolDefinition> = Omit<
  ServerParams<Protocol>,
  'transports'
> & {
  transport: ServerTransportOf<Protocol>
}

export function serve<Protocol extends ProtocolDefinition>(
  params: ServeParams<Protocol>,
): Server<Protocol> {
  const { transport, ...rest } = params
  return new Server<Protocol>({ ...rest, transports: [transport] })
}
