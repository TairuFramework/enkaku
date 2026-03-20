import type { Client } from '@enkaku/client'
import type { HubProtocol, RoutedMessage } from '@enkaku/hub-protocol'

export type HubClientParams = {
  client: Client<HubProtocol>
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
  async send(message: RoutedMessage): Promise<{ delivered: number; queued: number }> {
    return await this.#client.request('hub/send', {
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
   * Returns a readable stream of RoutedMessage.
   */
  receive(groups: Array<string>): {
    readable: ReadableStream<RoutedMessage>
    close: () => void
  } {
    const stream = this.#client.createStream('hub/receive', {
      param: { groups },
    })
    return {
      readable: stream.readable as ReadableStream<RoutedMessage>,
      close: () => stream.close(),
    }
  }

  /**
   * Join a group on the hub.
   */
  async joinGroup(groupID: string, credential?: string): Promise<void> {
    await this.#client.request('hub/group/join', {
      param: { groupID, credential: credential ?? '' },
    })
  }

  /**
   * Leave a group on the hub.
   */
  async leaveGroup(groupID: string): Promise<void> {
    await this.#client.request('hub/group/leave', { param: { groupID } })
  }

  /**
   * Upload key packages to the hub.
   */
  async uploadKeyPackages(keyPackages: Array<string>): Promise<number> {
    const result = await this.#client.request('hub/keypackage/upload', {
      param: { keyPackages },
    })
    return result.stored
  }

  /**
   * Fetch key packages for a DID.
   */
  async fetchKeyPackages(did: string, count?: number): Promise<Array<string>> {
    const result = await this.#client.request('hub/keypackage/fetch', {
      param: { did, count },
    })
    return result.keyPackages
  }
}
