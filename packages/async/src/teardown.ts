import { DisposeInterruption } from './interruptions.js'

const CLOSED_STREAM_PATTERNS = [
  /WritableStream is closed/i,
  /(?:writer|reader)(?:\s|\S)*?(?:is|has been)\s+closed/i,
]

const BENIGN_REASON_STRINGS = new Set(['Close', 'Transport'])

/**
 * Returns true when the given error represents a peer- or local-teardown
 * signal rather than an actual failure. Call this before re-throwing on
 * teardown paths so benign rejections can be swallowed.
 */
export function isBenignTeardownError(err: unknown): boolean {
  if (err == null) return false
  if (typeof err === 'string') return BENIGN_REASON_STRINGS.has(err)
  if (err instanceof DisposeInterruption) return true
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true
    if (typeof err.message === 'string') {
      for (const pattern of CLOSED_STREAM_PATTERNS) {
        if (pattern.test(err.message)) return true
      }
    }
  }
  return false
}
