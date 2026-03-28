import { EventEmitter } from '@enkaku/event'
import type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PurgeParams,
  StoredMessage,
  StoreParams,
} from '@enkaku/hub-protocol'

type MessageRecord = {
  sequenceID: string
  senderDID: string
  groupID?: string
  payload: Uint8Array
  recipients: Set<string>
  storedAt: number
}

function formatSequenceID(counter: number): string {
  return String(counter).padStart(12, '0')
}

/**
 * In-memory implementation of HubStore for testing and development.
 */
export function createMemoryStore(): HubStore {
  let counter = 0
  const messages = new Map<string, MessageRecord>()
  const deliveries = new Map<string, Array<string>>()
  const keyPackages = new Map<string, Array<string>>()
  const groupMembers = new Map<string, Array<string>>()
  const events = new EventEmitter<HubStoreEvents>()

  function removeDelivery(recipientDID: string, sequenceID: string): void {
    const recipientDeliveries = deliveries.get(recipientDID)
    if (recipientDeliveries == null) return

    const index = recipientDeliveries.indexOf(sequenceID)
    if (index !== -1) {
      recipientDeliveries.splice(index, 1)
    }

    const record = messages.get(sequenceID)
    if (record != null) {
      record.recipients.delete(recipientDID)
      if (record.recipients.size === 0) {
        messages.delete(sequenceID)
      }
    }
  }

  return {
    events,

    async store(params: StoreParams): Promise<string> {
      counter++
      const sequenceID = formatSequenceID(counter)

      const record: MessageRecord = {
        sequenceID,
        senderDID: params.senderDID,
        payload: params.payload,
        recipients: new Set(params.recipients),
        storedAt: Date.now(),
      }
      if (params.groupID != null) {
        record.groupID = params.groupID
      }

      messages.set(sequenceID, record)

      for (const recipient of params.recipients) {
        let recipientDeliveries = deliveries.get(recipient)
        if (recipientDeliveries == null) {
          recipientDeliveries = []
          deliveries.set(recipient, recipientDeliveries)
        }
        recipientDeliveries.push(sequenceID)
      }

      return sequenceID
    },

    async fetch(params: FetchParams): Promise<FetchResult> {
      // Process acks first if provided
      if (params.ack != null && params.ack.length > 0) {
        for (const sequenceID of params.ack) {
          removeDelivery(params.recipientDID, sequenceID)
        }
      }

      const recipientDeliveries = deliveries.get(params.recipientDID)
      if (recipientDeliveries == null || recipientDeliveries.length === 0) {
        return { messages: [], cursor: null }
      }

      // Filter by after cursor
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
          const msg: StoredMessage = {
            sequenceID: record.sequenceID,
            senderDID: record.senderDID,
            payload: record.payload,
          }
          if (record.groupID != null) {
            msg.groupID = record.groupID
          }
          resultMessages.push(msg)
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
          // Remove all delivery records for this message
          for (const recipient of record.recipients) {
            const recipientDeliveries = deliveries.get(recipient)
            if (recipientDeliveries != null) {
              const index = recipientDeliveries.indexOf(sequenceID)
              if (index !== -1) {
                recipientDeliveries.splice(index, 1)
              }
            }
          }
          messages.delete(sequenceID)
        }
      }

      if (purgedIDs.length > 0) {
        await events.emit('purge', { sequenceIDs: purgedIDs })
      }

      return purgedIDs
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

    async setGroupMembers(groupID: string, members: Array<string>): Promise<void> {
      groupMembers.set(groupID, [...members])
    },

    async getGroupMembers(groupID: string): Promise<Array<string>> {
      return groupMembers.get(groupID) ?? []
    },
  }
}
