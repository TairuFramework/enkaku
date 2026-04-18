import { isBenignTeardownError } from '@enkaku/async'

import type { ClientEmitter } from './events.js'

export type WriteTarget = { write: (message: unknown) => Promise<void> }

export type SafeWriteParams = {
  transport: WriteTarget
  message: unknown
  rid?: string
  events: ClientEmitter
  signal: AbortSignal
}

/**
 * Send a client message through the transport, classifying any failure as
 * either a benign teardown (swallowed → `writeDropped` event) or a real
 * transport failure (`requestError`/`transportError` surfaces via the Client's
 * read loop or the calling path). Never rejects, so callers can fire-and-forget
 * without attaching `.catch`.
 */
export async function safeWrite(params: SafeWriteParams): Promise<void> {
  const { transport, message, rid, events, signal } = params
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
  }
}
