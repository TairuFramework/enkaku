import {
  type AnyClientMessageOf,
  type AnyServerPayloadOf,
  type ProtocolDefinition,
  type ServerTransportOf,
  createClientMessageSchema,
} from '@enkaku/protocol'
import { type Validator, createValidator } from '@enkaku/schema'
import { createPipe } from '@enkaku/stream'
import { type SignedToken, type Token, createUnsignedToken, isSignedToken } from '@enkaku/token'
import { type Disposer, createDisposer } from '@enkaku/util'

import { type CommandAccessRecord, checkClientToken } from './access-control.js'
import { type ChannelMessageOf, handleChannel } from './handlers/channel.js'
import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { type RequestMessageOf, handleRequest } from './handlers/request.js'
import { type StreamMessageOf, handleStream } from './handlers/stream.js'
import { ErrorRejection, type RejectionType } from './rejections.js'
import type {
  ChannelController,
  CommandHandlers,
  HandlerContext,
  HandlerController,
} from './types.js'

type ProcessMessageOf<Protocol extends ProtocolDefinition> =
  | EventMessageOf<Protocol>
  | RequestMessageOf<Protocol>
  | StreamMessageOf<Protocol>
  | ChannelMessageOf<Protocol>

export type AccessControlParams =
  | { public: true; serverID?: string; access?: CommandAccessRecord }
  | { public: false; serverID: string; access: CommandAccessRecord }

export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  handlers: CommandHandlers<Protocol>
  reject: (rejection: RejectionType) => void
  signal: AbortSignal
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}

async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { handlers, reject, signal, transport, validator } = params

  const controllers: Record<string, HandlerController> = Object.create(null)
  const context: HandlerContext<Protocol> = {
    controllers,
    handlers,
    reject,
    send: (payload) => transport.write(createUnsignedToken(payload)),
  }
  const running: Record<string, Promise<void>> = Object.create(null)

  const disposer = createDisposer(async () => {
    // Abort all currently running handlers
    for (const controller of Object.values(controllers)) {
      controller.abort()
    }
    // Wait until all running handlers are done
    await Promise.all(Object.values(running))
  }, signal)

  const processMessage = validator
    ? (message: unknown) => {
        const result = validator(message)
        if (result.isError()) {
          reject(
            new ErrorRejection('Invalid protocol message', {
              cause: result.error,
              info: { message },
            }),
          )
        }
        return result.value
      }
    : (message: unknown) => message as AnyClientMessageOf<Protocol>

  function processHandler(
    message: ProcessMessageOf<Protocol>,
    handle: () => ErrorRejection | Promise<void>,
  ) {
    const returned = handle()
    if (returned instanceof ErrorRejection) {
      reject(returned)
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
    : async (message: ProcessMessageOf<Protocol>, handle: () => ErrorRejection | Promise<void>) => {
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
            reject(new ErrorRejection(errorMessage, { cause: err, info: message }))
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
    if (msg == null) {
      return
    }

    switch (msg.payload.typ) {
      case 'abort':
        controllers[msg.payload.rid]?.abort()
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
  access?: CommandAccessRecord
  handlers: CommandHandlers<Protocol>
  id?: string
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}

export type HandleOptions = { public?: boolean; access?: CommandAccessRecord }

export class Server<Protocol extends ProtocolDefinition> implements Disposer {
  #abortController: AbortController
  #accessControl: AccessControlParams
  #disposer: Disposer
  #handlers: CommandHandlers<Protocol>
  #handling: Array<HandlingTransport<Protocol>> = []
  #reject: (rejection: RejectionType) => void
  #rejections: ReadableStream<RejectionType>
  #validator?: Validator<AnyClientMessageOf<Protocol>>

  constructor(params: ServerParams<Protocol>) {
    this.#abortController = new AbortController()
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

    this.#disposer = createDisposer(async () => {
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
      // Cleanup rejections writer
      await rejectionsWriter.close()
    }, params.signal)

    const rejections = createPipe<RejectionType>()
    this.#rejections = rejections.readable
    const rejectionsWriter = rejections.writable.getWriter()
    this.#reject = (rejection: RejectionType) => {
      void rejectionsWriter.write(rejection)
    }

    if (params.protocol != null) {
      this.#validator = createValidator(createClientMessageSchema(params.protocol))
    }

    for (const transport of params.transports ?? []) {
      this.handle(transport)
    }
  }

  get disposed() {
    return this.#disposer.disposed
  }

  get rejections() {
    return this.#rejections
  }

  async dispose() {
    return await this.#disposer.dispose()
  }

  handle(transport: ServerTransportOf<Protocol>, options: HandleOptions = {}): Promise<void> {
    const publicAccess = options.public ?? this.#accessControl.public
    let accessControl: AccessControlParams
    if (publicAccess) {
      accessControl = { public: true, access: {} }
    } else {
      const serverID = this.#accessControl.serverID
      if (serverID == null) {
        return Promise.reject(new Error('Server ID is required to enable access control'))
      }
      accessControl = {
        public: false,
        serverID,
        access: options.access ?? this.#accessControl.access ?? {},
      }
    }

    const done = handleMessages<Protocol>({
      handlers: this.#handlers,
      reject: this.#reject,
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
