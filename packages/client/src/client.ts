import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyDefinitions,
  ChannelDefinition,
  ClientTransportOf,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type TokenSigner, createUnsignedToken } from '@enkaku/token'
import type { Disposer } from '@enkaku/util'
import { Result } from 'typescript-result'

import { ABORTED } from './constants.js'
import { RequestError } from './error.js'

export type InvokeError = typeof ABORTED | RequestError

export type InvokeResult<T> = Result<T, InvokeError>

export type InvokeReturn<ResultValue> = {
  // biome-ignore lint/suspicious/noExplicitAny: from AbortController
  abort: (reason?: any) => void
  id: string
  result: Promise<Result<ResultValue, InvokeError>>
}

export type InvokeStreamReturn<Receive, Result> = InvokeReturn<Result> & {
  receive: ReadableStream<Receive>
}

export type InvokeChannelReturn<Send, Receive, Result> = InvokeStreamReturn<Receive, Result> & {
  send: (value: Send) => Promise<void>
}

export type Invocation<ResultValue, Return> = Promise<Return> & {
  result: Promise<InvokeResult<ResultValue>>
  toValue(): Promise<ResultValue>
}

export type EventDefinitionsType<
  Definitions extends AnyDefinitions,
  Commands extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Command in Commands]: Definitions[Command] extends EventDefinition<infer Data>
    ? {
        Argument: Data extends undefined ? never : Data
        Return: undefined
      }
    : never
}

export type RequestDefinitionsType<
  Definitions extends AnyDefinitions,
  Commands extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Command in Commands]: Definitions[Command] extends RequestDefinition<infer Params, infer Result>
    ? {
        Argument: Params extends undefined ? never : Params
        Result: Result
        Return: InvokeReturn<Result>
      }
    : never
}

export type StreamDefinitionsType<
  Definitions extends AnyDefinitions,
  Commands extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Command in Commands]: Definitions[Command] extends StreamDefinition<
    infer Params,
    infer Receive,
    infer Result
  >
    ? {
        Argument: Params extends undefined ? never : Params
        Receive: Receive
        Result: Result
        Return: InvokeStreamReturn<Receive, Result>
      }
    : never
}

export type ChannelDefinitionsType<
  Definitions extends AnyDefinitions,
  Commands extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Command in Commands]: Definitions[Command] extends ChannelDefinition<
    infer Params,
    infer Send,
    infer Receive,
    infer Result
  >
    ? {
        Argument: Params extends undefined ? never : Params
        Receive: Receive
        Result: Result
        Return: InvokeChannelReturn<Send, Receive, Result>
        Send: Send
      }
    : never
}

export type ClientDefinitionsType<Definitions extends AnyDefinitions> = {
  Channels: ChannelDefinitionsType<Definitions>
  Events: EventDefinitionsType<Definitions>
  Requests: RequestDefinitionsType<Definitions>
  Streams: StreamDefinitionsType<Definitions>
}

export type InvokeArgumentType<
  Definitions extends AnyDefinitions,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = Definitions[Name] extends EventDefinition<infer Data>
  ? Data
  : Definitions[Name] extends RequestDefinition<infer Params>
    ? Params
    : Definitions[Name] extends StreamDefinition<infer Params>
      ? Params
      : Definitions[Name] extends ChannelDefinition<infer Params>
        ? Params
        : never

export type InvokeReturnType<
  Definitions extends AnyDefinitions,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends EventDefinition<infer Data>
  ? undefined
  : Definitions[Name] extends RequestDefinition<infer Params, infer Result>
    ? InvokeReturn<Result>
    : Definitions[Name] extends StreamDefinition<infer Params, infer Receive, infer Result>
      ? InvokeStreamReturn<Receive, Result>
      : Definitions[Name] extends ChannelDefinition<
            infer Params,
            infer Send,
            infer Receive,
            infer Result
          >
        ? InvokeChannelReturn<Send, Receive, Result>
        : never

type RequestController<ResultValue> = AbortController & {
  result: Promise<InvokeResult<ResultValue>>
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
  let resolve: (value: InvokeResult<T> | PromiseLike<InvokeResult<T>>) => void = () => {}
  const result = new Promise<InvokeResult<T>>((res) => {
    resolve = res
  })
  return Object.assign(new AbortController(), {
    result,
    ok: (value: T) => resolve(Result.ok(value)),
    error: (error: RequestError) => resolve(Result.error(error)),
    aborted: () => resolve(Result.error(ABORTED)),
  })
}

export function createInvovation<ResultValue, Return>(
  controller: RequestController<ResultValue>,
  promise: Promise<Return>,
): Invocation<ResultValue, Return> {
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

type CreateMessage<Definitions extends AnyDefinitions> = (
  payload: AnyClientPayloadOf<Definitions>,
) => AnyClientMessageOf<Definitions> | Promise<AnyClientMessageOf<Definitions>>

function getCreateMessage<Definitions extends AnyDefinitions>(
  signer?: TokenSigner | Promise<TokenSigner>,
  aud?: string,
): CreateMessage<Definitions> {
  if (signer == null) {
    return createUnsignedToken
  }

  const signerPromise = Promise.resolve(signer)
  const createToken = (payload: Record<string, unknown>) => {
    return signerPromise.then((s) => s.createToken(payload))
  }

  return (
    aud ? (payload) => createToken({ aud, ...payload }) : createToken
  ) as CreateMessage<Definitions>
}

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

export type ClientParams<Definitions extends AnyDefinitions> = {
  getRandomID?: () => string
  transport: ClientTransportOf<Definitions>
  serverID?: string
  signer?: TokenSigner | Promise<TokenSigner>
}

export class Client<
  Definitions extends AnyDefinitions,
  ClientDefinitions extends ClientDefinitionsType<Definitions> = ClientDefinitionsType<Definitions>,
> implements Disposer
{
  #controllers: Record<string, AnyClientController> = {}
  #createMessage: CreateMessage<Definitions>
  #getRandomID: () => string
  #transport: ClientTransportOf<Definitions>

  constructor(params: ClientParams<Definitions>) {
    this.#createMessage = getCreateMessage(params.signer, params.serverID)
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

  async #write(payload: AnyClientPayloadOf<Definitions>): Promise<void> {
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
    Command extends keyof ClientDefinitions['Events'] & string,
    T extends ClientDefinitions['Events'][Command] = ClientDefinitions['Events'][Command],
  >(command: Command, ...args: T['Argument'] extends never ? [] : [T['Argument']]): Promise<void> {
    const payload = args.length
      ? { typ: 'event', cmd: command, data: args[0] }
      : { typ: 'event', cmd: command }
    await this.#write(payload as unknown as AnyClientPayloadOf<Definitions>)
  }

  request<
    Command extends keyof ClientDefinitions['Requests'] & string,
    T extends ClientDefinitions['Requests'][Command] = ClientDefinitions['Requests'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Invocation<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const controller = createController<T['Result']>()
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'request', rid, cmd: command, prm: args[0] }
      : { typ: 'request', rid, cmd: command }

    const promise = this.#write(payload as unknown as AnyClientPayloadOf<Definitions>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        result: controller.result,
      }
    })
    return createInvovation(controller, promise)
  }

  createStream<
    Command extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Command] = ClientDefinitions['Streams'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Invocation<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter() },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const action = args.length
      ? { typ: 'stream', rid, cmd: command, prm: args[0] }
      : { typ: 'stream', rid, cmd: command }
    const promise = this.#write(action as unknown as AnyClientPayloadOf<Definitions>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        receive: receive.readable,
        result: controller.result,
      }
    })
    return createInvovation(controller, promise)
  }

  createChannel<
    Command extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Command] = ClientDefinitions['Channels'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Invocation<T['Result'], T['Return']> {
    const rid = this.#getRandomID()
    const receive = createPipe<T['Receive']>()
    const send = createPipe<T['Send']>()
    const controller: ChannelController<T['Send'], T['Receive'], T['Result']> = Object.assign(
      createController<T['Result']>(),
      { receive: receive.writable.getWriter(), send: send.writable },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'channel', rid, cmd: command, prm: args[0] }
      : { typ: 'channel', rid, cmd: command }
    const promise = this.#write(payload as unknown as AnyClientPayloadOf<Definitions>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        receive: receive.readable,
        result: controller.result,
        send: async (val: T['Send']) => {
          await this.#write({ typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Definitions>)
        },
      }
    })
    return createInvovation(controller, promise)
  }
}
