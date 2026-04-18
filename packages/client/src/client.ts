import { Disposer, defer } from '@enkaku/async'
import { EventEmitter } from '@enkaku/event'
import { getEnkakuLogger, type Logger } from '@enkaku/log'
import {
  AttributeKeys,
  createTracer,
  injectTraceContext as otelInjectTraceContext,
  type Span,
  SpanNames,
  SpanStatusCode,
  setSpanOnContext,
  type Tracer,
  withActiveContext,
  withSpan,
} from '@enkaku/otel'
import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyProcedureDefinition,
  AnyRequestProcedureDefinition,
  AnyServerMessageOf,
  ChannelProcedureDefinition,
  ClientTransportOf,
  DataOf,
  EventProcedureDefinition,
  ProtocolDefinition,
  RequestProcedureDefinition,
  RequestType,
  ReturnOf,
  StreamProcedureDefinition,
} from '@enkaku/protocol'
import { createRuntime, type Runtime } from '@enkaku/runtime'
import { createPipe, writeTo } from '@enkaku/stream'
import { createUnsignedToken, type Identity, isSigningIdentity } from '@enkaku/token'
import { RequestError } from './error.js'
import type { ClientEmitter, ClientEvents } from './events.js'
import { safeWrite, type WriteTarget } from './safe-write.js'

const defaultTracer = createTracer('client')

type FilterNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }

export type AnyHeader = Record<string, unknown>

export type RequestMeta = {
  type: RequestType
  procedure: string
}

export type RequestCall<Result> = Promise<Result> &
  RequestMeta & {
    id: string
    abort: (reason?: string) => void
    signal: AbortSignal
  }

export type StreamCall<Receive, Result> = RequestCall<Result> & {
  close: () => void
  procedure: string
  readable: ReadableStream<Receive>
}

export type ChannelCall<Receive, Send, Result> = StreamCall<Receive, Result> & {
  send: (value: Send) => Promise<void>
  writable: WritableStream<Send>
}

export type EventDefinitionsType<Protocol extends ProtocolDefinition> = FilterNever<{
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition
    ? { Data: DataOf<Protocol[Procedure]['data']> }
    : never
}>

export type RequestDefinitionsType<Protocol extends ProtocolDefinition> = FilterNever<{
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends RequestProcedureDefinition
    ? {
        Param: DataOf<Protocol[Procedure]['param']>
        Result: ReturnOf<Protocol[Procedure]['result']>
      }
    : never
}>

export type StreamDefinitionsType<Protocol extends ProtocolDefinition> = FilterNever<{
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends StreamProcedureDefinition
    ? {
        Param: Protocol[Procedure]['param'] extends undefined
          ? never
          : DataOf<Protocol[Procedure]['param']>
        Receive: DataOf<Protocol[Procedure]['receive']>
        Result: ReturnOf<Protocol[Procedure]['result']>
      }
    : never
}>

export type ChannelDefinitionsType<Protocol extends ProtocolDefinition> = FilterNever<{
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends ChannelProcedureDefinition
    ? {
        Param: DataOf<Protocol[Procedure]['param']>
        Receive: DataOf<Protocol[Procedure]['receive']>
        Result: ReturnOf<Protocol[Procedure]['result']>
        Send: DataOf<Protocol[Procedure]['send']>
      }
    : never
}>

export type ClientDefinitionsType<Protocol extends ProtocolDefinition> = {
  Channels: ChannelDefinitionsType<Protocol>
  Events: EventDefinitionsType<Protocol>
  Requests: RequestDefinitionsType<Protocol>
  Streams: StreamDefinitionsType<Protocol>
}

export type CallArgumentType<Procedure extends AnyProcedureDefinition> =
  Procedure extends EventProcedureDefinition
    ? Procedure['data']
    : Procedure extends AnyRequestProcedureDefinition
      ? Procedure['param']
      : never

export type RequestArguments<Param> = Param extends never
  ? [config?: { param?: never; signal?: AbortSignal }]
  : [config: { param: Param; signal?: AbortSignal }]

type RequestController<Result> = AbortController &
  RequestMeta & {
    result: Promise<Result>
    ok: (value: Result) => void
    error: (error: RequestError) => void
    aborted: (signal: AbortSignal) => void
    header?: AnyHeader
  }

type StreamController<Receive, Result> = RequestController<Result> & {
  receive: WritableStreamDefaultWriter<Receive>
}

type AnyClientController =
  // biome-ignore lint/suspicious/noExplicitAny: what other way to type this?
  RequestController<any> | StreamController<any, any>

type CreateControllerParams = RequestMeta & {
  header?: AnyHeader
}

function createController<T>(
  params: CreateControllerParams,
  onDone?: () => void,
): RequestController<T> {
  const deferred = defer<T>()
  return Object.assign(new AbortController(), params, {
    result: deferred.promise,
    ok: (value: T) => {
      deferred.resolve(value)
      onDone?.()
    },
    error: (error: RequestError) => {
      deferred.reject(error)
      onDone?.()
    },
    aborted: (signal: AbortSignal) => {
      deferred.reject(signal.reason)
      onDone?.()
    },
  })
}

type CreateRequestParams<Result> = {
  id: string
  controller: RequestController<Result>
  signal: AbortSignal
  sent: Promise<unknown>
}

function createRequest<Result>({
  controller,
  sent,
  ...call
}: CreateRequestParams<Result>): RequestCall<Result> {
  const abort = (reason?: string) => {
    void sent.then(() => {
      controller.abort(reason)
    })
  }
  return Object.assign(
    sent.then(() => controller.result),
    call,
    { type: controller.type, procedure: controller.procedure, abort },
  )
}

type CreateStreamParams<Receive, Result> = CreateRequestParams<Result> & {
  readable: ReadableStream<Receive>
}

function createStream<Receive, Result>({
  readable,
  ...requestParams
}: CreateStreamParams<Receive, Result>): StreamCall<Receive, Result> {
  const request = createRequest(requestParams)
  return Object.assign(request, { close: () => request.abort('Close'), readable })
}

type CreateMessage<Protocol extends ProtocolDefinition> = (
  payload: AnyClientPayloadOf<Protocol>,
  header?: Record<string, unknown>,
) => AnyClientMessageOf<Protocol> | Promise<AnyClientMessageOf<Protocol>>

function getCreateMessage<Protocol extends ProtocolDefinition>(
  identity?: Identity | Promise<Identity>,
  aud?: string,
): CreateMessage<Protocol> {
  if (identity == null) {
    return createUnsignedToken
  }

  const identityPromise = Promise.resolve(identity)
  const createToken = (payload: Record<string, unknown>, header?: AnyHeader) => {
    return identityPromise.then((id) => {
      if (!isSigningIdentity(id)) {
        throw new Error('Identity does not support signing')
      }
      return id.signToken(payload, header)
    })
  }

  return (
    aud ? (payload, header) => createToken({ aud, ...payload }, header) : createToken
  ) as CreateMessage<Protocol>
}

export type ClientParams<Protocol extends ProtocolDefinition> = {
  getRandomID?: () => string
  runtime?: Runtime
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  logger?: Logger
  tracer?: Tracer
  transport: ClientTransportOf<Protocol>
  serverID?: string
  identity?: Identity | Promise<Identity>
}

export class Client<
  Protocol extends ProtocolDefinition,
  ClientDefinitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
> extends Disposer {
  #controllers: Record<string, AnyClientController> = {}
  #createMessage: CreateMessage<Protocol>
  #runtime: Runtime
  #spans: Record<string, Span> = {}
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  #handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  #handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  #logger: Logger
  #tracer: Tracer
  #transport: ClientTransportOf<Protocol>
  #events: ClientEmitter = new EventEmitter<ClientEvents>()

  constructor(params: ClientParams<Protocol>) {
    super({
      dispose: async (reason?: unknown) => {
        await this.#events.emit('disposing', { reason })
        this.#abortControllers(reason)
        await this.#transport.dispose(reason)
        await this.#events.emit('disposed', { reason })
        this.#logger.debug('disposed')
      },
    })
    this.#createMessage = getCreateMessage<Protocol>(params.identity, params.serverID)
    this.#runtime = params.runtime ?? createRuntime({ getRandomID: params.getRandomID })
    this.#handleTransportDisposed = params.handleTransportDisposed
    this.#handleTransportError = params.handleTransportError
    this.#logger =
      params.logger ?? getEnkakuLogger('client', { clientID: this.#runtime.getRandomID() })
    this.#tracer = params.tracer ?? defaultTracer
    this.#transport = params.transport
    // Start reading from transport
    this.#setupTransport()
  }

  #abortControllers(reason?: unknown): void {
    // Runs during dispose (where this.signal is already aborted by the base
    // Disposer) and on transport replacement. Clearing the map after the loop
    // makes re-entry a no-op, so no guard is needed.
    for (const controller of Object.values(this.#controllers)) {
      controller.abort(reason)
    }
    this.#controllers = {}
  }

  #setupTransport(): void {
    this.#transport.disposed.then(() => {
      if (this.signal.aborted) {
        return
      }
      const newTransport = this.#handleTransportDisposed?.(this.#transport.signal)
      if (newTransport == null) {
        this.#logger.debug('transport disposed')
        // Abort client if no new transport is provided
        this.abort('TransportDisposed')
      } else {
        this.#logger.debug('using new transport provided by transport disposed handler')
        // Abort running procedures and start using new transport
        this.#abortControllers('TransportDisposed')
        this.#transport = newTransport
        this.#events.emit('transportReplaced', {})
        this.#setupTransport()
      }
    })
    this.#read()
  }

  #endSpanOnResult(
    span: Span,
    result: Promise<unknown>,
    meta: { rid: string; procedure: string },
  ): void {
    result.then(
      () => {
        span.setStatus({ code: SpanStatusCode.OK })
        span.end()
        this.#events.emit('requestEnd', { ...meta, status: 'ok' })
        delete this.#spans[meta.rid]
      },
      (error) => {
        if (error instanceof RequestError) {
          span.setAttribute(AttributeKeys.ERROR_CODE, error.code)
          span.setAttribute(AttributeKeys.ERROR_MESSAGE, error.message)
        }
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        span.recordException(error instanceof Error ? error : new Error(String(error)))
        span.end()
        const status: 'ok' | 'error' | 'aborted' =
          error === 'Close' || (error as { name?: string } | null)?.name === 'AbortError'
            ? 'aborted'
            : 'error'
        this.#events.emit('requestEnd', { ...meta, status })
        delete this.#spans[meta.rid]
      },
    )
  }

  async #read() {
    while (true) {
      let msg: AnyServerMessageOf<Protocol>
      try {
        const next = await this.#transport.read()
        if (next.done) {
          return
        }
        msg = next.value
      } catch (cause) {
        if (this.signal.aborted) {
          return
        }
        this.#logger.debug('failed to read from transport', { cause })
        const error = new Error('Transport read failed', { cause })
        this.#events.emit('transportError', { error })
        const newTransport = this.#handleTransportError?.(error)
        if (newTransport == null) {
          this.#logger.warn('aborting following unhanded transport error')
          // Abort client if no new transport is provided
          this.abort(error)
        } else {
          this.#logger.debug('using new transport provided by transport error handler')
          // Abort running procedures and start using new transport
          this.#abortControllers(error)
          this.#transport = newTransport
          this.#events.emit('transportReplaced', {})
          this.#setupTransport()
        }
        return
      }

      const controller = this.#controllers[msg.payload.rid]
      if (controller == null) {
        this.#logger.warn('controller not found for request {rid}', {
          rid: msg.payload.rid,
        })
        continue
      }

      switch (msg.payload.typ) {
        case 'error': {
          const error = RequestError.fromPayload(msg.payload)
          this.#logger.debug('error reply for {type} {procedure} with ID {rid}: {error}', {
            type: controller.type,
            procedure: controller.procedure,
            rid: msg.payload.rid,
            error,
          })
          controller.error(error)
          delete this.#controllers[msg.payload.rid]
          break
        }
        case 'receive': {
          this.#logger.trace('receive reply for {type} {procedure} with ID {rid}: {receive}', {
            type: controller.type,
            procedure: controller.procedure,
            rid: msg.payload.rid,
            receive: msg.payload.val,
          })
          const receiveSpan = this.#spans[msg.payload.rid]
          if (receiveSpan != null) {
            receiveSpan.addEvent('stream.message.received', {
              [AttributeKeys.MESSAGE_DIRECTION]: 'receive',
            })
          }
          void (controller as StreamController<unknown, unknown>).receive
            ?.write(msg.payload.val)
            .catch(() => {})
          break
        }
        case 'result':
          this.#logger.trace('result reply for {type} {procedure} with ID {rid}: {result}', {
            type: controller.type,
            procedure: controller.procedure,
            rid: msg.payload.rid,
            result: msg.payload.val,
          })
          controller.ok(msg.payload.val)
          delete this.#controllers[msg.payload.rid]
          break
      }
    }
  }

  async #write(
    payload: AnyClientPayloadOf<Protocol>,
    header?: AnyHeader,
    rid?: string,
  ): Promise<void> {
    if (this.signal.aborted) {
      throw new Error('Client aborted', { cause: this.signal.reason })
    }
    const baseHeader = header ?? {}
    const enrichedHeader = otelInjectTraceContext(baseHeader)
    const finalHeader = Object.keys(enrichedHeader).length > 0 ? enrichedHeader : undefined
    const message = await this.#createMessage(payload, finalHeader)
    await safeWrite({
      transport: this.#transport as unknown as WriteTarget,
      message,
      rid,
      events: this.#events,
      signal: this.signal,
    })
  }

  // Fire-and-forget abort notification for `#handleSignal`. Never rejects:
  // benign teardown errors are absorbed by `safeWrite`, other failures surface
  // via `requestError` so consumers can observe them without each abort site
  // needing its own `.catch` handler.
  #notifyAbort(rid: string, reason: unknown, header?: AnyHeader): void {
    void (async () => {
      try {
        await this.#write(
          {
            typ: 'abort',
            rid,
            rsn: reason,
          } as unknown as AnyClientPayloadOf<Protocol>,
          header,
          rid,
        )
      } catch (error) {
        if (!this.signal.aborted) {
          await this.#events.emit('requestError', { rid, error: error as Error })
        }
      }
    })()
  }

  #handleSignal<Result>(
    rid: string,
    controller: RequestController<Result>,
    providedSignal?: AbortSignal,
  ): AbortSignal {
    const signal = providedSignal
      ? AbortSignal.any([controller.signal, providedSignal])
      : controller.signal
    signal.addEventListener(
      'abort',
      () => {
        const reason = signal.reason?.name ?? signal.reason
        this.#logger.trace('abort {type} {procedure} with ID {rid} and reason: {reason}', {
          type: controller.type,
          procedure: controller.procedure,
          rid,
          reason,
        })
        this.#notifyAbort(rid, reason, controller.header)
        controller.aborted(signal)
        delete this.#controllers[rid]
      },
      { once: true },
    )
    return signal
  }

  get events(): ClientEmitter {
    return this.#events
  }

  async sendEvent<
    Procedure extends keyof ClientDefinitions['Events'] & string,
    T extends ClientDefinitions['Events'][Procedure] = ClientDefinitions['Events'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Data'] extends never
      ? [config?: { data?: never; header?: AnyHeader }]
      : [config: { data: T['Data']; header?: AnyHeader }]
  ): Promise<void> {
    const config = args[0] ?? {}
    return withSpan(
      this.#tracer,
      SpanNames.CLIENT_CALL,
      {
        attributes: {
          [AttributeKeys.RPC_SYSTEM]: 'enkaku',
          [AttributeKeys.RPC_PROCEDURE]: procedure,
          [AttributeKeys.RPC_TYPE]: 'event',
        },
      },
      async () => {
        const data = config.data
        const payload = data
          ? { typ: 'event', prc: procedure, data }
          : { typ: 'event', prc: procedure }
        if (data == null) {
          this.#logger.trace('send event {procedure} without data', { procedure })
        } else {
          this.#logger.trace('send event {procedure} with data: {data}', { procedure, data })
        }
        await this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
      },
    )
  }

  request<
    Procedure extends keyof ClientDefinitions['Requests'] & string,
    T extends ClientDefinitions['Requests'][Procedure] = ClientDefinitions['Requests'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { header?: AnyHeader; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { header?: AnyHeader; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): RequestCall<T['Result']> & Promise<T['Result']> {
    const config = args[0] ?? {}
    const rid = config.id ?? this.#runtime.getRandomID()

    const span = this.#tracer.startSpan(SpanNames.CLIENT_CALL, {
      attributes: {
        [AttributeKeys.RPC_SYSTEM]: 'enkaku',
        [AttributeKeys.RPC_PROCEDURE]: procedure,
        [AttributeKeys.RPC_REQUEST_ID]: rid,
        [AttributeKeys.RPC_TYPE]: 'request',
      },
    })
    const spanCtx = setSpanOnContext(undefined, span)

    const controller = createController<T['Result']>({
      type: 'request',
      procedure,
      header: config.header,
    })

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Aborted before send' })
      span.end()
      this.#logger.debug('reject aborted request {procedure} with ID {rid}', { procedure, rid })
      return createRequest({
        id: rid,
        controller,
        signal: providedSignal,
        sent: Promise.reject(providedSignal),
      })
    }

    this.#controllers[rid] = controller
    const prm = config.param
    const payload = prm
      ? { typ: 'request', rid, prc: procedure, prm }
      : { typ: 'request', rid, prc: procedure }
    if (prm == null) {
      this.#logger.trace('send request {procedure} with ID {rid}', { procedure, rid })
    } else {
      this.#logger.trace('send request {procedure} with ID {rid} and param: {param}', {
        procedure,
        rid,
        param: prm,
      })
    }
    this.#events.emit('requestStart', { rid, procedure, type: controller.type })
    const sent = withActiveContext(spanCtx, () =>
      this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header, rid),
    )

    this.#endSpanOnResult(span, controller.result, { rid, procedure })

    const signal = this.#handleSignal(rid, controller, providedSignal)
    return createRequest({ id: rid, controller, signal, sent })
  }

  createStream<
    Procedure extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Procedure] = ClientDefinitions['Streams'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { header?: AnyHeader; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { header?: AnyHeader; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): StreamCall<T['Receive'], T['Result']> {
    const config = args[0] ?? {}
    const rid = config.id ?? this.#runtime.getRandomID()

    const span = this.#tracer.startSpan(SpanNames.CLIENT_CALL, {
      attributes: {
        [AttributeKeys.RPC_SYSTEM]: 'enkaku',
        [AttributeKeys.RPC_PROCEDURE]: procedure,
        [AttributeKeys.RPC_REQUEST_ID]: rid,
        [AttributeKeys.RPC_TYPE]: 'stream',
      },
    })
    const spanCtx = setSpanOnContext(undefined, span)

    const receive = createPipe<T['Receive']>()
    const writer = receive.writable.getWriter()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>({ type: 'stream', procedure, header: config.header }, () =>
        writer.close(),
      ),
      { receive: writer },
    )

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Aborted before send' })
      span.end()
      this.#logger.debug('reject aborted stream creation {procedure} with ID {rid}', {
        procedure,
        rid,
      })
      return createStream({
        id: rid,
        controller,
        signal: providedSignal,
        sent: Promise.reject(providedSignal),
        readable: receive.readable,
      })
    }

    this.#controllers[rid] = controller
    this.#spans[rid] = span
    const prm = config.param
    const payload = prm
      ? { typ: 'stream', rid, prc: procedure, prm }
      : { typ: 'stream', rid, prc: procedure }
    if (prm == null) {
      this.#logger.trace('create stream {procedure} with ID {rid}', { procedure, rid })
    } else {
      this.#logger.trace('create stream {procedure} with ID {rid} and param: {param}', {
        procedure,
        rid,
        param: prm,
      })
    }
    this.#events.emit('requestStart', { rid, procedure, type: controller.type })
    const sent = withActiveContext(spanCtx, () =>
      this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header, rid),
    )

    this.#endSpanOnResult(span, controller.result, { rid, procedure })

    const signal = this.#handleSignal(rid, controller, providedSignal)

    return createStream({
      id: rid,
      controller,
      signal,
      sent,
      readable: receive.readable,
    })
  }

  createChannel<
    Procedure extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Procedure] = ClientDefinitions['Channels'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { header?: AnyHeader; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { header?: AnyHeader; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): ChannelCall<T['Receive'], T['Send'], T['Result']> {
    const config = args[0] ?? {}
    const rid = config.id ?? this.#runtime.getRandomID()

    const span = this.#tracer.startSpan(SpanNames.CLIENT_CALL, {
      attributes: {
        [AttributeKeys.RPC_SYSTEM]: 'enkaku',
        [AttributeKeys.RPC_PROCEDURE]: procedure,
        [AttributeKeys.RPC_REQUEST_ID]: rid,
        [AttributeKeys.RPC_TYPE]: 'channel',
      },
    })
    const spanCtx = setSpanOnContext(undefined, span)

    const receive = createPipe<T['Receive']>()
    const writer = receive.writable.getWriter()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>({ type: 'channel', procedure, header: config.header }, () =>
        writer.close(),
      ),
      { receive: writer },
    )

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Aborted before send' })
      span.end()
      this.#logger.debug('reject aborted channel creation {procedure} with ID {rid}', {
        procedure,
        rid,
      })
      // no-op
      const send = async (_val: T['Send']) => {}
      return Object.assign(
        createStream({
          id: rid,
          controller,
          signal: providedSignal,
          sent: Promise.reject(providedSignal),
          readable: receive.readable,
        }),
        { send, writable: writeTo(send) },
      )
    }

    this.#controllers[rid] = controller
    this.#spans[rid] = span
    const prm = config.param
    const payload = prm
      ? { typ: 'channel', rid, prc: procedure, prm }
      : { typ: 'channel', rid, prc: procedure }
    if (prm == null) {
      this.#logger.trace('create channel {procedure} with ID {rid}', { procedure, rid })
    } else {
      this.#logger.trace('create channel {procedure} with ID {rid} and param: {param}', {
        procedure,
        rid,
        param: prm,
      })
    }
    this.#events.emit('requestStart', { rid, procedure, type: controller.type })
    const sent = withActiveContext(spanCtx, () =>
      this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header, rid),
    )

    this.#endSpanOnResult(span, controller.result, { rid, procedure })

    const signal = this.#handleSignal(rid, controller, providedSignal)

    const send = async (val: T['Send']) => {
      const channelSpan = this.#spans[rid]
      if (channelSpan != null) {
        channelSpan.addEvent('channel.message.sent', {
          [AttributeKeys.MESSAGE_DIRECTION]: 'send',
        })
      }
      this.#logger.trace('send value to channel {procedure} with ID {rid}: {value}', {
        procedure,
        rid,
        value: val,
      })
      await this.#write(
        { typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Protocol>,
        config.header,
        rid,
      )
    }

    return Object.assign(
      createStream({
        id: rid,
        controller,
        signal,
        sent,
        readable: receive.readable,
      }),
      {
        send,
        writable: writeTo(send),
      },
    )
  }
}
