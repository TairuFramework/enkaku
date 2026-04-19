import { isBenignTeardownError } from '@enkaku/async'

import type { ClientEmitter } from './events.js'

export type WriteTarget = { write: (message: unknown) => Promise<void> }

export type SafeWriteParams = {
  transport: WriteTarget
  message: unknown
  rid?: string
  events: ClientEmitter
  signal: AbortSignal
  /**
   * Called with the raw transport error when a write fails for a reason that
   * is NOT a benign teardown. Benign teardown errors are absorbed as
   * `writeDropped` events and do NOT invoke this callback. The callback is
   * the client's hook to propagate the failure into the per-rid controller so
   * the request/stream/channel promise rejects rather than hanging.
   */
  onFailure?: (error: Error) => void
}

/**
 * Send a client message through the transport. Classifies any failure as
 * either a benign teardown (swallowed → `writeDropped` event) or a real
 * transport failure (`writeFailed` event + `onFailure` hook for per-call
 * surfacing). Never rejects, so fire-and-forget callers do not need a
 * `.catch`; direct callers can still observe the failure by subscribing to
 * the events emitter or by supplying `onFailure`.
 */
export async function safeWrite(params: SafeWriteParams): Promise<void> {
  const { transport, message, rid, events, signal, onFailure } = params
  try {
    await transport.write(message)
    return
  } catch (error) {
    if (isBenignTeardownError(error) && signal.aborted) {
      await events.emit('writeDropped', {
        rid,
        reason: 'disposing',
        error: error as Error,
      })
      return
    }
    await events.emit('writeFailed', { error: error as Error, rid })
    onFailure?.(error as Error)
  }
}
