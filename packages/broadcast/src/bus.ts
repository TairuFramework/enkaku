/**
 * Abstraction over a 1→N publish/subscribe bus addressed by opaque topic IDs.
 * The hub implements this in Phase 2; `createMemoryBus` is the in-process fake.
 */
export type BroadcastBus = {
  publish(topicID: string, payload: Uint8Array): void | Promise<void>
  subscribe(topicID: string, onMessage: (payload: Uint8Array) => void): () => void
}

/** In-memory fan-out bus for tests and in-process use. */
export function createMemoryBus(): BroadcastBus {
  const topics = new Map<string, Set<(payload: Uint8Array) => void>>()
  return {
    publish(topicID, payload) {
      const subscribers = topics.get(topicID)
      if (subscribers == null) {
        return
      }
      for (const onMessage of [...subscribers]) {
        onMessage(payload)
      }
    },
    subscribe(topicID, onMessage) {
      let subscribers = topics.get(topicID)
      if (subscribers == null) {
        subscribers = new Set()
        topics.set(topicID, subscribers)
      }
      subscribers.add(onMessage)
      return () => {
        subscribers?.delete(onMessage)
        if (subscribers?.size === 0) {
          topics.delete(topicID)
        }
      }
    },
  }
}
