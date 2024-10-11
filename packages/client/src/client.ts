import type {
  AnyActionDefinitions,
  AnyClientPayloadOf,
  ChannelActionDefinition,
  ClientTransportOf,
  EventActionDefinition,
  OptionalRecord,
  RequestActionDefinition,
  StreamActionDefinition,
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
  Definitions extends AnyActionDefinitions,
  Names extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Name in Names]: Definitions[Name] extends EventActionDefinition<infer Data>
    ? {
        Argument: Data extends undefined ? never : Data
        Return: undefined
      }
    : never
}

export type RequestDefinitionsType<
  Definitions extends AnyActionDefinitions,
  Names extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Name in Names]: Definitions[Name] extends RequestActionDefinition<infer Params, infer Result>
    ? {
        Argument: Params extends undefined ? never : Params
        Return: InvokeReturn<Result>
      }
    : never
}

export type StreamDefinitionsType<
  Definitions extends AnyActionDefinitions,
  Names extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Name in Names]: Definitions[Name] extends StreamActionDefinition<
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
  Definitions extends AnyActionDefinitions,
  Names extends keyof Definitions & string = keyof Definitions & string,
> = {
  [Name in Names]: Definitions[Name] extends ChannelActionDefinition<
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

export type ClientDefinitionsType<Definitions extends AnyActionDefinitions> = {
  Channels: ChannelDefinitionsType<Definitions>
  Events: EventDefinitionsType<Definitions>
  Requests: RequestDefinitionsType<Definitions>
  Streams: StreamDefinitionsType<Definitions>
}

export type InvokeArgumentType<
  Definitions extends AnyActionDefinitions,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = Definitions[Name] extends EventActionDefinition<infer Data>
  ? Data
  : Definitions[Name] extends RequestActionDefinition<infer Params>
    ? Params
    : Definitions[Name] extends StreamActionDefinition<infer Params>
      ? Params
      : Definitions[Name] extends ChannelActionDefinition<infer Params>
        ? Params
        : never

export type InvokeReturnType<
  Definitions extends AnyActionDefinitions,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends EventActionDefinition<infer Data>
  ? undefined
  : Definitions[Name] extends RequestActionDefinition<infer Params, infer Result>
    ? InvokeReturn<Result>
    : Definitions[Name] extends StreamActionDefinition<infer Params, infer Receive, infer Result>
      ? InvokeStreamReturn<Receive, Result>
      : Definitions[Name] extends ChannelActionDefinition<
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

export type ClientParams<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord = undefined,
> = {
  transport: ClientTransportOf<Definitions, Meta>
  meta?: Meta
}

export class Client<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  ClientDefinitions extends ClientDefinitionsType<Definitions> = ClientDefinitionsType<Definitions>,
> implements Disposer
{
  #meta: Meta
  #transport: ClientTransportOf<Definitions, Meta>
  #controllers: Record<string, AnyClientController> = {}

  constructor(params: ClientParams<Definitions, Meta>) {
    this.#meta = params.meta as Meta
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
      const controller = this.#controllers[msg.action.id]
      if (controller == null) {
        console.warn(`No controller for action ${msg.action.id}`)
        continue
      }

      switch (msg.action.type) {
        case 'error':
          void (controller as StreamController<unknown, unknown>).receive?.close()
          controller.result.reject(new RequestError(msg.action.error))
          delete this.#controllers[msg.action.id]
          break
        case 'receive':
          void (controller as StreamController<unknown, unknown>).receive?.write(msg.action.value)
          break
        case 'result':
          void (controller as StreamController<unknown, unknown>).receive?.close()
          controller.result.resolve(msg.action.value)
          delete this.#controllers[msg.action.id]
          break
      }
    }
  }

  async #write(action: AnyClientPayloadOf<Definitions>): Promise<void> {
    await this.#transport.write({ action, meta: this.#meta })
  }

  get disposed() {
    return this.#transport.disposed
  }

  async dispose() {
    await this.#transport.dispose()
  }

  async sendEvent<
    Name extends keyof ClientDefinitions['Events'] & string,
    T extends ClientDefinitions['Events'][Name] = ClientDefinitions['Events'][Name],
  >(name: Name, ...args: T['Argument'] extends never ? [] : [T['Argument']]): Promise<void> {
    const action = args.length ? { type: 'event', name, data: args[0] } : { type: 'event', name }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)
  }

  async request<
    Name extends keyof ClientDefinitions['Requests'] & string,
    T extends ClientDefinitions['Requests'][Name] = ClientDefinitions['Requests'][Name],
  >(
    name: Name,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeReturn<T['Return']>> {
    const id = globalThis.crypto.randomUUID()
    const controller: RequestController<T['Return']> = Object.assign(new AbortController(), {
      result: defer<T['Return']>(),
    })
    this.#controllers[id] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ type: 'abort', id } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    const action = args.length
      ? { type: 'request', id, name, params: args[0] }
      : { type: 'request', id, name }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id,
      result: controller.result.promise,
    }
  }

  async createStream<
    Name extends keyof ClientDefinitions['Streams'] & string,
    T extends ClientDefinitions['Streams'][Name] = ClientDefinitions['Streams'][Name],
  >(
    name: Name,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeStreamReturn<T['Receive'], T['Return']>> {
    const id = globalThis.crypto.randomUUID()
    const receive = createPipe<T['Receive']>()
    const controller: StreamController<T['Receive'], T['Return']> = Object.assign(
      new AbortController(),
      { receive: receive.writable.getWriter(), result: defer<T['Return']>() },
    )
    this.#controllers[id] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ type: 'abort', id } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    const action = args.length
      ? { type: 'stream', id, name, params: args[0] }
      : { type: 'stream', id, name }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id,
      receive: receive.readable.getReader(),
      result: controller.result.promise,
    }
  }

  async createChannel<
    Name extends keyof ClientDefinitions['Channels'] & string,
    T extends ClientDefinitions['Channels'][Name] = ClientDefinitions['Channels'][Name],
  >(
    name: Name,
    ...args: T['Argument'] extends never ? [] : [T['Argument']]
  ): Promise<InvokeChannelReturn<T['Send'], T['Receive'], T['Return']>> {
    const id = globalThis.crypto.randomUUID()
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
    this.#controllers[id] = controller

    controller.signal.addEventListener('abort', () => {
      void this.#write({ type: 'abort', id } as unknown as AnyClientPayloadOf<Definitions>)
      controller.result.reject(ABORTED)
    })

    // TODO: consume from send readable to push to transport

    const action = args.length
      ? { type: 'channel', id, name, params: args[0] }
      : { type: 'channel', id, name }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)

    return {
      abort: () => controller.abort(),
      id,
      receive: receive.readable.getReader(),
      result: controller.result.promise,
      send: async (value: T['Send']) => {
        // await controller.send.write(value)
        await this.#write({ type: 'send', id, value } as unknown as AnyClientPayloadOf<Definitions>)
      },
    }
  }
}
