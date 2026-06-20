import type { ChannelCall, Client, RequestCall } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'

export type HubClientParams = {
  client: Client<HubProtocol>
}

export type PublishParams = {
  topicID: string
  payload: string
}

export type ReceiveOptions = {
  after?: string
}

type ReceiveMessage = {
  sequenceID: string
  senderDID: string
  topicID: string
  payload: string
}

type ReceiveAck = {
  ack: Array<string>
}

export class HubClient {
  #client: Client<HubProtocol>

  constructor(params: HubClientParams) {
    this.#client = params.client
  }

  get rawClient(): Client<HubProtocol> {
    return this.#client
  }

  publish(params: PublishParams): RequestCall<{ sequenceID: string }> {
    return this.#client.request('hub/publish', {
      param: { topicID: params.topicID, payload: params.payload },
    })
  }

  subscribe(topicID: string): RequestCall<{ subscribed: boolean }> {
    return this.#client.request('hub/subscribe', {
      param: { topicID },
    })
  }

  unsubscribe(topicID: string): RequestCall<{ unsubscribed: boolean }> {
    return this.#client.request('hub/unsubscribe', {
      param: { topicID },
    })
  }

  receive(
    options?: ReceiveOptions,
  ): ChannelCall<ReceiveMessage, ReceiveAck, Record<string, never>> {
    return this.#client.createChannel('hub/receive', {
      param: {
        after: options?.after,
      },
    })
  }

  uploadKeyPackages(keyPackages: Array<string>): RequestCall<{ stored: number }> {
    return this.#client.request('hub/keypackage/upload', {
      param: { keyPackages },
    })
  }

  fetchKeyPackages(did: string, count?: number): RequestCall<{ keyPackages: Array<string> }> {
    return this.#client.request('hub/keypackage/fetch', {
      param: { did, count },
    })
  }
}
