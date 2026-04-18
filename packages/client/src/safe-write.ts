import { isBenignTeardownError } from '@enkaku/async'

import type { ClientEmitter } from './events.js'

export type WriteTarget = { write: (message: unknown) => Promise<void> }

export type SafeWriteParams = {
  transport: WriteTarget
  message: unknown
  rid?: string
  events: ClientEmitter
  disposing: { value: boolean }
}

export async function safeWrite(params: SafeWriteParams): Promise<void> {
  const { transport, message, rid, events, disposing } = params
  try {
    await transport.write(message)
  } catch (error) {
    if (isBenignTeardownError(error) && disposing.value) {
      await events.emit('writeDropped', {
        rid,
        reason: 'disposing',
        error: error as Error,
      })
      return
    }
    throw error
  }
}
