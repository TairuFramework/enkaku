import { AbortInterruption, TimeoutInterruption } from '@enkaku/async'
import type { StoredMessage, StoreParams } from '@enkaku/hub-protocol'
import { Transport, type TransportType } from '@enkaku/transport'

import {
  BackpressureError,
  FrameDecodeError,
  HubReconnectingError,
  SessionNotEstablishedError,
} from './errors.js'
import type { ObservabilityEventListener } from './events.js'
import { decodeFrame, encodeFrame, type HubFrame } from './frame.js'

export type HubReceiveSubscription = AsyncIterable<StoredMessage> & {
  return?: () => void
}

export type HubLikeEvent =
  | { type: 'reconnecting' }
  | { type: 'connected' }
  | { type: 'disconnected' }

export type HubLikeEventListener = (event: HubLikeEvent) => void

export type HubLikeEvents = {
  subscribe: (listener: HubLikeEventListener) => () => void
}

export type HubLike = {
  send: (params: StoreParams) => Promise<{ sequenceID: string }>
  receive: (deviceDID: string) => HubReceiveSubscription
  events?: HubLikeEvents
}

export type HubTunnelSessionID = string | { auto: true }

export type HubTunnelTransportParams = {
  hub: HubLike
  sessionID: HubTunnelSessionID
  localDID: string
  peerDID: string
  inboxCapacity?: number
  idleTimeoutMs?: number
  reconnectTimeoutMs?: number
  signal?: AbortSignal
  onEvent?: ObservabilityEventListener
  /**
   * Fired exactly once when the peer signals graceful end-of-session via the
   * `session-end` frame kind. Listeners use this to dispose the transport
   * deterministically (so a fresh transport can be spawned for the next
   * session arriving on the same peer-keyed inbox). Non-error path —
   * `teardown(error)` paths emit through `onEvent` instead.
   */
  onSessionEnd?: () => void
}

const DEFAULT_INBOX_CAPACITY = 1024

/**
 * Build a hub-tunnel transport. The returned `TransportType` reads from a
 * single inbox subscription and writes to the hub via `hub.send`.
 *
 * **Contract notes (relied on by callers):**
 * - `hub.receive(localDID)` is called **exactly once** during construction.
 *   Callers wrapping `HubLike` (e.g. `createEncryptedHubTunnelTransport`)
 *   can rely on this for resource accounting.
 * - On any teardown path (signal abort, idle timeout, encrypt failure,
 *   peer-side `session-end`, manual `transport.dispose()`), this transport
 *   sends a best-effort `session-end` frame to the peer.
 */
export function createHubTunnelTransport<R, W>(
  params: HubTunnelTransportParams,
): TransportType<R, W> {
  const {
    hub,
    sessionID,
    localDID,
    peerDID,
    signal,
    idleTimeoutMs,
    reconnectTimeoutMs,
    onEvent,
    onSessionEnd,
  } = params
  const inboxCapacity = params.inboxCapacity ?? DEFAULT_INBOX_CAPACITY

  let lockedSessionID: string | null = typeof sessionID === 'string' ? sessionID : null

  let outboundSeq = 0
  let expectedSeq = 0
  const subscription = hub.receive(localDID)
  const iterator = subscription[Symbol.asyncIterator]()

  let abortHandler: (() => void) | undefined
  let torndown = false
  let readableController: ReadableStreamDefaultController<R> | undefined
  let lastActivity = Date.now()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribeEvents: (() => void) | undefined

  const clearIdleTimer = (): void => {
    if (idleTimer != null) {
      clearTimeout(idleTimer)
      idleTimer = undefined
    }
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  const sendSessionEnd = (): void => {
    if (lockedSessionID == null) return
    const frame: HubFrame = {
      v: 1,
      sessionID: lockedSessionID,
      kind: 'session-end',
      // Out-of-band control frame — does not advance `outboundSeq` so the
      // data-stream sequence numbers stay dense for debugging.
      seq: outboundSeq,
    }
    // Best-effort: fire-and-forget; failure here means the peer never sees
    // the end marker and falls back on its own teardown signals (idle, etc.).
    void hub
      .send({
        senderDID: localDID,
        recipients: [peerDID],
        payload: encodeFrame(frame),
      })
      .catch(() => {
        // ignore
      })
  }

  const teardown = (error?: unknown): void => {
    if (torndown) return
    torndown = true
    clearIdleTimer()
    clearReconnectTimer()
    if (unsubscribeEvents != null) {
      unsubscribeEvents()
      unsubscribeEvents = undefined
    }
    if (abortHandler != null && signal != null) {
      signal.removeEventListener('abort', abortHandler)
      abortHandler = undefined
    }
    // Always notify the peer the session is ending — abort, idle, and graceful
    // close all warrant a clean end marker so the responder can dispose its
    // locked transport and accept a fresh session. Best-effort; if hub.send
    // throws we swallow it (the peer falls back on its own teardown signals).
    sendSessionEnd()
    if (error !== undefined && readableController != null) {
      try {
        readableController.error(error)
      } catch {
        // controller may already be closed
      }
    }
    iterator.return?.()
  }

  const scheduleIdleTimer = (): void => {
    if (idleTimeoutMs == null || torndown) return
    clearIdleTimer()
    const elapsed = Date.now() - lastActivity
    const remaining = idleTimeoutMs - elapsed
    const delay = remaining > 0 ? remaining : 0
    idleTimer = setTimeout(() => {
      idleTimer = undefined
      if (torndown) return
      const sinceActivity = Date.now() - lastActivity
      if (sinceActivity >= idleTimeoutMs) {
        teardown(new TimeoutInterruption({ message: 'idle timeout' }))
      } else {
        scheduleIdleTimer()
      }
    }, delay)
  }

  const markActivity = (): void => {
    lastActivity = Date.now()
  }

  const readable = new ReadableStream<R>(
    {
      start(controller) {
        readableController = controller
        if (signal?.aborted === true) {
          teardown(new AbortInterruption({ cause: signal.reason }))
          return
        }
        scheduleIdleTimer()
        void (async () => {
          while (true) {
            let result: IteratorResult<StoredMessage>
            try {
              result = await iterator.next()
            } catch (error) {
              if (!torndown) {
                torndown = true
                clearIdleTimer()
                controller.error(error)
              }
              return
            }
            if (torndown) return
            if (result.done) {
              torndown = true
              clearIdleTimer()
              controller.close()
              return
            }
            const message = result.value
            if (message.senderDID !== peerDID) {
              onEvent?.({ type: 'frame-dropped', reason: 'sender-mismatch' })
              continue
            }
            let frame: HubFrame
            try {
              frame = decodeFrame(message.payload)
            } catch (error) {
              if (error instanceof FrameDecodeError) continue
              teardown(error)
              return
            }
            if (lockedSessionID == null) {
              lockedSessionID = frame.sessionID
            } else if (frame.sessionID !== lockedSessionID) {
              onEvent?.({ type: 'frame-dropped', reason: 'session-mismatch' })
              continue
            }
            if (frame.kind === 'session-end') {
              // Peer signaled graceful end-of-session. Close the readable and
              // notify the caller via `onSessionEnd` so they can dispose the
              // transport (no error path) — that emits `events.disposed` and
              // any listener spawn loop can re-arm for the next session.
              torndown = true
              clearIdleTimer()
              try {
                controller.close()
              } catch {
                // already closed
              }
              iterator.return?.()
              onSessionEnd?.()
              return
            }
            if (frame.kind !== 'message') {
              // Defensive — schema validation already restricted to 'message' or 'session-end'.
              continue
            }
            if (frame.seq < expectedSeq) {
              onEvent?.({ type: 'frame-dropped', reason: 'dedup' })
              continue
            }
            const desired = controller.desiredSize
            if (desired != null && desired <= 0) {
              const err = new BackpressureError(
                `Hub tunnel inbox overflow: capacity=${inboxCapacity} session=${lockedSessionID}`,
              )
              teardown(err)
              return
            }
            expectedSeq = frame.seq + 1
            markActivity()
            controller.enqueue(frame.body as R)
          }
        })()
      },
      cancel() {
        teardown()
      },
    },
    new CountQueuingStrategy({ highWaterMark: inboxCapacity }),
  )

  const writable = new WritableStream<W>({
    async write(value) {
      if (torndown) {
        throw new Error('Hub tunnel transport torn down')
      }
      if (lockedSessionID == null) {
        throw new SessionNotEstablishedError(
          'hub-tunnel: cannot send before session is established',
        )
      }
      const frame: HubFrame = {
        v: 1,
        sessionID: lockedSessionID,
        kind: 'message',
        seq: outboundSeq++,
        body: value as unknown as Extract<HubFrame, { kind: 'message' }>['body'],
      }
      await hub.send({
        senderDID: localDID,
        recipients: [peerDID],
        payload: encodeFrame(frame),
      })
      markActivity()
    },
    close() {
      teardown()
    },
    abort() {
      teardown()
    },
  })

  const transport = new Transport<R, W>({ stream: { readable, writable } })

  if (signal != null && signal.aborted !== true) {
    abortHandler = (): void => {
      teardown(new AbortInterruption({ cause: signal.reason }))
    }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  transport.events.on('disposed', () => {
    teardown()
  })

  if (reconnectTimeoutMs != null && hub.events != null) {
    const armReconnectTimer = (): void => {
      if (torndown || reconnectTimer != null) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        if (torndown) return
        teardown(new HubReconnectingError('reconnect timeout exceeded'))
      }, reconnectTimeoutMs)
    }
    unsubscribeEvents = hub.events.subscribe((event) => {
      if (torndown) return
      switch (event.type) {
        case 'reconnecting':
        case 'disconnected':
          armReconnectTimer()
          return
        case 'connected':
          clearReconnectTimer()
          return
      }
    })
  }

  return transport
}
