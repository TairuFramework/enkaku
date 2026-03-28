import type { EventEmitter } from '@enkaku/event'

/** Opaque message stored by the hub — minimal metadata for routing only. */
export type StoredMessage = {
  sequenceID: string
  senderDID: string
  groupID?: string
  payload: Uint8Array
}

export type StoreParams = {
  senderDID: string
  recipients: Array<string>
  payload: Uint8Array
  groupID?: string
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
  store(params: StoreParams): Promise<string>
  fetch(params: FetchParams): Promise<FetchResult>
  ack(params: AckParams): Promise<void>
  purge(params: PurgeParams): Promise<Array<string>>
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
  setGroupMembers(groupID: string, members: Array<string>): Promise<void>
  getGroupMembers(groupID: string): Promise<Array<string>>
}
