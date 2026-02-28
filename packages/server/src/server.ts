import { DisposeInterruption, Disposer } from '@enkaku/async'
import { EventEmitter } from '@enkaku/event'
import { getEnkakuLogger, type Logger } from '@enkaku/log'
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
import {
  createUnsignedToken,
  type Identity,
  isSignedToken,
  type SignedToken,
  type Token,
} from '@enkaku/token'

import {
  checkClientToken,
  type EncryptionPolicy,
  type ProcedureAccessRecord,
  resolveEncryptionPolicy,
} from './access-control.js'
import { HandlerError } from './error.js'
import { type ChannelMessageOf, handleChannel } from './handlers/channel.js'
import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { handleRequest, type RequestMessageOf } from './handlers/request.js'
import { handleStream, type StreamMessageOf } from './handlers/stream.js'
import { createResourceLimiter, type ResourceLimiter, type ResourceLimits } from './limits.js'
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

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

export type AccessControlParams = (
  | { public: true; serverID?: string; access?: ProcedureAccessRecord }
  | { public: false; serverID: string; access: ProcedureAccessRecord }
) & { encryptionPolicy?: EncryptionPolicy }

export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  limiter: ResourceLimiter
  logger: Logger
  signal: AbortSignal
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}

async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { events, handlers, limiter, logger, signal, transport, validator } = params

  const controllers: Record<string, HandlerController> = Object.create(null)
  const context: HandlerContext<Protocol> = {
    controllers,
    events,
    handlers,
    logger,
    send: (payload) => transport.write(createUnsignedToken(payload)),
  }
  const running: Record<string, Promise<void>> = Object.create(null)
  const encoder = new TextEncoder()

  // Periodic cleanup of expired controllers
  const cleanupInterval = setInterval(
    () => {
      const expired = limiter.getExpiredControllers()
      for (const rid of expired) {
        const controller = controllers[rid]
        if (controller != null) {
          controller.abort('Timeout')
          const error = new HandlerError({
            code: 'EK05',
            message: 'Request timeout',
          })
          context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
          events.emit('handlerTimeout', { rid })
          limiter.removeController(rid)
          limiter.releaseHandler()
          delete controllers[rid]
          delete running[rid]
        } else {
          limiter.removeController(rid)
        }
      }
    },
    Math.min(limiter.limits.controllerTimeoutMs, 10000),
  )

  const disposer = new Disposer({
    dispose: async () => {
      clearInterval(cleanupInterval)
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
          logger.debug('received invalid message', { error: result })
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
    const rid =
      message.payload.typ === 'event' ? Math.random().toString(36).slice(2) : message.payload.rid

    // Check controller limit
    if (!limiter.canAddController()) {
      const error = new HandlerError({
        code: 'EK03',
        message: 'Server controller limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
      }
      events.emit('handlerError', { error, payload: message.payload })
      return
    }

    // Check handler concurrency (synchronous fast path)
    if (limiter.activeHandlers >= limiter.limits.maxConcurrentHandlers) {
      const error = new HandlerError({
        code: 'EK04',
        message: 'Server handler limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>)
      }
      events.emit('handlerError', { error, payload: message.payload })
      return
    }

    limiter.addController(rid)
    limiter.acquireHandler()

    const returned = handle()
    if (returned instanceof Error) {
      limiter.removeController(rid)
      limiter.releaseHandler()
      events.emit('handlerError', {
        error: HandlerError.from(returned, { code: 'EK01' }),
        payload: message.payload,
      })
    } else {
      running[rid] = returned
      returned.then(() => {
        // Guard against double-release if timeout cleanup already handled this rid
        if (running[rid] === returned) {
          limiter.removeController(rid)
          limiter.releaseHandler()
          delete running[rid]
        }
      })
    }
  }

  function checkMessageEncryption(message: ProcessMessageOf<Protocol>): boolean {
    const globalPolicy = params.encryptionPolicy ?? 'none'
    if (globalPolicy === 'none') {
      return true
    }

    const procedure = (message.payload as Record<string, unknown>).prc as string | undefined
    const effectivePolicy =
      procedure != null
        ? resolveEncryptionPolicy(procedure, params.access, globalPolicy)
        : globalPolicy

    if (effectivePolicy !== 'required') {
      return true
    }

    // Detect if message was encrypted: jwe-in-jws mode has a 'jwe' field in the payload
    const payload = message.payload as Record<string, unknown>
    return 'jwe' in payload && typeof payload.jwe === 'string'
  }

  function handleEncryptionViolation(message: ProcessMessageOf<Protocol>): void {
    const error = new HandlerError({
      code: 'EK07',
      message: 'Encryption required but message is not encrypted',
    })
    if (message.payload.typ === 'event') {
      events.emit('handlerError', { error, payload: message.payload })
    } else {
      context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>)
    }
  }

  const process = params.public
    ? (message: ProcessMessageOf<Protocol>, handle: () => Error | Promise<void>) => {
        if (!checkMessageEncryption(message)) {
          handleEncryptionViolation(message)
          return
        }
        processHandler(message, handle)
      }
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
        } catch (cause) {
          const error = new HandlerError({
            cause,
            code: 'EK02',
            message: (cause as Error).message ?? 'Access denied',
          })
          if (message.payload.typ === 'event') {
            events.emit('eventAuthError', { error, payload: message.payload })
            events.emit('handlerError', { error, payload: message.payload })
          } else {
            context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>)
          }
          return
        }
        if (!checkMessageEncryption(message)) {
          handleEncryptionViolation(message)
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
      const msgSize = encoder.encode(JSON.stringify(msg.payload)).byteLength
      if (msgSize > limiter.limits.maxMessageSize) {
        const error = new HandlerError({
          code: 'EK06',
          message: 'Message exceeds maximum size',
        })
        if ('rid' in msg.payload && msg.payload.rid != null) {
          context.send(error.toPayload(msg.payload.rid as string) as AnyServerPayloadOf<Protocol>)
        }
        events.emit('handlerError', { error, payload: msg.payload })
        handleNext()
        return
      }
      switch (msg.payload.typ) {
        case 'abort':
          controllers[msg.payload.rid]?.abort(msg.payload.rsn)
          break
        case 'channel': {
          const message = msg as ChannelMessageOf<Protocol>
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
          if (controller == null) {
            logger.debug('received send for unknown channel {rid}', { rid: msg.payload.rid })
            break
          }
          // In non-public mode, validate send messages against the channel owner
          if (!params.public) {
            if (!isSignedToken(msg as Token)) {
              const error = new HandlerError({
                code: 'EK02',
                message: 'Channel send message must be signed',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>)
              break
            }
            const sendIssuer = (msg as unknown as SignedToken).payload.iss
            if (controller.issuer != null && sendIssuer !== controller.issuer) {
              const error = new HandlerError({
                code: 'EK02',
                message: 'Send issuer does not match channel owner',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>)
              break
            }
          }
          controller.writer.write(msg.payload.val)
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
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  handlers: ProcedureHandlers<Protocol>
  identity?: Identity
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}

export type HandleOptions = { access?: ProcedureAccessRecord; logger?: Logger; public?: boolean }

export class Server<Protocol extends ProtocolDefinition> extends Disposer {
  #abortController: AbortController
  #accessControl: AccessControlParams
  #events: ServerEmitter
  #getRandomID: () => string
  #handlers: ProcedureHandlers<Protocol>
  #handling: Array<HandlingTransport<Protocol>> = []
  #limiter: ResourceLimiter
  #logger: Logger
  #validator?: Validator<AnyClientMessageOf<Protocol>>

  constructor(params: ServerParams<Protocol>) {
    super({
      dispose: async () => {
        // Signal messages handler to stop execution and run cleanup logic
        this.#abortController.abort()

        const cleanupTimeout = this.#limiter.limits.cleanupTimeoutMs
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(resolve, cleanupTimeout)
        })

        // Race between graceful cleanup and timeout
        const gracefulDone = await Promise.race([
          Promise.all(
            this.#handling.map(async (handling) => {
              // Wait until all handlers are done - they might still need to flush messages to the transport
              await handling.done
              // Dispose transport
              await handling.transport.dispose()
            }),
          ).then(() => true),
          timeoutPromise.then(() => false),
        ])

        // Force dispose any remaining transports only if timed out
        if (!gracefulDone) {
          for (const handling of this.#handling) {
            try {
              await handling.transport.dispose()
            } catch {
              // Ignore errors during forced cleanup
            }
          }
        }
      },
      signal: params.signal,
    })
    this.#abortController = new AbortController()
    this.#events = new EventEmitter<ServerEvents>()
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#handlers = params.handlers
    const serverID = params.identity?.id
    this.#logger =
      params.logger ?? getEnkakuLogger('server', { serverID: serverID ?? this.#getRandomID() })

    if (serverID == null) {
      if (params.public) {
        this.#accessControl = {
          public: true,
          access: params.access,
          encryptionPolicy: params.encryptionPolicy,
        }
      } else {
        throw new Error(
          'Invalid server parameters: either the server "identity" must be provided or the "public" parameter must be set to true',
        )
      }
    } else {
      this.#accessControl = {
        public: !!params.public,
        serverID,
        access: params.access ?? {},
        encryptionPolicy: params.encryptionPolicy,
      }
    }

    this.#limiter = createResourceLimiter(params.limits)

    if (params.protocol != null) {
      this.#validator = createValidator(createClientMessageSchema(params.protocol))
    } else {
      this.#logger.warn(
        'No protocol provided: message validation is disabled. Pass a protocol definition to enable runtime type checking.',
      )
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
    const logger =
      options.logger ?? this.#logger.getChild('handler').with({ transportID: this.#getRandomID() })

    const encryptionPolicy = this.#accessControl.encryptionPolicy

    let accessControl: AccessControlParams
    if (publicAccess) {
      accessControl = { public: true, access, encryptionPolicy }
    } else {
      const serverID = this.#accessControl.serverID
      if (serverID == null) {
        return Promise.reject(new Error('Server ID is required to enable access control'))
      }
      accessControl = { public: false, serverID, access, encryptionPolicy }
    }

    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      limiter: this.#limiter,
      logger,
      signal: this.#abortController.signal,
      transport,
      validator: this.#validator,
      ...accessControl,
    })
    this.#handling.push({ done, transport })

    logger.info('added')
    return done.then(() => {
      logger.info('done')
    })
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
