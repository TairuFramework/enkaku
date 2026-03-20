import type { RoutedMessage } from '@enkaku/hub-protocol'

export type ClientEntry = {
  did: string
  groups: Set<string>
  sendMessage: ((message: RoutedMessage) => void) | null
}

/**
 * Tracks connected clients and their group memberships.
 * Shared across hub handlers via closure.
 */
export class HubClientRegistry {
  #clients = new Map<string, ClientEntry>()
  #groupMembers = new Map<string, Set<string>>()

  register(did: string): ClientEntry {
    const existing = this.#clients.get(did)
    if (existing != null) {
      return existing
    }
    const entry: ClientEntry = { did, groups: new Set(), sendMessage: null }
    this.#clients.set(did, entry)
    return entry
  }

  unregister(did: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) return

    // Remove from all groups
    for (const groupID of entry.groups) {
      const members = this.#groupMembers.get(groupID)
      if (members != null) {
        members.delete(did)
        if (members.size === 0) {
          this.#groupMembers.delete(groupID)
        }
      }
    }
    this.#clients.delete(did)
  }

  setReceiveWriter(did: string, sendMessage: (message: RoutedMessage) => void): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.sendMessage = sendMessage
    }
  }

  clearReceiveWriter(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.sendMessage = null
    }
  }

  joinGroup(did: string, groupID: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) {
      throw new Error(`Client ${did} is not registered`)
    }
    entry.groups.add(groupID)

    let members = this.#groupMembers.get(groupID)
    if (members == null) {
      members = new Set()
      this.#groupMembers.set(groupID, members)
    }
    members.add(did)
  }

  leaveGroup(did: string, groupID: string): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.groups.delete(groupID)
    }

    const members = this.#groupMembers.get(groupID)
    if (members != null) {
      members.delete(did)
      if (members.size === 0) {
        this.#groupMembers.delete(groupID)
      }
    }
  }

  getOnlineGroupMembers(groupID: string): Array<string> {
    const members = this.#groupMembers.get(groupID)
    if (members == null) return []
    return Array.from(members).filter((did) => {
      const entry = this.#clients.get(did)
      return entry?.sendMessage != null
    })
  }

  getClient(did: string): ClientEntry | undefined {
    return this.#clients.get(did)
  }

  isOnline(did: string): boolean {
    const entry = this.#clients.get(did)
    return entry?.sendMessage != null
  }
}
