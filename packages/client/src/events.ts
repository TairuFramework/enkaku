import type { EventEmitter } from '@enkaku/event'

import type { RequestError } from './error.js'

export type ClientRequestStatus = 'ok' | 'error' | 'aborted'

export type ClientEvents = {
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  requestEnd: { rid: string; procedure: string; status: ClientRequestStatus }
  requestError: { rid: string; error: Error | RequestError }
  requestStart: { rid: string; procedure: string; type: string }
  transportError: { error: Error }
  transportReplaced: Record<string, never>
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid?: string }
}

export type ClientEmitter = EventEmitter<ClientEvents>
