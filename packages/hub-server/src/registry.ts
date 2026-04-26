import type { StoredMessage } from '@enkaku/hub-protocol'

export type ClientEntry = {
  did: string
  groups: Set<string>
  sendMessage: ((message: StoredMessage) => void) | null
}

export class HubClientRegistry {
  #clients = new Map<string, ClientEntry>()
  #groupMembers = new Map<string, Set<string>>()

  register(did: string): ClientEntry {
    const existing = this.#clients.get(did)
    if (existing != null) {
      return existing
    }
    const entry: ClientEntry = {
      did,
      groups: new Set(),
      sendMessage: null,
    }
    this.#clients.set(did, entry)
    return entry
  }

  unregister(did: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
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

  setReceiveWriter(did: string, writer: (message: StoredMessage) => void): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    if (entry.sendMessage != null) {
      throw new Error(`receive writer already bound for DID ${did}`)
    }
    entry.sendMessage = writer
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
      throw new Error(`Client ${did} not registered`)
    }
    entry.groups.add(groupID)
    const members = this.#groupMembers.get(groupID) ?? new Set()
    members.add(did)
    this.#groupMembers.set(groupID, members)
  }

  leaveGroup(did: string, groupID: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    entry.groups.delete(groupID)
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
    return [...members].filter((did) => {
      const entry = this.#clients.get(did)
      return entry?.sendMessage != null
    })
  }

  getGroupMembers(groupID: string): Array<string> {
    const members = this.#groupMembers.get(groupID)
    if (members == null) return []
    return [...members]
  }

  getClient(did: string): ClientEntry | undefined {
    return this.#clients.get(did)
  }

  isOnline(did: string): boolean {
    return this.#clients.get(did)?.sendMessage != null
  }

  isWriterBound(did: string): boolean {
    return this.#clients.get(did)?.sendMessage != null
  }
}
