import type {
  ChannelCall,
  Client,
  ClientDefinitionsType,
  RequestCall,
  StreamCall,
} from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import serialize from 'canonicalize'

export function createRequestKey(procedure: string, arg?: unknown): string {
  return [procedure, arg ? serialize(arg) : ''].join(':')
}

export type ReferencedCall<Call extends RequestCall<unknown>> = [Call, () => void]

export type CachedCall = {
  call: RequestCall<unknown>
  references: Set<string>
}

export type ClientCache = Map<string, CachedCall>

export type ReactClientParams<
  P extends ProtocolDefinition = ProtocolDefinition,
  Definitions extends ClientDefinitionsType<P> = ClientDefinitionsType<P>,
> = {
  cache?: ClientCache
  client: Client<P, Definitions>
}

export class ReactClient<
  P extends ProtocolDefinition = ProtocolDefinition,
  Definitions extends ClientDefinitionsType<P> = ClientDefinitionsType<P>,
> {
  #cache: ClientCache
  #client: Client<P, Definitions>

  constructor(params: ReactClientParams<P, Definitions>) {
    this.#cache = params.cache ?? new Map()
    this.#client = params.client
  }

  async sendEvent<
    Procedure extends keyof Definitions['Events'] & string,
    T extends Definitions['Events'][Procedure] = Definitions['Events'][Procedure],
  >(procedure: Procedure, ...args: T['Data'] extends never ? [] : [T['Data']]): Promise<void> {
    await this.#client.sendEvent(procedure, ...args)
  }

  #execute<Call extends RequestCall<unknown>>(
    procedure: string,
    cacheID: string | undefined,
    param: unknown | undefined,
    executeCall: () => Call,
  ): ReferencedCall<Call> {
    if (cacheID == null) {
      const call = executeCall()
      return [call, () => call.abort()]
    }

    const key = createRequestKey(procedure, param)
    const release = () => this.#release(key, cacheID)

    const existing = this.#cache.get(key)
    if (existing != null) {
      existing.references.add(cacheID)
      return [existing.call as Call, release]
    }

    const call = executeCall()
    this.#cache.set(key, { call, references: new Set([cacheID]) })
    return [call, release]
  }

  #release(requestKey: string, cacheID: string) {
    const cached = this.#cache.get(requestKey)
    if (cached != null) {
      cached.references.delete(cacheID)
      if (cached.references.size === 0) {
        cached.call.abort()
        this.#cache.delete(requestKey)
      }
    }
  }

  request<
    Procedure extends keyof Definitions['Requests'] & string,
    T extends Definitions['Requests'][Procedure] = Definitions['Requests'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { cacheID?: string; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { cacheID?: string; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): ReferencedCall<RequestCall<T['Result']>> {
    const config = args[0] ?? {}
    return this.#execute(procedure, config.cacheID, config.param, () => {
      return this.#client.request(procedure, ...args)
    })
  }

  createStream<
    Procedure extends keyof Definitions['Streams'] & string,
    T extends Definitions['Streams'][Procedure] = Definitions['Streams'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { cacheID?: string; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { cacheID?: string; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): ReferencedCall<StreamCall<T['Receive'], T['Result']>> {
    const config = args[0] ?? {}
    return this.#execute(procedure, config.cacheID, config.param, () => {
      return this.#client.createStream(procedure, ...args)
    })
  }

  createChannel<
    Procedure extends keyof Definitions['Channels'] & string,
    T extends Definitions['Channels'][Procedure] = Definitions['Channels'][Procedure],
  >(
    procedure: Procedure,
    ...args: T['Param'] extends never
      ? [config?: { cacheID?: string; id?: string; param?: never; signal?: AbortSignal }]
      : [config: { cacheID?: string; id?: string; param: T['Param']; signal?: AbortSignal }]
  ): ReferencedCall<ChannelCall<T['Receive'], T['Send'], T['Result']>> {
    const config = args[0] ?? {}
    return this.#execute(procedure, config.cacheID, config.param, () => {
      return this.#client.createChannel(procedure, ...args)
    })
  }
}
