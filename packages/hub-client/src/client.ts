import type { ChannelCall, Client, RequestCall } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'

export type HubClientParams = {
  client: Client<HubProtocol>
}

export type SendParams = {
  recipients: Array<string>
  payload: string
}

export type GroupSendParams = {
  groupID: string
  payload: string
}

export type ReceiveOptions = {
  after?: string
  groupIDs?: Array<string>
}

type ReceiveMessage = {
  sequenceID: string
  senderDID: string
  groupID?: string
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

  send(params: SendParams): RequestCall<{ sequenceID: string }> {
    return this.#client.request('hub/send', {
      param: { recipients: params.recipients, payload: params.payload },
    })
  }

  groupSend(params: GroupSendParams): RequestCall<{ sequenceID: string }> {
    return this.#client.request('hub/group/send', {
      param: { groupID: params.groupID, payload: params.payload },
    })
  }

  receive(
    options?: ReceiveOptions,
  ): ChannelCall<ReceiveMessage, ReceiveAck, Record<string, never>> {
    return this.#client.createChannel('hub/receive', {
      param: {
        after: options?.after,
        groupIDs: options?.groupIDs,
      },
    })
  }

  joinGroup(groupID: string, credential = ''): RequestCall<{ joined: boolean }> {
    return this.#client.request('hub/group/join', {
      param: { groupID, credential },
    })
  }

  leaveGroup(groupID: string): RequestCall<{ left: boolean }> {
    return this.#client.request('hub/group/leave', {
      param: { groupID },
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
