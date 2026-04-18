import { isBenignTeardownError } from '@enkaku/async'

import type { ClientEmitter } from './events.js'

export type WriteTarget = {
  // biome-ignore lint/suspicious/noExplicitAny: transport write accepts protocol-specific messages
  write: (message: any) => Promise<void>
}

export type SafeWriteParams = {
  transport: WriteTarget
  // biome-ignore lint/suspicious/noExplicitAny: callers pass typed messages via the write method
  message: any
  rid?: string
  events: ClientEmitter
  disposing: { value: boolean }
}

export async function safeWrite(params: SafeWriteParams): Promise<void> {
  const { transport, message, rid, events, disposing } = params
  try {
    await transport.write(message)
  } catch (error) {
    if (isBenignTeardownError(error)) {
      const reason = disposing.value ? 'disposing' : 'benign'
      await events.emit('writeDropped', {
        rid,
        reason,
        error: error as Error,
      })
      return
    }
    throw error
  }
}
