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
import { type Deferred, defer } from '@enkaku/util'

export type InvokeReturn<Result> = {
  // biome-ignore lint/suspicious/noExplicitAny: from AbortController
  abort: (reason?: any) => void
  result: Promise<Result>
}

export type InvokeStreamReturn<Receive, Result> = InvokeReturn<Result> & {
  receive: AsyncIterable<Receive>
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
        Return: InvokeChannelReturn<Send, Receive, Result>
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

type StreamQueue<T> = ReadableWritablePair<T, T>

type StreamController<Receive, Result> = RequestController<Result> & {
  receive: StreamQueue<Receive>
}

type ChannelController<Send, Receive, Result> = StreamController<Receive, Result> & {
  send: StreamQueue<Send>
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
> {
  #meta: Meta
  #transport: ClientTransportOf<Definitions, Meta>
  #controllers: Record<string, AnyClientController> = {}

  constructor(params: ClientParams<Definitions, Meta>) {
    this.#meta = params.meta as Meta
    this.#transport = params.transport
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
          // TODO: cast to Error instance
          controller.result.reject(msg.action.error)
          delete this.#controllers[msg.action.id]
          break
        case 'receive':
          // TODO: push to stream or channel
          break
        case 'result':
          controller.result.resolve(msg.action.value)
          delete this.#controllers[msg.action.id]
          break
      }
    }
  }

  async #write(action: AnyClientPayloadOf<Definitions>): Promise<void> {
    await this.#transport.write({ action, meta: this.#meta })
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
  >(name: Name, ...args: T['Argument'] extends never ? [] : [T['Argument']]): Promise<T['Return']> {
    const id = globalThis.crypto.randomUUID()
    const controller: RequestController<T['Return']> = Object.assign(new AbortController(), {
      result: defer<T['Return']>(),
    })
    this.#controllers[id] = controller
    const action = args.length
      ? { type: 'request', id, name, params: args[0] }
      : { type: 'request', id, name }
    await this.#write(action as unknown as AnyClientPayloadOf<Definitions>)
    return controller.result.promise
  }

  // async createStream<Name extends keyof ClientDefinitions['Streams'] & string>(
  //   name: Name,
  //   params: ClientDefinitions['Streams'][Name]['Argument'],
  // ): Promise<ClientDefinitions['Streams'][Name]['Return']> {}

  // async createChannel<Name extends keyof ClientDefinitions['Channels'] & string>(
  //   name: Name,
  //   params: ClientDefinitions['Channels'][Name]['Argument'],
  // ): Promise<ClientDefinitions['Channels'][Name]['Return']> {}
}
