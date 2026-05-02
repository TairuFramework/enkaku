import type { DecryptError, EnvelopeDecodeError } from './errors.js'

export type FrameDroppedReason =
  | 'envelope-decode'
  | 'decrypt'
  | 'sender-mismatch'
  | 'session-mismatch'
  | 'dedup'

export type ObservabilityEvent =
  | { type: 'decrypt-failed'; error: DecryptError }
  | { type: 'envelope-decode-failed'; error: EnvelopeDecodeError }
  | { type: 'frame-dropped'; reason: FrameDroppedReason }

export type ObservabilityEventListener = (event: ObservabilityEvent) => void
