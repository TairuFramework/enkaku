import type { StoredMessage } from '@enkaku/hub-protocol'

import type { HubLikeEvent, HubLikeEventListener, HubPublishParams } from '../../src/transport.js'

export type FakeHubPublishParams = HubPublishParams
export type FakeHubMessage = StoredMessage

type Subscriber = {
  push: (message: FakeHubMessage) => void
  close: () => void
}

type DeliveryAction =
  | { kind: 'normal' }
  | { kind: 'drop' }
  | { kind: 'duplicate' }
  | { kind: 'delay'; ms: number }
  | { kind: 'swap-hold' }
  | { kind: 'swap-flush' }

export class FakeHub {
  #sequence = 0
  // subscriberDID → set of live receive streams
  #subscribers = new Map<string, Set<Subscriber>>()
  // topicID → set of subscriberDIDs
  #topics = new Map<string, Set<string>>()
  #pendingDrops = 0
  #pendingDuplicates = 0
  #pendingDelays: Array<number> = []
  #pendingSwap = 0
  #heldForSwap: Array<{ recipient: string; message: FakeHubMessage }> = []
  #eventListeners = new Set<HubLikeEventListener>()

  events = {
    subscribe: (listener: HubLikeEventListener): (() => void) => {
      this.#eventListeners.add(listener)
      return () => {
        this.#eventListeners.delete(listener)
      }
    },
  }

  #emitEvent(event: HubLikeEvent): void {
    for (const listener of this.#eventListeners) {
      listener(event)
    }
  }

  simulateReconnecting(): void {
    this.#emitEvent({ type: 'reconnecting' })
  }

  simulateConnected(): void {
    this.#emitEvent({ type: 'connected' })
  }

  simulateDisconnected(): void {
    this.#emitEvent({ type: 'disconnected' })
  }

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
    if (set.size === 0) {
      this.#topics.delete(topicID)
    }
  }

  async publish(params: FakeHubPublishParams): Promise<{ sequenceID: string }> {
    const sequenceID = String(++this.#sequence)
    const message: FakeHubMessage = {
      sequenceID,
      senderDID: params.senderDID,
      topicID: params.topicID,
      payload: params.payload,
    }

    const recipients = this.#topics.get(params.topicID)
    if (recipients != null) {
      for (const recipient of recipients) {
        const action = this.#nextAction()
        this.#deliver(recipient, message, action)
      }
    }

    return { sequenceID }
  }

  receive(subscriberDID: string): AsyncIterable<FakeHubMessage> & { return: () => void } {
    const queue: Array<FakeHubMessage> = []
    const waiters: Array<(value: IteratorResult<FakeHubMessage>) => void> = []
    let closed = false

    const subscriber: Subscriber = {
      push(message) {
        if (closed) return
        const waiter = waiters.shift()
        if (waiter != null) {
          waiter({ value: message, done: false })
        } else {
          queue.push(message)
        }
      },
      close() {
        if (closed) return
        closed = true
        while (waiters.length > 0) {
          const w = waiters.shift()
          w?.({ value: undefined as unknown as FakeHubMessage, done: true })
        }
      },
    }

    let set = this.#subscribers.get(subscriberDID)
    if (set == null) {
      set = new Set()
      this.#subscribers.set(subscriberDID, set)
    }
    set.add(subscriber)

    const detach = (): void => {
      const current = this.#subscribers.get(subscriberDID)
      if (current != null) {
        current.delete(subscriber)
        if (current.size === 0) {
          this.#subscribers.delete(subscriberDID)
        }
      }
    }

    const iterator: AsyncIterator<FakeHubMessage> = {
      next() {
        if (queue.length > 0) {
          const value = queue.shift() as FakeHubMessage
          return Promise.resolve({ value, done: false })
        }
        if (closed) {
          return Promise.resolve({ value: undefined as unknown as FakeHubMessage, done: true })
        }
        return new Promise((resolve) => {
          waiters.push(resolve)
        })
      },
      return() {
        subscriber.close()
        detach()
        return Promise.resolve({ value: undefined as unknown as FakeHubMessage, done: true })
      },
    }

    return {
      [Symbol.asyncIterator]() {
        return iterator
      },
      return() {
        subscriber.close()
        detach()
      },
    }
  }

  subscriberCount(subscriberDID: string): number {
    const set = this.#subscribers.get(subscriberDID)
    return set == null ? 0 : set.size
  }

  disconnect(subscriberDID: string): void {
    const set = this.#subscribers.get(subscriberDID)
    if (set == null) return
    for (const subscriber of set) {
      subscriber.close()
    }
    this.#subscribers.delete(subscriberDID)
  }

  dropNext(n: number): void {
    this.#pendingDrops += n
  }

  duplicateNext(n: number): void {
    this.#pendingDuplicates += n
  }

  delayNext(ms: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.#pendingDelays.push(ms)
    }
  }

  swapNextPair(): void {
    this.#pendingSwap = 2
  }

  #nextAction(): DeliveryAction {
    if (this.#pendingDrops > 0) {
      this.#pendingDrops--
      return { kind: 'drop' }
    }
    if (this.#pendingDuplicates > 0) {
      this.#pendingDuplicates--
      return { kind: 'duplicate' }
    }
    if (this.#pendingDelays.length > 0) {
      const ms = this.#pendingDelays.shift() as number
      return { kind: 'delay', ms }
    }
    if (this.#pendingSwap > 0) {
      this.#pendingSwap--
      return this.#pendingSwap === 0 ? { kind: 'swap-flush' } : { kind: 'swap-hold' }
    }
    return { kind: 'normal' }
  }

  #deliver(recipient: string, message: FakeHubMessage, action: DeliveryAction): void {
    const subscribers = this.#subscribers.get(recipient)
    if (subscribers == null || subscribers.size === 0) return

    const push = (): void => {
      for (const sub of subscribers) {
        sub.push(message)
      }
    }

    switch (action.kind) {
      case 'drop':
        return
      case 'normal':
        push()
        return
      case 'duplicate':
        push()
        push()
        return
      case 'delay':
        setTimeout(push, action.ms)
        return
      case 'swap-hold':
        this.#heldForSwap.push({ recipient, message })
        return
      case 'swap-flush': {
        push()
        const held = this.#heldForSwap.splice(0)
        for (const { recipient: r, message: m } of held) {
          const subs = this.#subscribers.get(r)
          if (subs == null) continue
          for (const sub of subs) {
            sub.push(m)
          }
        }
        return
      }
    }
  }
}
