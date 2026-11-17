import type { EventEmitter } from '@sozai/event'

import type { RequestError } from './error.js'

export type ClientRequestStatus = 'ok' | 'error' | 'aborted'

export type ClientEvents = {
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  lateReply: {
    rid: string
    procedure: string | null
    terminal: 'timeout' | 'aborted' | 'completed' | 'unknown'
    sinceTerminalMs: number | null
  }
  requestTimeout: {
    rid: string
    procedure: string
    budgetMs: number
    elapsedMs: number
    written: boolean
  }
  requestWritten: { rid: string; procedure: string; type: string }
  requestEnd: { rid: string; procedure: string; status: ClientRequestStatus }
  requestError: { rid: string; error: Error | RequestError }
  requestStart: { rid: string; procedure: string; type: string }
  transportError: { error: Error }
  transportReplaced: Record<string, never>
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid?: string }
}

export type ClientEmitter = EventEmitter<ClientEvents>
