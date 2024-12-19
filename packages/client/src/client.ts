import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyProcedureDefinition,
  AnyRequestProcedureDefinition,
  ChannelProcedureDefinition,
  ClientTransportOf,
  DataOf,
  EventProcedureDefinition,
  ProtocolDefinition,
  RequestProcedureDefinition,
  StreamProcedureDefinition,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type TokenSigner, createUnsignedToken } from '@enkaku/token'
import type { Disposer } from '@enkaku/util'
import { Result } from 'typescript-result'

import { ABORTED } from './constants.js'
import { RequestError } from './error.js'

export type CallError = typeof ABORTED | RequestError

export type CallResult<T> = Result<T, CallError>

export type CallReturn<ResultValue> = {
  // biome-ignore lint/suspicious/noExplicitAny: from AbortController
  abort: (reason?: any) => void
  id: string
  result: Promise<Result<ResultValue, CallError>>
}

export type CallStreamReturn<Receive, Result> = CallReturn<Result> & {
  receive: ReadableStream<Receive>
}

export type CallChannelReturn<Send, Receive, Result> = CallStreamReturn<Receive, Result> & {
  send: (value: Send) => Promise<void>
}

export type ProcedureCall<ResultValue, Return> = Promise<Return> & {
  result: Promise<CallResult<ResultValue>>
  toValue(): Promise<ResultValue>
}

export type EventDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition
    ? {
        Argument: DataOf<Protocol[Procedure]['data']>
        Return: undefined
      }
    : never
}

export type RequestDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends RequestProcedureDefinition
    ? {
        Argument: DataOf<Protocol[Procedure]['params']>
        Result: DataOf<Protocol[Procedure]['result']>
        Return: CallReturn<DataOf<Protocol[Procedure]['result']>>
      }
    : never
}

export type StreamDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends StreamProcedureDefinition
    ? {
        Argument: Protocol[Procedure]['params'] extends undefined
          ? never
          : DataOf<Protocol[Procedure]['params']>
        Receive: DataOf<Protocol[Procedure]['receive']>
        Result: DataOf<Protocol[Procedure]['result']>
        Return: CallStreamReturn<
          DataOf<Protocol[Procedure]['receive']>,
          DataOf<Protocol[Procedure]['result']>
        >
      }
    : never
}

export type ChannelDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends ChannelProcedureDefinition
    ? {
        Argument: DataOf<Protocol[Procedure]['params']>
        Receive: DataOf<Protocol[Procedure]['receive']>
        Result: DataOf<Protocol[Procedure]['result']>
        Return: CallChannelReturn<
          DataOf<Protocol[Procedure]['send']>,
          DataOf<Protocol[Procedure]['receive']>,
          DataOf<Protocol[Procedure]['result']>
        >
        Send: DataOf<Protocol[Procedure]['send']>
      }
    : never
}

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
      ? Procedure['params']
      : never

export type CallReturnType<Procedure extends AnyProcedureDefinition> =
  Procedure extends EventProcedureDefinition
    ? undefined
    : Procedure extends RequestProcedureDefinition
      ? CallReturn<Procedure['result']>
      : Procedure extends StreamProcedureDefinition
        ? CallStreamReturn<Procedure['receive'], Procedure['result']>
        : Procedure extends ChannelProcedureDefinition
          ? CallChannelReturn<Procedure['send'], Procedure['receive'], Procedure['result']>
          : never

type RequestController<ResultValue> = AbortController & {
  result: Promise<CallResult<ResultValue>>
  ok: (value: ResultValue) => void
  error: (error: RequestError) => void
  aborted: () => void
}

type StreamController<Receive, Result> = RequestController<Result> & {
  receive: WritableStreamDefaultWriter<Receive>
}

type ChannelController<Send, Receive, Result> = StreamController<Receive, Result> & {
  send: WritableStream<Send>
}

type AnyClientController =
  // biome-ignore lint/suspicious/noExplicitAny: what other way to type this?
  RequestController<any> | StreamController<any, any> | ChannelController<any, any, any>

export function createController<T>(): RequestController<T> {
  let resolve: (value: CallResult<T> | PromiseLike<CallResult<T>>) => void = () => {}
  const result = new Promise<CallResult<T>>((res) => {
    resolve = res
  })
  return Object.assign(new AbortController(), {
    result,
    ok: (value: T) => resolve(Result.ok(value)),
    error: (error: RequestError) => resolve(Result.error(error)),
    aborted: () => resolve(Result.error(ABORTED)),
  })
}

export function createCall<ResultValue, Return>(
  controller: RequestController<ResultValue>,
  promise: Promise<Return>,
): ProcedureCall<ResultValue, Return> {
  return Object.assign(promise, {
    result: controller.result,
    toValue: (): Promise<ResultValue> => {
      return controller.result.then((result) => {
        if (result.isOk()) {
          return result.value as ResultValue
        }
        throw result.error
      })
    },
  })
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
  transport: ClientTransportOf<Protocol>
  serverID?: string
  signer?: TokenSigner | Promise<TokenSigner>
}

export class Client<
  Protocol extends ProtocolDefinition,
  ClientDefinitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
> implements Disposer
{
  #controllers: Record<string, AnyClientController> = {}
  #createMessage: CreateMessage<Protocol>
  #getRandomID: () => string
  #transport: ClientTransportOf<Protocol>

  constructor(params: ClientParams<Protocol>) {
    this.#createMessage = getCreateMessage<Protocol>(params.signer, params.serverID)
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#transport = params.transport
    // Abort all controllers on disconnect
    this.#transport.disposed.then(() => {
      for (const controller of Object.values(this.#controllers)) {
        controller.abort()
      }
    })
    // Start reading from transport
    this.#read()
  }

  async #read() {
    while (true) {
      const next = await this.#transport.read()
      if (next.done) {
        break
      }

      const msg = next.value
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
    const message = await this.#createMessage(payload)
    await this.#transport.write(message)
  }

  get disposed() {
    return this.#transport.disposed
  }

  async dispose() {
    await this.#transport.dispose()
  }

  async sendEvent<
    Procedure extends keyof ClientDefinitions['Events'] & string,
    T extends ClientDefinitions['Events'][Procedure] = ClientDefinitions['Events'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<void> {
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
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): ProcedureCall<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const controller = createController<T['Result']>()
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'request', rid, prc: procedure, prm: args[0] }
      : { typ: 'request', rid, prc: procedure }

    const promise = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        result: controller.result,
      }
    })
    return createCall(controller, promise)
  }

  createStream<
    Procedure extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Procedure] = ClientDefinitions['Streams'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): ProcedureCall<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter() },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const action = args.length
      ? { typ: 'stream', rid, prc: procedure, prm: args[0] }
      : { typ: 'stream', rid, prc: procedure }
    const promise = this.#write(action as unknown as AnyClientPayloadOf<Protocol>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        receive: receive.readable,
        result: controller.result,
      }
    })
    return createCall(controller, promise)
  }

  createChannel<
    Procedure extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Procedure] = ClientDefinitions['Channels'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): ProcedureCall<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const receive = createPipe<T['Receive']>()
    const send = createPipe<T['Send']>()
    const controller: ChannelController<T['Send'], T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter(), send: send.writable },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'channel', rid, prc: procedure, prm: args[0] }
      : { typ: 'channel', rid, prc: procedure }
    const promise = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        receive: receive.readable,
        result: controller.result,
        send: async (val: T['Send']) => {
          await this.#write({ typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Protocol>)
        },
      }
    })
    return createCall(controller, promise)
  }
}
