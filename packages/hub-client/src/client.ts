import type { Client, RequestCall, StreamCall } from '@enkaku/client'
import type { HubProtocol, RoutedMessage } from '@enkaku/hub-protocol'

export type HubClientParams = {
  client: Client<HubProtocol>
}

type SendResult = { delivered: number; queued: number }
type JoinResult = { joined: boolean }
type LeaveResult = { left: boolean }
type UploadResult = { stored: number }
type FetchResult = { keyPackages: Array<string> }

type HubReceive = {
  senderDID: string
  groupID: string
  epoch: number
  contentType: 'commit' | 'proposal' | 'welcome' | 'application'
  payload: string
}

/**
 * Convenience wrapper around Client<HubProtocol> for hub interactions.
 */
export class HubClient {
  #client: Client<HubProtocol>

  constructor(params: HubClientParams) {
    this.#client = params.client
  }

  get rawClient(): Client<HubProtocol> {
    return this.#client
  }

  /**
   * Send an encrypted message to a group.
   */
  send(message: RoutedMessage): RequestCall<SendResult> {
    return this.#client.request('hub/send', {
      param: {
        groupID: message.groupID,
        epoch: message.epoch,
        contentType: message.contentType,
        payload: message.payload,
      },
    })
  }

  /**
   * Start receiving messages for the given groups.
   */
  receive(groups: Array<string>): StreamCall<HubReceive, unknown> {
    return this.#client.createStream('hub/receive', {
      param: { groups },
    })
  }

  /**
   * Join a group on the hub.
   */
  joinGroup(groupID: string, credential?: string): RequestCall<JoinResult> {
    return this.#client.request('hub/group/join', {
      param: { groupID, credential: credential ?? '' },
    })
  }

  /**
   * Leave a group on the hub.
   */
  leaveGroup(groupID: string): RequestCall<LeaveResult> {
    return this.#client.request('hub/group/leave', { param: { groupID } })
  }

  /**
   * Upload key packages to the hub.
   */
  uploadKeyPackages(keyPackages: Array<string>): RequestCall<UploadResult> {
    return this.#client.request('hub/keypackage/upload', {
      param: { keyPackages },
    })
  }

  /**
   * Fetch key packages for a DID.
   */
  fetchKeyPackages(did: string, count?: number): RequestCall<FetchResult> {
    return this.#client.request('hub/keypackage/fetch', {
      param: { did, count },
    })
  }
}
