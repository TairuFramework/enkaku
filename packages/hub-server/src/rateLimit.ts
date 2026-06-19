export type RateLimitConfig = {
  /** Sustained refill rate in tokens per second. */
  rate: number
  /** Maximum bucket capacity (burst). */
  burst: number
}

export type RateLimiter = {
  /** Consumes a token if available, returning true; returns false otherwise. */
  tryConsume(key: string): boolean
}

type Bucket = {
  tokens: number
  lastRefill: number
}

/** Per-key token-bucket rate limiter. */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const buckets = new Map<string, Bucket>()
  return {
    tryConsume(key: string): boolean {
      const now = Date.now()
      let bucket = buckets.get(key)
      if (bucket == null) {
        bucket = { tokens: config.burst, lastRefill: now }
        buckets.set(key, bucket)
      } else {
        const elapsedSeconds = (now - bucket.lastRefill) / 1000
        bucket.tokens = Math.min(config.burst, bucket.tokens + elapsedSeconds * config.rate)
        bucket.lastRefill = now
      }
      if (bucket.tokens < 1) {
        return false
      }
      bucket.tokens -= 1
      return true
    },
  }
}
