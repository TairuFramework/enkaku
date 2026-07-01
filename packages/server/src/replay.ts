import { normalizeDID, type SignedToken } from '@kokuin/token'

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
    // Delete-then-set keeps Map insertion order newest-last (insertion-order / FIFO eviction).
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

export type ReplayOptions = {
  enabled?: boolean
  cache?: ReplayCache
  maxAge?: number // milliseconds; fallback window for messages without exp
  rejectStale?: boolean
  maxEntries?: number
  now?: () => number
}

export type ResolvedReplay = {
  cache: ReplayCache
  maxAge: number
  rejectStale: boolean
  now: () => number
}

const DEFAULT_MAX_AGE = 60_000

export function resolveReplay(
  options: ReplayOptions | undefined,
  requireAuth: boolean,
): ResolvedReplay | null {
  if (!requireAuth) return null
  if (options?.enabled === false) return null
  const now = options?.now ?? Date.now
  return {
    cache: options?.cache ?? new MemoryReplayCache({ maxEntries: options?.maxEntries, now }),
    maxAge: options?.maxAge ?? DEFAULT_MAX_AGE,
    rejectStale: options?.rejectStale ?? true,
    now,
  }
}

export type ReplayCheckResult =
  | { ok: true }
  | { ok: false; reason: 'replay_detected' | 'replay_stale' }

/**
 * Precondition: must only be called on messages that have already passed signature
 * verification -- the dedup key falls back to `message.signature` when `jti` is absent,
 * and that fallback is only tamper-safe once the signature itself is verified.
 */
export async function checkReplay(
  message: SignedToken,
  resolved: ResolvedReplay,
): Promise<ReplayCheckResult> {
  const payload = message.payload as {
    iss: string
    jti?: string
    exp?: number
    iat?: number
  }
  const now = resolved.now()
  // Token exp/iat claims are seconds; convert to milliseconds for comparison.
  const expMs = payload.exp != null ? payload.exp * 1000 : undefined
  const iatMs = payload.iat != null ? payload.iat * 1000 : undefined

  if (resolved.rejectStale) {
    if (expMs != null) {
      if (now > expMs) return { ok: false, reason: 'replay_stale' }
    } else if (iatMs != null && now > iatMs + resolved.maxAge) {
      return { ok: false, reason: 'replay_stale' }
    }
  }

  const expiresAt = expMs ?? (iatMs ?? now) + resolved.maxAge
  const key = `${normalizeDID(payload.iss)}:${payload.jti ?? message.signature}`
  const fresh = await resolved.cache.checkAndRecord(key, expiresAt)
  return fresh ? { ok: true } : { ok: false, reason: 'replay_detected' }
}
