import type { StoredMessage } from '@enkaku/hub-protocol'
import type { HubLike, HubPublishParams, HubReceiveSubscription } from '@enkaku/hub-tunnel'

type Sink = {
  push: (message: StoredMessage) => void
  close: () => void
}

/**
 * Durable in-memory HubLike modelling the real hub's retained log + the
 * client-adapter's redelivery. Unlike the live FakeHub, it keeps every published
 * message, tracks per-subscriber acks, and can redeliver unacked messages —
 * letting tests exercise tier-1 backlog replay across a disconnect.
 *
 * Test controls: `detach(did)` stops live delivery (peer "offline"),
 * `reattach(did)` resumes it, `redeliver(did)` pushes the subscriber's unacked
 * retained messages (reconnect backlog).
 */
export class DurableFakeHub implements HubLike {
  #seq = 0
  #log: Array<StoredMessage> = []
  #topics = new Map<string, Set<string>>()
  #sinks = new Map<string, Sink>()
  #live = new Map<string, boolean>()
  #acked = new Map<string, Set<string>>()

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
    const sequenceID = String(++this.#seq)
    const message: StoredMessage = {
      sequenceID,
      senderDID: params.senderDID,
      topicID: params.topicID,
      payload: params.payload,
    }
    this.#log.push(message)
    for (const did of this.#topics.get(params.topicID) ?? []) {
      if (did === params.senderDID) continue
      if (this.#live.get(did)) this.#sinks.get(did)?.push(message)
    }
    return { sequenceID }
  }

  #ack(subscriberDID: string, sequenceID: string): void {
    let set = this.#acked.get(subscriberDID)
    if (set == null) {
      set = new Set()
      this.#acked.set(subscriberDID, set)
    }
    set.add(sequenceID)
  }

  /** Stop live delivery to a subscriber (simulate going offline). */
  detach(subscriberDID: string): void {
    this.#live.set(subscriberDID, false)
  }

  /** Resume live delivery to a subscriber. */
  reattach(subscriberDID: string): void {
    this.#live.set(subscriberDID, true)
  }

  /** Push the subscriber's unacked retained messages (reconnect backlog replay). */
  redeliver(subscriberDID: string): void {
    const sink = this.#sinks.get(subscriberDID)
    if (sink == null) return
    const acked = this.#acked.get(subscriberDID) ?? new Set<string>()
    const subscribed = new Set(
      [...this.#topics].filter(([, dids]) => dids.has(subscriberDID)).map(([topic]) => topic),
    )
    for (const message of this.#log) {
      if (message.senderDID === subscriberDID) continue
      if (!subscribed.has(message.topicID)) continue
      if (acked.has(message.sequenceID)) continue
      sink.push(message)
    }
  }

  ackedCount(subscriberDID: string): number {
    return this.#acked.get(subscriberDID)?.size ?? 0
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
    this.#sinks.set(subscriberDID, sink)
    this.#live.set(subscriberDID, true)
    const remove = () => {
      sink.close()
      if (this.#sinks.get(subscriberDID) === sink) this.#sinks.delete(subscriberDID)
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
    return {
      [Symbol.asyncIterator]: () => iterator,
      return: remove,
      ack: (sequenceID: string) => this.#ack(subscriberDID, sequenceID),
    }
  }

  subscriberCount(topicID: string): number {
    return this.#topics.get(topicID)?.size ?? 0
  }
}
