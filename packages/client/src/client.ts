import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyCommandDefinition,
  AnyRequestCommandDefinition,
  ChannelCommandDefinition,
  ClientTransportOf,
  DataOf,
  EventCommandDefinition,
  ProtocolDefinition,
  RequestCommandDefinition,
  StreamCommandDefinition,
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

export type EventDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: Protocol[Command] extends EventCommandDefinition
    ? {
        Argument: DataOf<Protocol[Command]['data']>
        Return: undefined
      }
    : never
}

export type RequestDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: Protocol[Command] extends RequestCommandDefinition
    ? {
        Argument: DataOf<Protocol[Command]['params']>
        Result: DataOf<Protocol[Command]['result']>
        Return: InvokeReturn<DataOf<Protocol[Command]['result']>>
      }
    : never
}

export type StreamDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: Protocol[Command] extends StreamCommandDefinition
    ? {
        Argument: Protocol[Command]['params'] extends undefined
          ? never
          : DataOf<Protocol[Command]['params']>
        Receive: DataOf<Protocol[Command]['receive']>
        Result: DataOf<Protocol[Command]['result']>
        Return: InvokeStreamReturn<
          DataOf<Protocol[Command]['receive']>,
          DataOf<Protocol[Command]['result']>
        >
      }
    : never
}

export type ChannelDefinitionsType<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: Protocol[Command] extends ChannelCommandDefinition
    ? {
        Argument: DataOf<Protocol[Command]['params']>
        Receive: DataOf<Protocol[Command]['receive']>
        Result: DataOf<Protocol[Command]['result']>
        Return: InvokeChannelReturn<
          DataOf<Protocol[Command]['send']>,
          DataOf<Protocol[Command]['receive']>,
          DataOf<Protocol[Command]['result']>
        >
        Send: DataOf<Protocol[Command]['send']>
      }
    : never
}

export type ClientDefinitionsType<Protocol extends ProtocolDefinition> = {
  Channels: ChannelDefinitionsType<Protocol>
  Events: EventDefinitionsType<Protocol>
  Requests: RequestDefinitionsType<Protocol>
  Streams: StreamDefinitionsType<Protocol>
}

export type InvokeArgumentType<Command extends AnyCommandDefinition> =
  Command extends EventCommandDefinition
    ? Command['data']
    : Command extends AnyRequestCommandDefinition
      ? Command['params']
      : never

export type InvokeReturnType<Command extends AnyCommandDefinition> =
  Command extends EventCommandDefinition
    ? undefined
    : Command extends RequestCommandDefinition
      ? InvokeReturn<Command['result']>
      : Command extends StreamCommandDefinition
        ? InvokeStreamReturn<Command['receive'], Command['result']>
        : Command extends ChannelCommandDefinition
          ? InvokeChannelReturn<Command['send'], Command['receive'], Command['result']>
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

export function createInvocation<ResultValue, Return>(
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
    Command extends keyof ClientDefinitions['Events'] & string,
    T extends ClientDefinitions['Events'][Command] = ClientDefinitions['Events'][Command],
  >(command: Command, ...args: T['Argument'] extends never ? [] : [T['Argument']]): Promise<void> {
    const payload = args.length
      ? { typ: 'event', cmd: command, data: args[0] }
      : { typ: 'event', cmd: command }
    await this.#write(payload as unknown as AnyClientPayloadOf<Protocol>)
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
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'request', rid, cmd: command, prm: args[0] }
      : { typ: 'request', rid, cmd: command }

    const promise = this.#write(payload as unknown as AnyClientPayloadOf<Protocol>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        result: controller.result,
      }
    })
    return createInvocation(controller, promise)
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
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const action = args.length
      ? { typ: 'stream', rid, cmd: command, prm: args[0] }
      : { typ: 'stream', rid, cmd: command }
    const promise = this.#write(action as unknown as AnyClientPayloadOf<Protocol>).then(() => {
      return {
        abort: () => controller.abort(),
        id: rid,
        receive: receive.readable,
        result: controller.result,
      }
    })
    return createInvocation(controller, promise)
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
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Protocol>)
      controller.aborted()
      delete this.#controllers[rid]
    })

    const payload = args.length
      ? { typ: 'channel', rid, cmd: command, prm: args[0] }
      : { typ: 'channel', rid, cmd: command }
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
    return createInvocation(controller, promise)
  }
}
