import type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PublishParams,
  PurgeParams,
  StoredMessage,
} from '@enkaku/hub-protocol'
import { EventEmitter } from '@sozai/event'

type MessageRecord = {
  sequenceID: string
  senderDID: string
  topicID: string
  payload: Uint8Array
  recipients: Set<string>
  storedAt: number
}

export type MemoryStoreOptions = {
  /** Per-topic max retained messages; oldest are trimmed beyond this. Default 1000. */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 1000

function formatSequenceID(counter: number): string {
  return String(counter).padStart(12, '0')
}

/**
 * In-memory implementation of HubStore for testing and development.
 *
 * Single message copy + per-subscriber delivery index + refcount GC. Recipients
 * are resolved from the subscription table at publish time, never passed in.
 */
export function createMemoryStore(options: MemoryStoreOptions = {}): HubStore {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  let counter = 0
  const messages = new Map<string, MessageRecord>()
  const deliveries = new Map<string, Array<string>>()
  const subscriptions = new Map<string, Set<string>>()
  const topicMessages = new Map<string, Array<string>>()
  const keyPackages = new Map<string, Array<string>>()
  const events = new EventEmitter<HubStoreEvents>()

  // Remove a message entirely: every recipient delivery list, the topic log,
  // and the message record.
  function deleteMessage(sequenceID: string): void {
    const record = messages.get(sequenceID)
    if (record == null) return
    for (const recipient of record.recipients) {
      const list = deliveries.get(recipient)
      if (list != null) {
        const index = list.indexOf(sequenceID)
        if (index !== -1) list.splice(index, 1)
      }
    }
    const topicLog = topicMessages.get(record.topicID)
    if (topicLog != null) {
      const index = topicLog.indexOf(sequenceID)
      if (index !== -1) topicLog.splice(index, 1)
      if (topicLog.length === 0) topicMessages.delete(record.topicID)
    }
    messages.delete(sequenceID)
  }

  // Drop one subscriber's delivery of a message; GC the message when its last
  // recipient is gone (refcount → 0).
  function removeDelivery(recipientDID: string, sequenceID: string): void {
    const list = deliveries.get(recipientDID)
    if (list != null) {
      const index = list.indexOf(sequenceID)
      if (index !== -1) list.splice(index, 1)
    }
    const record = messages.get(sequenceID)
    if (record != null) {
      record.recipients.delete(recipientDID)
      if (record.recipients.size === 0) {
        deleteMessage(sequenceID)
      }
    }
  }

  return {
    events,

    async publish(params: PublishParams): Promise<string> {
      counter++
      const sequenceID = formatSequenceID(counter)

      // Recipients = current subscribers minus the sender. Zero recipients
      // (no subscribers, or only the sender) → drop immediately, store nothing.
      const subscribers = subscriptions.get(params.topicID)
      const recipients = new Set<string>()
      if (subscribers != null) {
        for (const did of subscribers) {
          if (did !== params.senderDID) recipients.add(did)
        }
      }
      if (recipients.size === 0) {
        return sequenceID
      }

      const record: MessageRecord = {
        sequenceID,
        senderDID: params.senderDID,
        topicID: params.topicID,
        payload: params.payload,
        recipients,
        storedAt: Date.now(),
      }
      messages.set(sequenceID, record)

      for (const recipient of recipients) {
        let list = deliveries.get(recipient)
        if (list == null) {
          list = []
          deliveries.set(recipient, list)
        }
        list.push(sequenceID)
      }

      let topicLog = topicMessages.get(params.topicID)
      if (topicLog == null) {
        topicLog = []
        topicMessages.set(params.topicID, topicLog)
      }
      topicLog.push(sequenceID)
      // Per-topic max-depth trim: drop oldest beyond the bound.
      while (topicLog.length > maxDepth) {
        deleteMessage(topicLog[0])
      }

      return sequenceID
    },

    async fetch(params: FetchParams): Promise<FetchResult> {
      if (params.ack != null && params.ack.length > 0) {
        for (const sequenceID of params.ack) {
          removeDelivery(params.recipientDID, sequenceID)
        }
      }

      const recipientDeliveries = deliveries.get(params.recipientDID)
      if (recipientDeliveries == null || recipientDeliveries.length === 0) {
        return { messages: [], cursor: null }
      }

      let startIndex = 0
      if (params.after != null) {
        const afterIndex = recipientDeliveries.indexOf(params.after)
        if (afterIndex !== -1) {
          startIndex = afterIndex + 1
        }
      }

      const available = recipientDeliveries.slice(startIndex)
      const limit = params.limit ?? available.length
      const selected = available.slice(0, limit)
      const hasMore = available.length > limit

      const resultMessages: Array<StoredMessage> = []
      for (const sequenceID of selected) {
        const record = messages.get(sequenceID)
        if (record != null) {
          resultMessages.push({
            sequenceID: record.sequenceID,
            senderDID: record.senderDID,
            topicID: record.topicID,
            payload: record.payload,
          })
        }
      }

      const cursor =
        resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].sequenceID : null

      const result: FetchResult = { messages: resultMessages, cursor }
      if (hasMore) {
        result.hasMore = true
      }
      return result
    },

    async ack(params: AckParams): Promise<void> {
      for (const sequenceID of params.sequenceIDs) {
        removeDelivery(params.recipientDID, sequenceID)
      }
    },

    async purge(params: PurgeParams): Promise<Array<string>> {
      const threshold = Date.now() - params.olderThan * 1000
      const purgedIDs: Array<string> = []
      for (const [sequenceID, record] of messages) {
        if (record.storedAt <= threshold) {
          purgedIDs.push(sequenceID)
          deleteMessage(sequenceID)
        }
      }
      if (purgedIDs.length > 0) {
        await events.emit('purge', { sequenceIDs: purgedIDs })
      }
      return purgedIDs
    },

    async subscribe(subscriberDID: string, topicID: string): Promise<void> {
      let subs = subscriptions.get(topicID)
      if (subs == null) {
        subs = new Set()
        subscriptions.set(topicID, subs)
      }
      subs.add(subscriberDID)
    },

    async unsubscribe(subscriberDID: string, topicID: string): Promise<void> {
      const subs = subscriptions.get(topicID)
      if (subs != null) {
        subs.delete(subscriberDID)
        if (subs.size === 0) {
          subscriptions.delete(topicID)
        }
      }
      // Drop this subscriber's pending deliveries for the topic.
      const list = deliveries.get(subscriberDID)
      if (list != null) {
        for (const sequenceID of [...list]) {
          const record = messages.get(sequenceID)
          if (record != null && record.topicID === topicID) {
            removeDelivery(subscriberDID, sequenceID)
          }
        }
      }
      // Last subscriber gone → drop the whole topic log immediately.
      if (!subscriptions.has(topicID)) {
        const topicLog = topicMessages.get(topicID)
        if (topicLog != null) {
          for (const sequenceID of [...topicLog]) {
            deleteMessage(sequenceID)
          }
        }
      }
    },

    async getSubscribers(topicID: string): Promise<Array<string>> {
      const subs = subscriptions.get(topicID)
      return subs == null ? [] : [...subs]
    },

    async storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void> {
      let packages = keyPackages.get(ownerDID)
      if (packages == null) {
        packages = []
        keyPackages.set(ownerDID, packages)
      }
      packages.push(keyPackage)
    },

    async fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>> {
      const packages = keyPackages.get(ownerDID)
      if (packages == null || packages.length === 0) return []
      const n = count ?? 1
      return packages.splice(0, n)
    },
  }
}
