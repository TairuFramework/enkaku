import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '@enkaku/otel'
import {
  type AbortCallPayload,
  type AnyClientMessageOf,
  type AnyServerPayloadOf,
  createClientMessageSchema,
  ErrorCodes,
  type ProtocolDefinition,
  type SendCallPayload,
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
import {
  checkReplay,
  type ReplayCheckResult,
  type ReplayOptions,
  type ResolvedReplay,
  resolveReplay,
} from './replay.js'
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
  replay?: ResolvedReplay | null
  runtime: Runtime
  signal: AbortSignal
  tracer: Tracer
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}

async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { events, handlers, limiter, logger, replay, runtime, signal, transport, validator } =
    params

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
  /**
   * Per-rid barrier for the auth-mode `process`, which is async and therefore
   * un-awaited by the `handleNext` switch. `send` and `abort` chain their
   * controller lookup onto the entry for their rid, so a message arriving right
   * behind the call that creates the controller cannot overtake it. Distinct
   * rids never wait on each other, and the read loop never waits at all.
   */
  const pending: Record<string, Promise<void>> = Object.create(null)

  function track(rid: string, result: void | Promise<void>): void {
    if (!(result instanceof Promise)) {
      // Non-auth mode: `process` is synchronous and the controller is already
      // registered by the time it returns.
      return
    }
    // Failures are surfaced by `process` itself; this barrier only cares that
    // the attempt has finished.
    const tracked = result.then(
      () => {},
      () => {},
    )
    pending[rid] = tracked
    void tracked.then(() => {
      if (pending[rid] === tracked) {
        delete pending[rid]
      }
    })
  }

  /**
   * Deliver a control message (`send`/`abort`) after any in-flight auth for its
   * rid, without ever blocking the transport read loop: `handleNext` only reads
   * the next message once the switch body returns, and the promise being waited
   * on runs the user-supplied async `allow` predicate. Awaiting it here would let
   * one slow access check stall every other client sharing the transport (all SSE
   * sessions of `@enkaku/http-serve` are multiplexed over a single one).
   *
   * So we chain instead of awaiting: with nothing pending for the rid — always
   * the case in non-auth mode — the delivery runs synchronously, otherwise it is
   * queued onto the barrier and the resulting chain becomes the new barrier, so a
   * later control message for the same rid still queues behind this one.
   */
  function deliverInOrder(
    rid: string,
    payload: { typ: string } & Record<string, unknown>,
    deliver: () => void,
  ): void {
    const prior = pending[rid]
    if (prior == null) {
      deliver()
      return
    }
    const run = () => {
      try {
        deliver()
      } catch (cause) {
        // `deliver()` cannot actually throw synchronously (context.send and
        // events.emit never throw, and controller.writer.write() rejects rather
        // than throws with its own .catch), so this is a floating-rejection
        // guard: keep it, but only log — there is no well-typed HandlerError
        // messageType for an arbitrary control message here, and no public
        // event shape to invent one for.
        logger.warn('failed to deliver {typ} message for {rid}', {
          typ: payload.typ,
          rid,
          cause,
        })
      }
    }
    // A rejected barrier still delivers: an auth failure leaves no controller
    // registered, so the delivery drops the message, which is the intended
    // outcome. Handling both settlements keeps `chained` non-rejecting.
    const chained = prior.then(run, run)
    pending[rid] = chained
    void chained.then(() => {
      if (pending[rid] === chained) {
        delete pending[rid]
      }
    })
  }
  const encoder = new TextEncoder()

  // Standard replay rejection for control messages (send/abort): reply to the
  // client by rid and emit an auth-category handlerError. The process path has
  // its own span-aware variant inline.
  function rejectReplay(rid: string, payload: { typ: string } & Record<string, unknown>): void {
    const error = new HandlerError({
      code: ErrorCodes.REPLAY_DETECTED,
      message: 'Replay detected',
    })
    context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
    emitHandlerError(events, 'auth', error, payload)
  }

  /**
   * Abort a running handler without touching limiter bookkeeping: the handler's
   * own completion path in `processHandler` releases its controller and slot,
   * guarded by `running[rid] === returned`. Doing it here as well would release
   * twice. (The timeout sweep is different — there the handler is abandoned, so
   * it does the bookkeeping itself.)
   */
  function abortRunningHandler(rid: string, reason: unknown): void {
    const controller = controllers[rid]
    if (controller == null) {
      return
    }
    controller.abort(reason)
    events.emit('handlerAbort', { rid, reason })
  }

  // Trusted: TransportEvents is an in-process emitter, so `requestAborted` can
  // only come from the transport implementation, never from the wire.
  const unsubscribeRequestAborted = transport.events.on('requestAborted', ({ rid, reason }) => {
    abortRunningHandler(rid, reason)
  })

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
      // Drain the per-rid barrier first: in `requireAuth` mode `process` is
      // async, so a message whose access check is still in flight has not
      // registered its controller yet — aborting now would miss it and the
      // handler would start, with a signal nothing can ever abort, after
      // `dispose()` resolved. `deliverInOrder` chains onto the same map, so
      // this also drains control messages queued behind an auth check.
      // Entries never reject (`track` and `deliverInOrder` swallow both
      // settlements), and the wait is bounded by `cleanupTimeoutMs`, which
      // `Server.dispose` already races against, so it cannot hang shutdown.
      await Promise.all(Object.values(pending))
      const interruption = new DisposeInterruption()
      // Abort all currently running handlers
      for (const rid of Object.keys(controllers)) {
        controllers[rid]?.abort(interruption)
        events.emit('handlerAbort', { rid, reason: interruption })
      }
      // Wait until all running handlers are done
      await Promise.all(Object.values(running))
      // Unsubscribe last: until the handlers above are done, a peer going away
      // can still abort one of them through `requestAborted`.
      unsubscribeRequestAborted()
      // On every route where this disposer disposes itself (replay-cache
      // throw, transport read error, `next.done`), `Server.handle()` splices
      // the handling entry out of `#handling` as soon as `disposer.disposed`
      // (which IS `handling.done`) resolves -- so `Server.dispose()`'s own
      // `handling.transport.dispose()` call and its force-dispose path never
      // get a chance to run for this transport. Nothing else would close it.
      // Dispose it here, after the `running` drain above, so handlers get
      // their chance to flush a final reply first. `Transport.dispose()` is
      // idempotent, so `Server.dispose()` disposing it again afterwards
      // (when this route runs from inside a still-live server, not one of
      // its own self-dispose routes) is harmless.
      //
      // Bounded, not a bare `await`: this whole function IS `disposer.disposed`,
      // which IS `handling.done`, which is what the promise returned by
      // `Server.handle()` resolves on -- so a third-party transport whose
      // `dispose()` never settles (e.g. `writer.close()` parked on an
      // unflushable sink) would leave `handle()` pending forever. `@enkaku/socket`
      // bounds its own dispose (`END_GRACE_MS`), but nothing here can assume a
      // third-party transport does the same, so race it against the same
      // `cleanupTimeoutMs` bound `Server.dispose()` already uses for its own
      // force-dispose path, and proceed without throwing on timeout. The
      // `.catch` exists only so a `transport.dispose()` that eventually settles
      // (or rejects) after we've already moved on doesn't surface as an
      // unhandled rejection.
      //
      // `Promise.race` does not cancel the loser, so the timer MUST be cleared in a
      // `finally`. This disposer runs on every normal client hang-up, and
      // `transport.dispose()` wins that race every time -- leaving one live
      // `cleanupTimeoutMs` timer per disconnect, each holding the event loop open
      // for 30s while the transport count already reports clean. `clearTimeout`,
      // not `unref()`: `@enkaku/server` is isomorphic and `unref()` is Node-only.
      let disposeTimer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          transport.dispose().catch(() => {}),
          new Promise<void>((resolve) => {
            disposeTimer = setTimeout(resolve, limiter.limits.cleanupTimeoutMs)
          }),
        ])
      } finally {
        clearTimeout(disposeTimer)
      }
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

        // Replay check runs after the encryption gate so a message that fails
        // encryption does not consume its dedup key (a corrected retry may reuse jti).
        if (replay != null) {
          let replayResult: ReplayCheckResult
          try {
            replayResult = await checkReplay(message as unknown as SignedToken, replay)
          } catch (cause) {
            const error = new Error('Replay cache check failed', { cause })
            logger.warn('replay cache check failed', { cause })
            events.emit('transportError', { error })
            // NOT awaited: this `process()` call is itself an entry in `pending`,
            // and the disposer awaits every entry in `pending` before it does
            // anything else -- so awaiting here deadlocks the graceful path and
            // strands shutdown until cleanupTimeoutMs (30s) force-disposes.
            // dispose() aborts its signal synchronously, so handleNext's bail
            // still sees it on the very next read.
            void disposer.dispose()
            return
          }
          if (!replayResult.ok) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, replayResult.reason)
            span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, false)
            const error = new HandlerError({
              code: ErrorCodes.REPLAY_DETECTED,
              message: 'Replay detected',
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

    // Disposal has begun: the abort-all sweep may already have run, so a handler
    // registered from here on would hold a controller nothing will ever abort and
    // would run to completion after dispose() resolved. Drop the message and stop
    // reading.
    //
    // `disposer.signal`, not the `signal` param: the async `process()` disposes the
    // disposer directly when the replay cache throws, and on that route the server's
    // #abortController -- which is what arrives as `signal` -- is never aborted at
    // all, while this loop keeps running. Only the disposer's own signal is aborted
    // on every route, because Disposer.dispose() calls this.abort().
    if (disposer.signal.aborted) {
      logger.warn('dropped message received while disposing', {
        typ: (next.value as { payload?: { typ?: unknown } }).payload?.typ,
      })
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
          // Verify signature and replay before looking up the controller so a replayed
          // abort still surfaces EK09 even when its target controller is already gone.
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
            if (replay != null) {
              let replayResult: ReplayCheckResult
              try {
                replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              } catch (cause) {
                const error = new Error('Replay cache check failed', { cause })
                logger.warn('replay cache check failed', { cause })
                events.emit('transportError', { error })
                await disposer.dispose()
                return
              }
              if (!replayResult.ok) {
                rejectReplay(msg.payload.rid, msg.payload)
                break
              }
            }
          }
          // Deliver behind any in-flight auth for this rid so the controller it
          // will register is visible. Placed after this message's own signature
          // and replay checks, so a forged abort cannot make the server queue work.
          // Cast: the switch discriminates `msg.payload`, but the narrowing is not
          // carried into the closure below, so name the payload type here.
          const abortPayload = msg.payload as AbortCallPayload
          const abortRID = abortPayload.rid
          deliverInOrder(abortRID, abortPayload, () => {
            const controller = controllers[abortRID]
            if (controller == null) {
              return
            }
            if (params.requireAuth) {
              const abortIssuer = (msg as unknown as SignedToken).payload.iss
              if (
                controller.issuer != null &&
                normalizeDID(abortIssuer) !== normalizeDID(controller.issuer)
              ) {
                const error = new HandlerError({
                  code: ErrorCodes.ACCESS_DENIED,
                  message: 'Abort issuer does not match owner',
                })
                context.send(error.toPayload(abortRID) as AnyServerPayloadOf<Protocol>, {
                  rid: abortRID,
                })
                emitHandlerError(events, 'auth', error, abortPayload)
                return
              }
            }
            abortRunningHandler(abortRID, abortPayload.rsn)
          })
          break
        }
        case 'channel': {
          const message = msg as ChannelMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleChannel(context, message)),
          )
          break
        }
        case 'event': {
          const message = msg as EventMessageOf<Protocol>
          // Events carry no rid, so key the barrier on a fresh random one. Nothing
          // can address that key -- no `send`/`abort` can target it and no other
          // message can collide with it -- so the entry only ever gates the
          // disposer's drain below, which is exactly what it is for: in auth mode
          // `process` is async, and an event whose access check is still in flight
          // must not be left running past `dispose()`. It registers no controller,
          // so events stay fire-and-forget and un-abortable, as designed.
          track(
            runtime.getRandomID(),
            process(message, () => handleEvent(context, message)),
          )
          break
        }
        case 'request': {
          const message = msg as unknown as RequestMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleRequest(context, message)),
          )
          break
        }
        case 'send': {
          // In authenticated mode, verify signature and replay before the controller
          // lookup so a replayed send still surfaces EK09 even when its target channel
          // is already gone.
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
            if (replay != null) {
              let replayResult: ReplayCheckResult
              try {
                replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              } catch (cause) {
                const error = new Error('Replay cache check failed', { cause })
                logger.warn('replay cache check failed', { cause })
                events.emit('transportError', { error })
                await disposer.dispose()
                return
              }
              if (!replayResult.ok) {
                rejectReplay(msg.payload.rid, msg.payload)
                break
              }
            }
          }
          // Deliver behind any in-flight auth for this rid so the channel it will
          // register is visible. Placed after this message's own signature and
          // replay checks, so a forged send cannot make the server queue work.
          // Cast: the switch discriminates `msg.payload`, but the narrowing is not
          // carried into the closure below, so name the payload type here.
          const sendPayload = msg.payload as SendCallPayload<string, unknown>
          const sendRID = sendPayload.rid
          deliverInOrder(sendRID, sendPayload, () => {
            const controller = controllers[sendRID] as ChannelController | undefined
            if (controller == null) {
              logger.debug('received send for unknown channel {rid}', { rid: sendRID })
              return
            }
            // In authenticated mode, validate send messages against the channel owner
            if (params.requireAuth) {
              const sendIssuer = (msg as unknown as SignedToken).payload.iss
              if (
                controller.issuer != null &&
                normalizeDID(sendIssuer) !== normalizeDID(controller.issuer)
              ) {
                const error = new HandlerError({
                  code: ErrorCodes.ACCESS_DENIED,
                  message: 'Send issuer does not match channel owner',
                })
                context.send(error.toPayload(sendRID) as AnyServerPayloadOf<Protocol>, {
                  rid: sendRID,
                })
                emitHandlerError(events, 'auth', error, sendPayload)
                return
              }
            }
            controller.writer.write(sendPayload.val).catch((cause) => {
              const error = new Error('Failed to write to channel', { cause })
              logger.debug('failed to write send value to channel {rid}', { rid: sendRID, cause })
              events.emit('writeFailed', { error, rid: sendRID })
            })
          })
          break
        }
        case 'stream': {
          const message = msg as unknown as StreamMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleStream(context, message)),
          )
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
  /**
   * Must be collision-resistant. Defaults to `crypto.randomUUID()`.
   *
   * Events carry no `rid` of their own, so the server mints one from this to key
   * the event's in-flight access check in its dispose barrier. That synthetic ID
   * shares a namespace with real message `rid`s: an ID that collided with one
   * would let a client's `send`/`abort` queue behind the event's access check
   * instead of its own, reordering or dropping it. A counter or any other
   * non-unique override is therefore unsafe here.
   */
  getRandomID?: () => string
  runtime?: Runtime
  handlers: ProcedureHandlers<Protocol>
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  replay?: ReplayOptions
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
  #replay: ResolvedReplay | null
  #tracer: Tracer
  #validator?: Validator<AnyClientMessageOf<Protocol>>

  constructor(params: ServerParams<Protocol>) {
    super({
      dispose: async (reason?: unknown) => {
        // Disposer wires an already-aborted `params.signal` to dispose()
        // synchronously inside its own (super) constructor, i.e. before this
        // derived constructor's body -- and therefore `this` -- has finished
        // initializing. Yielding a microtask here defers every subsequent
        // access of `this` until after the constructor returns, whichever
        // path triggered dispose(). Do not remove this even though it looks
        // like a no-op: without it, an already-aborted signal throws a
        // ReferenceError that Disposer swallows, and disposal silently
        // never happens.
        await Promise.resolve()
        await this.#events.emit('disposing', { reason })

        // Signal messages handler to stop execution and run cleanup logic
        this.#abortController.abort()

        const cleanupTimeout = this.#limiter.limits.cleanupTimeoutMs

        // Both races below arm a timer that the winning promise does not cancel --
        // `Promise.race` never cancels the loser -- so each is cleared in a
        // `finally`. Left armed, the graceful timer holds the event loop open for
        // `cleanupTimeoutMs` after `dispose()` has already resolved. `clearTimeout`,
        // not `unref()`: `@enkaku/server` is isomorphic and `unref()` is Node-only.
        let gracefulTimer: ReturnType<typeof setTimeout> | undefined
        let gracefulDone: boolean
        try {
          // Race between graceful cleanup and timeout
          gracefulDone = await Promise.race([
            Promise.all(
              this.#handling.map(async (handling) => {
                // Wait until all handlers are done - they might still need to flush messages to the transport
                await handling.done
                // Dispose transport
                await handling.transport.dispose()
              }),
            ).then(() => true),
            new Promise<boolean>((resolve) => {
              gracefulTimer = setTimeout(() => resolve(false), cleanupTimeout)
            }),
          ])
        } finally {
          clearTimeout(gracefulTimer)
        }

        // Force dispose any remaining transports only if timed out
        if (!gracefulDone) {
          // This backstop must itself be bounded, and must not be serial.
          //
          // Bounded: a bare `await handling.transport.dispose()` here is unbounded,
          // and this path is reached precisely when something did not settle in
          // time. `Disposer.dispose()` hands back the same never-settling deferred
          // on a second call, so a transport whose `dispose()` never resolves would
          // hang `Server.dispose()` FOREVER -- turning the bound added to protect
          // `Server.handle()` into an unbounded wait here.
          //
          // Parallel: one hostile transport must not delay disposal of every
          // transport after it in the list.
          //
          // Snapshot (`[...]`): `handle()`'s `done.then()` splices entries out of
          // `this.#handling` as each one settles. Against the SERIAL loop this
          // replaced, that splice could interleave with the iteration and skip an
          // element. `.map()` below is synchronous, so nothing can interleave with
          // it and the copy is belt-and-braces today -- it is kept so that adding
          // an `await` inside this body cannot silently reintroduce the skip.
          let forceTimer: ReturnType<typeof setTimeout> | undefined
          try {
            await Promise.race([
              Promise.all(
                // `.catch`: ignore errors during forced cleanup, and keep a
                // late-settling rejection from surfacing as an unhandled one.
                [...this.#handling].map((handling) => handling.transport.dispose().catch(() => {})),
              ),
              new Promise<void>((resolve) => {
                forceTimer = setTimeout(resolve, cleanupTimeout)
              }),
            ])
          } finally {
            clearTimeout(forceTimer)
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

    this.#replay = resolveReplay(params.replay, this.#accessControl.requireAuth)

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
      replay: this.#replay,
      runtime: this.#runtime,
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
