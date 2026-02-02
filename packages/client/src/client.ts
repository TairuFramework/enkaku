import { Disposer, defer } from '@enkaku/async'
import { getEnkakuLogger, type Logger } from '@enkaku/log'
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
import { createPipe, writeTo } from '@enkaku/stream'
import { createUnsignedToken, type Identity, isSigningIdentity } from '@enkaku/token'

import { RequestError } from './error.js'

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
      deferred.reject(signal)
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

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

export type ClientParams<Protocol extends ProtocolDefinition> = {
  getRandomID?: () => string
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  logger?: Logger
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
  #getRandomID: () => string
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  #handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  #handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  #logger: Logger
  #transport: ClientTransportOf<Protocol>

  constructor(params: ClientParams<Protocol>) {
    super({
      dispose: async (reason?: unknown) => {
        this.#abortControllers(reason)
        await this.#transport.dispose(reason)
        this.#logger.debug('disposed')
      },
    })
    this.#createMessage = getCreateMessage<Protocol>(params.identity, params.serverID)
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#handleTransportDisposed = params.handleTransportDisposed
    this.#handleTransportError = params.handleTransportError
    this.#logger = params.logger ?? getEnkakuLogger('client', { clientID: this.#getRandomID() })
    this.#transport = params.transport
    // Start reading from transport
    this.#setupTransport()
  }

  #abortControllers(reason?: unknown): void {
    if (!this.signal.aborted) {
      for (const controller of Object.values(this.#controllers)) {
        controller.abort(reason)
      }
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
        this.#setupTransport()
      }
    })
    this.#read()
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
          this.#logger.debug('error reply for {type} {procedure} with ID {rid}', {
            type: controller.type,
            procedure: controller.procedure,
            rid: msg.payload.rid,
            error,
          })
          controller.error(error)
          delete this.#controllers[msg.payload.rid]
          break
        }
        case 'receive':
          this.#logger.trace('receive reply for {type} {procedure} with ID {rid}', {
            type: controller.type,
            procedure: controller.procedure,
            rid: msg.payload.rid,
            receive: msg.payload.val,
          })
          void (controller as StreamController<unknown, unknown>).receive?.write(msg.payload.val)
          break
        case 'result':
          this.#logger.trace('result reply for {type} {procedure} with ID {rid}', {
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

  async #write(payload: AnyClientPayloadOf<Protocol>, header?: AnyHeader): Promise<void> {
    if (this.signal.aborted) {
      throw new Error('Client aborted', { cause: this.signal.reason })
    }
    const message = await this.#createMessage(payload, header)
    await this.#transport.write(message)
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
        const reason = signal.reason.name ?? signal.reason
        this.#logger.trace('abort {type} {procedure} with ID {rid}', {
          type: controller.type,
          procedure: controller.procedure,
          rid,
          reason,
        })
        void this.#write(
          {
            typ: 'abort',
            rid,
            rsn: reason,
          } as unknown as AnyClientPayloadOf<Protocol>,
          controller.header,
        )
        if (signal.reason !== 'Close') {
          controller.aborted(signal)
          delete this.#controllers[rid]
        }
      },
      { once: true },
    )
    return signal
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
    const data = config.data
    const payload = data ? { typ: 'event', prc: procedure, data } : { typ: 'event', prc: procedure }
    this.#logger.trace('send event {procedure}', { procedure, data })
    await this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
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
    const controller = createController<T['Result']>({
      type: 'request',
      procedure,
      header: config.header,
    })
    const rid = config.id ?? this.#getRandomID()

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
      this.#logger.debug('reject aborted request {procedure} with ID { rid }', { procedure, rid })
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
    this.#logger.trace('send request {procedure} with ID {rid}', { procedure, rid, param: prm })
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
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
    const receive = createPipe<T['Receive']>()
    const writer = receive.writable.getWriter()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>({ type: 'stream', procedure, header: config.header }, () =>
        writer.close(),
      ),
      { receive: writer },
    )
    const rid = config.id ?? this.#getRandomID()

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
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
    const prm = config.param
    const payload = prm
      ? { typ: 'stream', rid, prc: procedure, prm }
      : { typ: 'stream', rid, prc: procedure }
    this.#logger.trace('create stream {procedure} with ID {rid}', { procedure, rid, param: prm })
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
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
    const receive = createPipe<T['Receive']>()
    const writer = receive.writable.getWriter()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>({ type: 'channel', procedure, header: config.header }, () =>
        writer.close(),
      ),
      { receive: writer },
    )
    const rid = config.id ?? this.#getRandomID()

    const providedSignal = config.signal
    if (providedSignal?.aborted) {
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
    const prm = config.param
    const payload = prm
      ? { typ: 'channel', rid, prc: procedure, prm }
      : { typ: 'channel', rid, prc: procedure }
    this.#logger.trace('create channel {procedure} with ID {rid}', { procedure, rid, param: prm })
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
    const signal = this.#handleSignal(rid, controller, providedSignal)

    const send = async (val: T['Send']) => {
      this.#logger.trace('send value to channel {procedure} with ID {rid}', {
        procedure,
        rid,
        value: val,
      })
      await this.#write(
        { typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Protocol>,
        config.header,
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
