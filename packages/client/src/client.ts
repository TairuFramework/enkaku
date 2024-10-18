import { createUnsignedToken } from '@enkaku/jwt'
import type {
  AnyClientPayloadOf,
  AnyDefinitions,
  ChannelDefinition,
  ClientTransportOf,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type Deferred, type Disposer, defer } from '@enkaku/util'

import { ABORTED } from './constants.js'
import { RequestError } from './error.js'

export type InvokeReturn<Result> = {
  // biome-ignore lint/suspicious/noExplicitAny: from AbortController
  abort: (reason?: any) => void
  id: string
  result: Promise<Result>
}

export type InvokeStreamReturn<Receive, Result> = InvokeReturn<Result> & {
  receive: ReadableStreamDefaultReader<Receive>
}

export type InvokeChannelReturn<Send, Receive, Result> = InvokeStreamReturn<Receive, Result> & {
  send: (value: Send) => Promise<void>
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

type RequestController<Result> = AbortController & {
  result: Deferred<Result>
}

type StreamController<Receive, Result> = RequestController<Result> & {
  receive: WritableStreamDefaultWriter<Receive>
}

type ChannelController<Send, Receive, Result> = StreamController<Receive, Result> & {
  send: WritableStreamDefaultWriter<Send>
}

type AnyClientController =
  // biome-ignore lint/suspicious/noExplicitAny: what other way to type this?
  RequestController<any> | StreamController<any, any> | ChannelController<any, any, any>

export type ClientParams<Definitions extends AnyDefinitions> = {
  transport: ClientTransportOf<Definitions>
}

export class Client<
  Definitions extends AnyDefinitions,
  ClientDefinitions extends ClientDefinitionsType<Definitions> = ClientDefinitionsType<Definitions>,
> implements Disposer
{
  #transport: ClientTransportOf<Definitions>
  #controllers: Record<string, AnyClientController> = {}

  constructor(params: ClientParams<Definitions>) {
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
          controller.result.reject(RequestError.fromPayload(msg.payload))
          delete this.#controllers[msg.payload.rid]
          break
        case 'receive':
          void (controller as StreamController<unknown, unknown>).receive?.write(msg.payload.val)
          break
        case 'result':
          void (controller as StreamController<unknown, unknown>).receive?.close()
          controller.result.resolve(msg.payload.val)
          delete this.#controllers[msg.payload.rid]
          break
      }
    }
  }

  async #write(payload: AnyClientPayloadOf<Definitions>): Promise<void> {
    await this.#transport.write(createUnsignedToken(payload))
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

  async request<
    Command extends keyof ClientDefinitions['Requests'] & string,
    T extends ClientDefinitions['Requests'][Command] = ClientDefinitions['Requests'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeReturn<T['Return']>> {
    const rid = globalThis.crypto.randomUUID()
    const controller: RequestController<T['Return']> = Object.assign(new AbortController(), {
      result: defer<T['Return']>(),
    })
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    const payload = args.length
      ? { typ: 'request', rid, cmd: command, prm: args[0] }
      : { typ: 'request', rid, cmd: command }
    await this.#write(payload as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id: rid,
      result: controller.result.promise,
    }
  }

  async createStream<
    Command extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Command] = ClientDefinitions['Streams'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeStreamReturn<T['Receive'], T['Return']>> {
    const rid = globalThis.crypto.randomUUID()
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Return']> = Object.assign(
      new AbortController(),
      { receive: receive.writable.getWriter(), result: defer<T['Return']>() },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    const action = args.length
      ? { typ: 'stream', rid, cmd: command, prm: args[0] }
      : { typ: 'stream', rid, cmd: command }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id: rid,
      receive: receive.readable.getReader(),
      result: controller.result.promise,
    }
  }

  async createChannel<
    Command extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Command] = ClientDefinitions['Channels'][Command],
  >(
    command: Command,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeChannelReturn<T['Send'], T['Receive'], T['Return']>> {
    const rid = globalThis.crypto.randomUUID()
    const receive = createPipe<T['Receive']>()
    const send = createPipe<T['Send']>()
    const controller: ChannelController<T['Send'], T['Receive'], T['Return']> = Object.assign(
      new AbortController(),
      {
        receive: receive.writable.getWriter(),
        result: defer<T['Return']>(),
        send: send.writable.getWriter(),
      },
    )
    this.#controllers[rid] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ typ: 'abort', rid } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    const payload = args.length
      ? { typ: 'channel', rid, cmd: command, prm: args[0] }
      : { typ: 'channel', rid, cmd: command }
    await this.#write(payload as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id: rid,
      receive: receive.readable.getReader(),
      result: controller.result.promise,
      send: async (val: T['Send']) => {
        await this.#write({ typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Definitions>)
      },
    }
  }
}
