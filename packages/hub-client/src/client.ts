import type { Client } from '@enkaku/client'
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

export class HubClient {
  #client: Client<HubProtocol>

  constructor(params: HubClientParams) {
    this.#client = params.client
  }

  get rawClient(): Client<HubProtocol> {
    return this.#client
  }

  send(params: SendParams) {
    return this.#client.request('hub/send', {
      param: { recipients: params.recipients, payload: params.payload },
    })
  }

  groupSend(params: GroupSendParams) {
    return this.#client.request('hub/group/send', {
      param: { groupID: params.groupID, payload: params.payload },
    })
  }

  receive(options?: ReceiveOptions) {
    return this.#client.createChannel('hub/receive', {
      param: {
        after: options?.after,
        groupIDs: options?.groupIDs,
      },
    })
  }

  joinGroup(groupID: string, credential = '') {
    return this.#client.request('hub/group/join', {
      param: { groupID, credential },
    })
  }

  leaveGroup(groupID: string) {
    return this.#client.request('hub/group/leave', {
      param: { groupID },
    })
  }

  uploadKeyPackages(keyPackages: Array<string>) {
    return this.#client.request('hub/keypackage/upload', {
      param: { keyPackages },
    })
  }

  fetchKeyPackages(did: string, count?: number) {
    return this.#client.request('hub/keypackage/fetch', {
      param: { did, count },
    })
  }
}
