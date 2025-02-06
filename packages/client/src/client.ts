import { Disposer, defer } from '@enkaku/async'
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
  ReturnOf,
  StreamProcedureDefinition,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type TokenSigner, createUnsignedToken } from '@enkaku/token'

import { RequestError } from './error.js'

type FilterNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }

export type RequestCall<Result> = Promise<Result> & {
  abort: (reason?: string) => void
  signal: AbortSignal
}

export type StreamCall<Receive, Result> = RequestCall<Result> & {
  close: () => void
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

type RequestController<Result> = AbortController & {
  result: Promise<Result>
  ok: (value: Result) => void
  error: (error: RequestError) => void
  aborted: (signal: AbortSignal) => void
}

type StreamController<Receive, Result> = RequestController<Result> & {
  receive: WritableStreamDefaultWriter<Receive>
}

type AnyClientController =
  // biome-ignore lint/suspicious/noExplicitAny: what other way to type this?
  RequestController<any> | StreamController<any, any>

function createController<T>(): RequestController<T> {
  const deferred = defer<T>()
  return Object.assign(new AbortController(), {
    result: deferred.promise,
    ok: (value: T) => deferred.resolve(value),
    error: (error: RequestError) => deferred.reject(error),
    aborted: (signal: AbortSignal) => deferred.reject(signal),
  })
}

function createRequest<Result>(
  controller: RequestController<Result>,
  signal: AbortSignal,
  sent: Promise<unknown>,
): RequestCall<Result> {
  return Object.assign(
    sent.then(() => controller.result),
    {
      abort: (reason?: string) => {
        void sent.then(() => {
          controller.abort(reason)
        })
      },
      signal,
    },
  )
}

function createStream<Receive, Result>(
  controller: RequestController<Result>,
  signal: AbortSignal,
  sent: Promise<unknown>,
  readable: ReadableStream<Receive>,
): StreamCall<Receive, Result> {
  const request = createRequest(controller, signal, sent)
  return Object.assign(request, { close: () => request.abort('Close'), readable })
}

type CreateMessage<Protocol extends ProtocolDefinition> = (
  payload: AnyClientPayloadOf<Protocol>,
) => AnyClientMessageOf<Protocol> | Promise<AnyClientMessageOf<Protocol>>

function getCreateMessage<Protocol extends ProtocolDefinition>(
  signer?: TokenSigner | Promise<TokenSigner>,
  aud?: string,
): CreateMessage<Protocol> {
  if (signer == null) {
    return createUnsignedToken
  }

  const signerPromise = Promise.resolve(signer)
  const createToken = (payload: Record<string, unknown>) => {
    return signerPromise.then((s) => s.createToken(payload))
  }

  return (
    aud ? (payload) => createToken({ aud, ...payload }) : createToken
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
  transport: ClientTransportOf<Protocol>
  serverID?: string
  signer?: TokenSigner | Promise<TokenSigner>
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
  #transport: ClientTransportOf<Protocol>

  constructor(params: ClientParams<Protocol>) {
    super()
    this.#createMessage = getCreateMessage<Protocol>(params.signer, params.serverID)
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#handleTransportDisposed = params.handleTransportDisposed
    this.#handleTransportError = params.handleTransportError
    this.#transport = params.transport
    // Start reading from transport
    this.#setupTransport()
  }

  /** @internal */
  async _dispose(reason?: unknown): Promise<void> {
    this.#abortControllers(reason)
    await this.#transport.dispose(reason)
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
        // Abort client if no new transport is provided
        this.abort('TransportDisposed')
      } else {
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
        const error = new Error('Transport read failed', { cause })
        const newTransport = this.#handleTransportError?.(error)
        if (newTransport == null) {
          // Abort client if no new transport is provided
          this.abort(error)
        } else {
          // Abort running procedures and start using new transport
          this.#abortControllers(error)
          this.#transport = newTransport
          this.#setupTransport()
        }
        return
      }

      const controller = this.#controllers[msg.payload.rid]
      if (controller == null) {
        console.warn(`No controller for request ${msg.payload.rid}`)
        continue
      }

      switch (msg.payload.typ) {
        case 'error':
          void (controller as StreamController<unknown, unknown>).receive?.close()
          controller.error(RequestError.fromPayload(msg.payload))
          delete this.#controllers[msg.payload.rid]
          break
        case 'receive':
          void (controller as StreamController<unknown, unknown>).receive?.write(msg.payload.val)
          break
        case 'result':
          void (controller as StreamController<unknown, unknown>).receive?.close()
          controller.ok(msg.payload.val)
          delete this.#controllers[msg.payload.rid]
          break
      }
    }
  }

  async #write(payload: AnyClientPayloadOf<Protocol>): Promise<void> {
    if (this.signal.aborted) {
      throw new Error('Client aborted', { cause: this.signal.reason })
    }
    const message = await this.#createMessage(payload)
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
        void this.#write({
          typ: 'abort',
          rid,
          rsn: reason,
        } as unknown as AnyClientPayloadOf<Protocol>)
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
  >(procedure: Procedure, ...args: T['Data'] extends never ? [] : [T['Data']]): Promise<void> {
    const payload = args.length
      ? { typ: 'event', prc: procedure, data: args[0] }
      : { typ: 'event', prc: procedure }
    await this.#write(payload as unknown as AnyClientPayloadOf<Protocol>)
  }

  request<
    Procedure extends keyof ClientDefinitions['Requests'] & string,
    T extends ClientDefinitions['Requests'][Procedure] = ClientDefinitions['Requests'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { param?: never; signal?: AbortSignal }]
      : [config: { param: T['Param']; signal?: AbortSignal }]
  ): RequestCall<T['Result']> & Promise<T['Result']> {
    const controller = createController<T['Result']>()
    const providedSignal = args[0]?.signal
    if (providedSignal?.aborted) {
      return createRequest(controller, providedSignal, Promise.reject(providedSignal))
    }

    const rid = this.#getRandomID()
    this.#controllers[rid] = controller

    const prm = args[0]?.param
    const payload = prm
      ? { typ: 'request', rid, prc: procedure, prm }
      : { typ: 'request', rid, prc: procedure }
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>)
    const signal = this.#handleSignal(rid, controller, providedSignal)

    return createRequest(controller, signal, sent)
  }

  createStream<
    Procedure extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Procedure] = ClientDefinitions['Streams'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { param?: never; signal?: AbortSignal }]
      : [config: { param: T['Param']; signal?: AbortSignal }]
  ): StreamCall<T['Receive'], T['Result']> {
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter() },
    )
    const providedSignal = args[0]?.signal
    if (providedSignal?.aborted) {
      return createStream(
        controller,
        providedSignal,
        Promise.reject(providedSignal),
        receive.readable,
      )
    }

    const rid = this.#getRandomID()
    this.#controllers[rid] = controller

    const prm = args[0]?.param
    const payload = prm
      ? { typ: 'stream', rid, prc: procedure, prm }
      : { typ: 'stream', rid, prc: procedure }
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>)
    const signal = this.#handleSignal(rid, controller, providedSignal)

    return createStream(controller, signal, sent, receive.readable)
  }

  createChannel<
    Procedure extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Procedure] = ClientDefinitions['Channels'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { param?: never; signal?: AbortSignal }]
      : [config: { param: T['Param']; signal?: AbortSignal }]
  ): ChannelCall<T['Receive'], T['Send'], T['Result']> {
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter() },
    )
    const providedSignal = args[0]?.signal
    if (providedSignal?.aborted) {
      // no-op
      const send = async (val: T['Send']) => {}
      const writable = new WritableStream({ write: send })
      return Object.assign(
        createStream(controller, providedSignal, Promise.reject(providedSignal), receive.readable),
        { send, writable },
      )
    }

    const rid = this.#getRandomID()
    this.#controllers[rid] = controller

    const prm = args[0]?.param
    const payload = prm
      ? { typ: 'channel', rid, prc: procedure, prm }
      : { typ: 'channel', rid, prc: procedure }
    const sent = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>)
    const signal = this.#handleSignal(rid, controller, providedSignal)

    const send = async (val: T['Send']) => {
      await this.#write({ typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Protocol>)
    }
    const writable = new WritableStream({ write: send })

    return Object.assign(createStream(controller, signal, sent, receive.readable), {
      send,
      writable,
    })
  }
}
