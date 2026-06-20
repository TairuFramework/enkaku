import type { StoredMessage } from '@enkaku/hub-protocol'
import type { HubLike, HubPublishParams, HubReceiveSubscription } from '@enkaku/hub-tunnel'

type Sink = {
  push: (message: StoredMessage) => void
  close: () => void
}

/**
 * In-memory HubLike (bytes) for tests. Synchronous fan-out: publish delivers to
 * every subscriber of the topic except the sender. `receive(did)` yields every
 * message delivered to `did` across all its subscribed topics, matching the real
 * hub's single-drain contract.
 */
export class FakeHub implements HubLike {
  #sequence = 0
  #topics = new Map<string, Set<string>>()
  #sinks = new Map<string, Set<Sink>>()
  /** Append-only log of every published message, for test assertions. */
  published: Array<StoredMessage> = []

  subscribe(subscriberDID: string, topicID: string): void {
    let set = this.#topics.get(topicID)
    if (set == null) {
      set = new Set()
      this.#topics.set(topicID, set)
    }
    set.add(subscriberDID)
  }

  unsubscribe(subscriberDID: string, topicID: string): void {
    const set = this.#topics.get(topicID)
    if (set == null) return
    set.delete(subscriberDID)
    if (set.size === 0) this.#topics.delete(topicID)
  }

  async publish(params: HubPublishParams): Promise<{ sequenceID: string }> {
    const sequenceID = String(++this.#sequence)
    const message: StoredMessage = {
      sequenceID,
      senderDID: params.senderDID,
      topicID: params.topicID,
      payload: params.payload,
    }
    this.published.push(message)
    for (const did of [...(this.#topics.get(params.topicID) ?? [])]) {
      if (did === params.senderDID) continue
      for (const sink of this.#sinks.get(did) ?? []) sink.push(message)
    }
    return { sequenceID }
  }

  receive(subscriberDID: string): HubReceiveSubscription {
    const queue: Array<StoredMessage> = []
    let resolveNext: ((result: IteratorResult<StoredMessage>) => void) | undefined
    let closed = false
    const sink: Sink = {
      push: (message) => {
        if (closed) return
        if (resolveNext != null) {
          const resolve = resolveNext
          resolveNext = undefined
          resolve({ value: message, done: false })
        } else {
          queue.push(message)
        }
      },
      close: () => {
        closed = true
        if (resolveNext != null) {
          const resolve = resolveNext
          resolveNext = undefined
          resolve({ value: undefined as unknown as StoredMessage, done: true })
        }
      },
    }
    let set = this.#sinks.get(subscriberDID)
    if (set == null) {
      set = new Set()
      this.#sinks.set(subscriberDID, set)
    }
    set.add(sink)
    const remove = () => {
      sink.close()
      this.#sinks.get(subscriberDID)?.delete(sink)
    }
    const iterator: AsyncIterator<StoredMessage> = {
      next: () => {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift() as StoredMessage, done: false })
        }
        if (closed) {
          return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
        }
        return new Promise((resolve) => {
          resolveNext = resolve
        })
      },
      return: () => {
        remove()
        return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
      },
    }
    return { [Symbol.asyncIterator]: () => iterator, return: remove }
  }

  subscriberCount(topicID: string): number {
    return this.#topics.get(topicID)?.size ?? 0
  }
}
