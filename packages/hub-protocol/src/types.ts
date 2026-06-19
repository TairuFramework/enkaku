import type { EventEmitter } from '@enkaku/event'

/** Opaque message stored by the hub — minimal metadata for routing only. */
export type StoredMessage = {
  sequenceID: string
  senderDID: string
  topicID: string
  payload: Uint8Array
}

export type PublishParams = {
  senderDID: string
  topicID: string
  payload: Uint8Array
}

export type FetchParams = {
  recipientDID: string
  after?: string
  limit?: number
  ack?: Array<string>
}

export type FetchResult = {
  messages: Array<StoredMessage>
  cursor: string | null
  hasMore?: boolean
}

export type AckParams = {
  recipientDID: string
  sequenceIDs: Array<string>
}

export type PurgeParams = {
  olderThan: number
}

export type HubStoreEvents = {
  purge: { sequenceIDs: Array<string> }
}

export type HubStore = {
  events: EventEmitter<HubStoreEvents>
  publish(params: PublishParams): Promise<string>
  fetch(params: FetchParams): Promise<FetchResult>
  ack(params: AckParams): Promise<void>
  purge(params: PurgeParams): Promise<Array<string>>
  subscribe(subscriberDID: string, topicID: string): Promise<void>
  unsubscribe(subscriberDID: string, topicID: string): Promise<void>
  getSubscribers(topicID: string): Promise<Array<string>>
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
}
