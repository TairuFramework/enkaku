import type { HubStore, RoutedMessage } from '@enkaku/hub-protocol'

/**
 * In-memory implementation of HubStore for testing.
 */
export function createMemoryStore(): HubStore {
  const queues = new Map<string, Array<RoutedMessage>>()
  const keyPackages = new Map<string, Array<string>>()
  const groupMembers = new Map<string, Array<string>>()

  return {
    async enqueue(recipientDID: string, message: RoutedMessage): Promise<void> {
      let queue = queues.get(recipientDID)
      if (queue == null) {
        queue = []
        queues.set(recipientDID, queue)
      }
      queue.push(message)
    },

    async dequeue(recipientDID: string, limit?: number): Promise<Array<RoutedMessage>> {
      const queue = queues.get(recipientDID)
      if (queue == null || queue.length === 0) return []
      const count = limit ?? queue.length
      return queue.splice(0, count)
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
