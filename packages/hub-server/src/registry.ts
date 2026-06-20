import type { StoredMessage } from '@enkaku/hub-protocol'

export type ClientEntry = {
  did: string
  sendMessage: ((message: StoredMessage) => void) | null
}

/**
 * Tracks online clients and their live receive-channel writers. Subscription
 * state is durable in the store, not here — the registry only routes live
 * fan-out to currently-connected subscribers.
 */
export class HubClientRegistry {
  #clients = new Map<string, ClientEntry>()

  register(did: string): ClientEntry {
    const existing = this.#clients.get(did)
    if (existing != null) {
      return existing
    }
    const entry: ClientEntry = { did, sendMessage: null }
    this.#clients.set(did, entry)
    return entry
  }

  unregister(did: string): void {
    this.#clients.delete(did)
  }

  /** Removes the entry only when no receive writer is bound. */
  unregisterIfIdle(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null && entry.sendMessage == null) {
      this.#clients.delete(did)
    }
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
