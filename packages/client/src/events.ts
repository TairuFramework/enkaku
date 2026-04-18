import type { EventEmitter } from '@enkaku/event'

import type { RequestError } from './error.js'

export type ClientRequestStatus = 'ok' | 'error' | 'aborted'

export type ClientEvents = {
  requestStart: { rid: string; procedure: string; type: string }
  requestEnd: { rid: string; procedure: string; status: ClientRequestStatus }
  requestError: { rid: string; error: Error | RequestError }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  transportError: { error: Error }
  transportReplaced: Record<string, never>
  disposing: { reason?: unknown }
  disposed: { reason?: unknown }
}

export type ClientEmitter = EventEmitter<ClientEvents>
