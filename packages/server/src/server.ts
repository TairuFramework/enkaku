import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '@enkaku/otel'
import {
  type AnyClientMessageOf,
  type AnyServerPayloadOf,
  createClientMessageSchema,
  ErrorCodes,
  type ProtocolDefinition,
  type ServerTransportOf,
} from '@enkaku/protocol'
import type { VerifyTokenHook } from '@kokuin/capability'
import {
  createInMemoryDIDCache,
  type DIDCache,
  type DIDResolver,
  type Identity,
  isSignedToken,
  normalizeDID,
  type SignedToken,
  type Token,
  verifyToken,
} from '@kokuin/token'
import { DisposeInterruption, Disposer } from '@sozai/async'
import { EventEmitter } from '@sozai/event'
import { getLogger, type Logger } from '@sozai/log'
import {
  AttributeKeys,
  extractTraceContext,
  type Span,
  SpanStatusCode,
  setSpanOnContext,
  TraceFlags,
  type Tracer,
  withActiveContext,
} from '@sozai/otel'
import { createRuntime, type Runtime } from '@sozai/runtime'
import {
  createValidator,
  type StandardSchemaV1,
  ValidationError,
  type Validator,
} from '@sozai/schema'

import {
  type AccessRules,
  checkClientToken,
  type EncryptionPolicy,
  resolveEncryptionPolicy,
} from './access-control.js'
import { HandlerError } from './error.js'
import { type ChannelMessageOf, handleChannel } from './handlers/channel.js'
import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { handleRequest, type RequestMessageOf } from './handlers/request.js'
import { handleStream, type StreamMessageOf } from './handlers/stream.js'
import { createResourceLimiter, type ResourceLimiter, type ResourceLimits } from './limits.js'
import { safeWrite } from './safe-write.js'
import type {
  ChannelController,
  HandlerContext,
  HandlerController,
  ProcedureHandlers,
  ServerEmitter,
  ServerEvents,
} from './types.js'
import { emitHandlerError } from './utils.js'

type ProcessMessageOf<Protocol extends ProtocolDefinition> =
  | EventMessageOf<Protocol>
  | RequestMessageOf<Protocol>
  | StreamMessageOf<Protocol>
  | ChannelMessageOf<Protocol>

const defaultTracer = createTracer('server')

export type AccessControlParams = (
  | { requireAuth: false; serverID?: string; access: AccessRules }
  | { requireAuth: true; serverID: string; access: AccessRules }
) & {
  encryptionPolicy?: EncryptionPolicy
  verifyToken?: VerifyTokenHook
  cache?: DIDCache
  resolver?: DIDResolver
}

export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  limiter: ResourceLimiter
  logger: Logger
  signal: AbortSignal
  tracer: Tracer
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
    send: (payload, options) => safeWrite({ transport, payload, rid: options?.rid, ctx: context }),
    signal,
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
          events.emit('handlerAbort', { rid, reason: 'Timeout' })
          const error = new HandlerError({
            code: ErrorCodes.TIMEOUT,
            message: 'Request timeout',
          })
          context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
          events.emit('handlerTimeout', { rid })
          limiter.removeController(rid)
          // Only non-long-lived controllers expire (getExpiredControllers skips
          // long-lived entries), so the default releaseHandler() is correct here.
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
      for (const rid of Object.keys(controllers)) {
        controllers[rid]?.abort(interruption)
        events.emit('handlerAbort', { rid, reason: interruption })
      }
      // Wait until all running handlers are done
      await Promise.all(Object.values(running))
    },
    signal,
  })

  const processMessage = validator
    ? (message: unknown) => {
        const result = validator(message)
        if (result instanceof ValidationError) {
          const validationSpan = params.tracer.startSpan(EnkakuSpanNames.SERVER_HANDLE, {
            attributes: { [AttributeKeys.RPC_SYSTEM]: 'enkaku' },
          })
          validationSpan.addEvent('enkaku.validation', {
            [EnkakuAttributeKeys.VALIDATION_SUCCESS]: false,
            [EnkakuAttributeKeys.VALIDATION_ERROR]: result.message,
          })
          validationSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Validation failed' })
          validationSpan.end()

          logger.debug('received invalid message', { error: result })
          events.emit('invalidMessage', {
            error: new Error('Invalid protocol message', { cause: result }),
            message,
          })
          // If the raw message carries a rid on a reply-capable type, send an
          // error reply instead of leaving the client to hang forever.
          const rawPayload =
            message != null && typeof message === 'object' && 'payload' in message
              ? (message as { payload: unknown }).payload
              : undefined
          if (rawPayload != null && typeof rawPayload === 'object') {
            const { rid, typ } = rawPayload as { rid?: unknown; typ?: unknown }
            if (
              typeof rid === 'string' &&
              (typ === 'request' || typ === 'stream' || typ === 'channel' || typ === 'send')
            ) {
              const error = new HandlerError({
                code: ErrorCodes.INVALID_MESSAGE,
                message: 'Invalid protocol message',
              })
              context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
            }
          }
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

    const procedure = (message.payload as Record<string, unknown>).prc as string | undefined
    const longLived = procedure != null && limiter.limits.longLivedProcedures.includes(procedure)

    // Check controller limit
    if (!limiter.canAddController()) {
      const error = new HandlerError({
        code: ErrorCodes.CONTROLLER_LIMIT,
        message: 'Server controller limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
      }
      emitHandlerError(events, 'limit', error, message.payload)
      return
    }

    // Check handler concurrency (synchronous fast path)
    if (!longLived && limiter.activeHandlers >= limiter.limits.maxConcurrentHandlers) {
      const error = new HandlerError({
        code: ErrorCodes.HANDLER_LIMIT,
        message: 'Server handler limit reached',
      })
      if (message.payload.typ !== 'event') {
        context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
      }
      emitHandlerError(events, 'limit', error, message.payload)
      return
    }

    limiter.addController(rid, longLived)
    limiter.acquireHandler(longLived)

    events.emit('handlerStart', {
      rid,
      procedure: (message.payload as Record<string, unknown>).prc as string,
      type: message.payload.typ as string,
    })

    const returned = handle()
    if (returned instanceof Error) {
      limiter.removeController(rid)
      limiter.releaseHandler(longLived)
      emitHandlerError(
        events,
        'handler',
        HandlerError.from(returned, { code: ErrorCodes.HANDLER_ERROR }),
        message.payload,
      )
    } else {
      running[rid] = returned
      returned
        .then(() => {
          events.emit('handlerEnd', {
            rid,
            procedure: (message.payload as Record<string, unknown>).prc as string,
          })
          // Guard against double-release if timeout cleanup already handled this rid
          if (running[rid] === returned) {
            limiter.removeController(rid)
            limiter.releaseHandler(longLived)
            delete running[rid]
          }
        })
        .catch((err: unknown) => {
          events.emit('handlerEnd', {
            rid,
            procedure: (message.payload as Record<string, unknown>).prc as string,
          })
          if (running[rid] === returned) {
            limiter.removeController(rid)
            limiter.releaseHandler(longLived)
            delete running[rid]
          }
          emitHandlerError(
            events,
            'handler',
            HandlerError.from(err, { code: ErrorCodes.HANDLER_ERROR }),
            message.payload,
          )
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
      code: ErrorCodes.ENCRYPTION_REQUIRED,
      message: 'Encryption required but message is not encrypted',
    })
    if (message.payload.typ !== 'event') {
      context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>, {
        rid: message.payload.rid,
      })
    }
    emitHandlerError(events, 'encryption', error, message.payload)
  }

  function getParentContext(message: ProcessMessageOf<Protocol>) {
    const header = message.header as Record<string, unknown>
    return extractTraceContext(header)
  }

  function createHandleSpan(message: ProcessMessageOf<Protocol>) {
    const parentCtx = getParentContext(message)
    const procedure = (message.payload as Record<string, unknown>).prc as string | undefined
    const rid =
      'rid' in message.payload
        ? ((message.payload as Record<string, unknown>).rid as string)
        : undefined

    // Build span links from client trace context
    const header = message.header as Record<string, unknown>
    const links: Array<{
      context: { traceId: string; spanId: string; traceFlags: number; isRemote: boolean }
    }> = []
    if (typeof header.tid === 'string' && typeof header.sid === 'string') {
      links.push({
        context: {
          traceId: header.tid,
          spanId: header.sid,
          traceFlags: TraceFlags.SAMPLED,
          isRemote: true,
        },
      })
    }

    return params.tracer.startSpan(
      EnkakuSpanNames.SERVER_HANDLE,
      {
        attributes: {
          [AttributeKeys.RPC_SYSTEM]: 'enkaku',
          ...(procedure != null ? { [AttributeKeys.RPC_PROCEDURE]: procedure } : {}),
          ...(rid != null ? { [AttributeKeys.RPC_REQUEST_ID]: rid } : {}),
        },
        links,
      },
      parentCtx,
    )
  }

  function wrapHandle(
    span: Span,
    handle: () => Error | Promise<void>,
  ): () => Error | Promise<void> {
    return () => {
      const spanCtx = setSpanOnContext(undefined, span)
      const result = withActiveContext(spanCtx, () => {
        const handlerSpan = params.tracer.startSpan(EnkakuSpanNames.SERVER_HANDLER)
        const handlerResult = handle()

        if (handlerResult instanceof Error) {
          if ('code' in handlerResult) {
            handlerSpan.setAttribute(
              EnkakuAttributeKeys.ERROR_CODE,
              (handlerResult as Record<string, unknown>).code as string,
            )
          }
          handlerSpan.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, handlerResult.message)
          handlerSpan.setStatus({ code: SpanStatusCode.ERROR, message: handlerResult.message })
          handlerSpan.recordException(handlerResult)
          handlerSpan.end()
          return handlerResult
        }

        handlerResult
          .then(() => {
            handlerSpan.setStatus({ code: SpanStatusCode.OK })
            handlerSpan.end()
          })
          .catch((err: Error) => {
            if ('code' in err) {
              handlerSpan.setAttribute(
                EnkakuAttributeKeys.ERROR_CODE,
                (err as Record<string, unknown>).code as string,
              )
            }
            handlerSpan.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, err.message)
            handlerSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
            handlerSpan.recordException(err)
            handlerSpan.end()
          })

        return handlerResult
      })

      if (result instanceof Error) {
        if ('code' in result) {
          span.setAttribute(
            EnkakuAttributeKeys.ERROR_CODE,
            (result as Record<string, unknown>).code as string,
          )
        }
        span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, result.message)
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.message })
        span.recordException(result)
        span.end()
        return result
      }
      result
        .then(() => {
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
        })
        .catch((err: Error) => {
          if ('code' in err) {
            span.setAttribute(
              EnkakuAttributeKeys.ERROR_CODE,
              (err as Record<string, unknown>).code as string,
            )
          }
          span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, err.message)
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
          span.recordException(err)
          span.end()
        })
      return result
    }
  }

  const process = !params.requireAuth
    ? (message: ProcessMessageOf<Protocol>, handle: () => Error | Promise<void>) => {
        const span = createHandleSpan(message)
        if (validator != null) {
          span.addEvent('enkaku.validation', {
            [EnkakuAttributeKeys.VALIDATION_SUCCESS]: true,
          })
        }

        if (!checkMessageEncryption(message)) {
          span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, 'encryption_required')
          span.setAttribute(EnkakuAttributeKeys.ERROR_CODE, 'EK_ENCRYPTION')
          span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, 'Encryption required')
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Encryption required' })
          span.end()
          handleEncryptionViolation(message)
          return
        }

        processHandler(message, wrapHandle(span, handle))
      }
    : async (message: ProcessMessageOf<Protocol>, handle: () => Error | Promise<void>) => {
        const span = createHandleSpan(message)
        if (validator != null) {
          span.addEvent('enkaku.validation', {
            [EnkakuAttributeKeys.VALIDATION_SUCCESS]: true,
          })
        }

        try {
          if (!isSignedToken(message as Token)) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, 'unsigned_message')
            span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, false)
            throw new Error('Message is not signed')
          }
          await verifyToken(message as SignedToken, {
            cache: params.cache,
            resolver: params.resolver,
          })
          await checkClientToken(
            params.serverID,
            params.access,
            message as unknown as SignedToken,
            {
              verifyToken: params.verifyToken,
              cache: params.cache,
              resolver: params.resolver,
            },
          )
          const did = (message as unknown as SignedToken).payload.iss
          if (did != null) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_DID, did)
          }
          span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, true)
        } catch (cause) {
          const did = isSignedToken(message as Token)
            ? (message as unknown as SignedToken).payload.iss
            : undefined
          if (did != null) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_DID, did)
          }
          span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, false)
          if (!(cause as Error).message?.includes('unsigned')) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, (cause as Error).message)
          }

          const error = new HandlerError({
            cause,
            code: ErrorCodes.ACCESS_DENIED,
            message: (cause as Error).message ?? 'Access denied',
          })
          span.setAttribute(EnkakuAttributeKeys.ERROR_CODE, error.code)
          span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, error.message)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          span.recordException(error)
          span.end()

          if (message.payload.typ !== 'event') {
            context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>, {
              rid: message.payload.rid,
            })
          }
          emitHandlerError(events, 'auth', error, message.payload)
          return
        }

        if (!checkMessageEncryption(message)) {
          span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, 'encryption_required')
          span.setAttribute(EnkakuAttributeKeys.ERROR_CODE, 'EK_ENCRYPTION')
          span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, 'Encryption required')
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Encryption required' })
          span.end()
          handleEncryptionViolation(message)
          return
        }

        processHandler(message, wrapHandle(span, handle))
      }

  async function handleNext() {
    let next: ReadableStreamReadResult<AnyClientMessageOf<Protocol>>
    try {
      next = await transport.read()
    } catch (cause) {
      const error = new Error('Transport read failed', { cause })
      logger.warn('failed to read from transport', { cause })
      events.emit('transportError', { error })
      await disposer.dispose()
      return
    }
    if (next.done) {
      await disposer.dispose()
      return
    }

    const msg = processMessage(next.value)
    if (msg != null) {
      const msgSize = encoder.encode(JSON.stringify(msg.payload)).byteLength
      if (msgSize > limiter.limits.maxMessageSize) {
        const error = new HandlerError({
          code: ErrorCodes.MESSAGE_TOO_LARGE,
          message: 'Message exceeds maximum size',
        })
        if ('rid' in msg.payload && msg.payload.rid != null) {
          const rid = msg.payload.rid as string
          context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
        }
        emitHandlerError(events, 'limit', error, msg.payload)
        handleNext()
        return
      }
      switch (msg.payload.typ) {
        case 'abort': {
          const controller = controllers[msg.payload.rid]
          if (controller == null) {
            break
          }
          if (params.requireAuth) {
            if (!isSignedToken(msg as Token)) {
              const error = new HandlerError({
                code: ErrorCodes.ACCESS_DENIED,
                message: 'Abort message must be signed',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
            try {
              await verifyToken(msg as SignedToken, {
                cache: params.cache,
                resolver: params.resolver,
              })
            } catch (cause) {
              const error = new HandlerError({
                cause,
                code: ErrorCodes.ACCESS_DENIED,
                message: (cause as Error).message ?? 'Access denied',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
            const abortIssuer = (msg as unknown as SignedToken).payload.iss
            if (
              controller.issuer != null &&
              normalizeDID(abortIssuer) !== normalizeDID(controller.issuer)
            ) {
              const error = new HandlerError({
                code: ErrorCodes.ACCESS_DENIED,
                message: 'Abort issuer does not match owner',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
          }
          controller.abort(msg.payload.rsn)
          events.emit('handlerAbort', {
            rid: msg.payload.rid,
            reason: msg.payload.rsn,
          })
          break
        }
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
          // In authenticated mode, validate send messages against the channel owner
          if (params.requireAuth) {
            if (!isSignedToken(msg as Token)) {
              const error = new HandlerError({
                code: ErrorCodes.ACCESS_DENIED,
                message: 'Channel send message must be signed',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
            try {
              await verifyToken(msg as SignedToken, {
                cache: params.cache,
                resolver: params.resolver,
              })
            } catch (cause) {
              const error = new HandlerError({
                cause,
                code: ErrorCodes.ACCESS_DENIED,
                message: (cause as Error).message ?? 'Access denied',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
            const sendIssuer = (msg as unknown as SignedToken).payload.iss
            if (
              controller.issuer != null &&
              normalizeDID(sendIssuer) !== normalizeDID(controller.issuer)
            ) {
              const error = new HandlerError({
                code: ErrorCodes.ACCESS_DENIED,
                message: 'Send issuer does not match channel owner',
              })
              context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: msg.payload.rid,
              })
              emitHandlerError(events, 'auth', error, msg.payload)
              break
            }
          }
          const sendRid = msg.payload.rid
          controller.writer.write(msg.payload.val).catch((cause) => {
            const error = new Error('Failed to write to channel', { cause })
            logger.debug('failed to write send value to channel {rid}', { rid: sendRid, cause })
            events.emit('writeFailed', { error, rid: sendRid })
          })
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

export type ServerAccessOptions =
  | { identity?: undefined; requireAuth: false; accessRules?: never }
  | { identity: Identity; accessRules?: AccessRules }

export type ServerBaseParams<Protocol extends ProtocolDefinition> = {
  cache?: DIDCache
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  runtime?: Runtime
  handlers: ProcedureHandlers<Protocol>
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  resolver?: DIDResolver
  tracer?: Tracer
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
  verifyToken?: VerifyTokenHook
}

export type ServerParams<Protocol extends ProtocolDefinition> = ServerBaseParams<Protocol> &
  ServerAccessOptions

export type HandleOptions = {
  accessRules?: false | AccessRules
  logger?: Logger
  verifyToken?: VerifyTokenHook
}

export class Server<Protocol extends ProtocolDefinition> extends Disposer {
  #abortController: AbortController
  #accessControl: AccessControlParams
  #cache: DIDCache
  #resolver?: DIDResolver
  #events: ServerEmitter
  #runtime: Runtime
  #handlers: ProcedureHandlers<Protocol>
  #handling: Array<HandlingTransport<Protocol>> = []
  #limiter: ResourceLimiter
  #logger: Logger
  #tracer: Tracer
  #validator?: Validator<AnyClientMessageOf<Protocol>>

  constructor(params: ServerParams<Protocol>) {
    super({
      dispose: async (reason?: unknown) => {
        await this.#events.emit('disposing', { reason })

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

        await this.#events.emit('disposed', { reason })
      },
      signal: params.signal,
    })
    this.#abortController = new AbortController()
    this.#events = new EventEmitter<ServerEvents>()
    this.#runtime = params.runtime ?? createRuntime({ getRandomID: params.getRandomID })
    this.#handlers = params.handlers
    this.#cache = params.cache ?? createInMemoryDIDCache()
    this.#resolver = params.resolver
    const serverID = params.identity?.id
    this.#logger =
      params.logger ??
      getLogger(['enkaku', 'server'], { serverID: serverID ?? this.#runtime.getRandomID() })
    this.#tracer = params.tracer ?? defaultTracer

    const accessRules = (params as { accessRules?: AccessRules }).accessRules

    if (serverID == null) {
      if (accessRules != null) {
        throw new Error('Invalid server parameters: "accessRules" requires "identity"')
      }
      // Cast: TS doesn't narrow the ServerAccessOptions union through the
      // runtime `serverID == null` guard, so `requireAuth` isn't visible here.
      if ((params as { requireAuth?: boolean }).requireAuth !== false) {
        throw new Error(
          'Invalid server parameters: a server without "identity" must explicitly pass "requireAuth: false" to disable authentication',
        )
      }
      this.#accessControl = {
        requireAuth: false,
        access: {},
        encryptionPolicy: params.encryptionPolicy,
        verifyToken: params.verifyToken,
        cache: this.#cache,
        resolver: this.#resolver,
      }
    } else {
      this.#accessControl = {
        requireAuth: true,
        serverID,
        access: accessRules ?? {},
        encryptionPolicy: params.encryptionPolicy,
        verifyToken: params.verifyToken,
        cache: this.#cache,
        resolver: this.#resolver,
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

  get activeTransportsCount(): number {
    return this.#handling.length
  }

  get events(): ServerEmitter {
    return this.#events
  }

  handle(transport: ServerTransportOf<Protocol>, options: HandleOptions = {}): Promise<void> {
    const accessRulesOverride = options.accessRules
    const logger =
      options.logger ??
      this.#logger.getChild('handler').with({ transportID: this.#runtime.getRandomID() })

    const encryptionPolicy = this.#accessControl.encryptionPolicy

    let accessControl: AccessControlParams
    if (accessRulesOverride === false) {
      accessControl = {
        requireAuth: false,
        access: this.#accessControl.access ?? {},
        encryptionPolicy,
        verifyToken: options.verifyToken ?? this.#accessControl.verifyToken,
        cache: this.#cache,
        resolver: this.#resolver,
      }
    } else if (accessRulesOverride != null) {
      // Override with AccessRules record
      const serverID = this.#accessControl.serverID
      if (serverID == null) {
        return Promise.reject(
          new Error('Server identity is required to enable access control on transport'),
        )
      }
      accessControl = {
        requireAuth: true,
        serverID,
        access: accessRulesOverride,
        encryptionPolicy,
        verifyToken: options.verifyToken ?? this.#accessControl.verifyToken,
        cache: this.#cache,
        resolver: this.#resolver,
      }
    } else {
      // Use server-level defaults
      accessControl = {
        ...this.#accessControl,
        verifyToken: options.verifyToken ?? this.#accessControl.verifyToken,
      }
    }

    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      limiter: this.#limiter,
      logger,
      signal: this.#abortController.signal,
      tracer: this.#tracer,
      transport,
      validator: this.#validator,
      ...accessControl,
    })
    const handling: HandlingTransport<Protocol> = { done, transport }
    this.#handling.push(handling)

    const transportID = this.#runtime.getRandomID()
    this.#events.emit('transportAdded', { transportID })
    logger.info('added')
    return done.then(() => {
      const index = this.#handling.indexOf(handling)
      if (index !== -1) {
        this.#handling.splice(index, 1)
      }
      logger.info('done')
      this.#events.emit('transportRemoved', { transportID })
    })
  }
}

export type ServeParams<Protocol extends ProtocolDefinition> = Omit<
  ServerBaseParams<Protocol>,
  'transports'
> & {
  transport: ServerTransportOf<Protocol>
} & ServerAccessOptions

export function serve<Protocol extends ProtocolDefinition>(
  params: ServeParams<Protocol>,
): Server<Protocol> {
  const { transport, ...rest } = params
  return new Server<Protocol>({ ...rest, transports: [transport] } as ServerParams<Protocol>)
}
