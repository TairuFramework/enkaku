export type ReplayCache = {
  /**
   * Atomically check whether `key` was already recorded, and record it.
   * Returns `true` if fresh (first sight), `false` if a replay.
   * `expiresAt` is the epoch-millisecond time after which the entry may be evicted.
   */
  checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean>
}

export type MemoryReplayCacheParams = {
  maxEntries?: number
  now?: () => number
}

const DEFAULT_MAX_ENTRIES = 10_000

export class MemoryReplayCache implements ReplayCache {
  #entries = new Map<string, number>() // key -> expiresAt (epoch ms)
  #maxEntries: number
  #now: () => number

  constructor(params: MemoryReplayCacheParams = {}) {
    this.#maxEntries = params.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.#now = params.now ?? Date.now
  }

  checkAndRecord(key: string, expiresAt: number): boolean {
    const now = this.#now()
    const existing = this.#entries.get(key)
    if (existing != null && existing > now) {
      return false
    }
    // Delete-then-set keeps Map insertion order newest-last (LRU ordering).
    this.#entries.delete(key)
    this.#entries.set(key, expiresAt)
    this.#evict(now)
    return true
  }

  #evict(now: number): void {
    if (this.#entries.size <= this.#maxEntries) return
    // First drop expired entries.
    for (const [key, exp] of this.#entries) {
      if (exp <= now) this.#entries.delete(key)
      if (this.#entries.size <= this.#maxEntries) return
    }
    // Still over cap: evict oldest insertion-order entries.
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string
      this.#entries.delete(oldest)
    }
  }
}
