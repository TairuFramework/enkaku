import type {
  BroadcastHandler,
  BroadcastMessage,
  SuppressConfig,
  SuppressibleHandler,
} from '@enkaku/broadcast'
import type { TransportType } from '@enkaku/transport'

const DEFAULT_JITTER_MS = 250
const DEFAULT_SUPPRESS_TTL_MS = 30_000

type ReplyData = { kind: 'res'; rid: string; from: string; ok?: unknown; err?: string }
type RequestData = { kind: 'req'; rid: string; prm: unknown; gather?: boolean }

export type GroupBusServerParams = {
  transport: TransportType<BroadcastMessage, BroadcastMessage>
  from: string
  /** Fire-and-forget event procedures: prc -> handler(data, senderDID). */
  eventHandlers: Record<string, (data: unknown, senderDID?: string) => void | Promise<void>>
  /** Anycast request procedures: prc -> handler(param, { senderDID }) -> result. */
  requestHandlers: Record<string, BroadcastHandler | SuppressibleHandler>
  sleep?: (ms: number) => Promise<void>
  getJitterMs?: (maxMs: number) => number
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
function defaultJitter(maxMs: number): number {
  return Math.floor(Math.random() * (maxMs + 1))
}
function isSuppressible(handler: BroadcastHandler): handler is SuppressibleHandler {
  return (handler as SuppressibleHandler).suppress != null
}

/**
 * Bus-side server for a single protocol topic: dispatches plain events to
 * `eventHandlers` and anycast requests to `requestHandlers` (with the same
 * jitter + observe-and-suppress storm-collapse as `createBroadcastResponder`),
 * forwarding the unwrap-recovered `senderDID` to both.
 */
export function createGroupBusServer(params: GroupBusServerParams): {
  dispose: () => Promise<void>
} {
  const { transport, from, eventHandlers, requestHandlers } = params
  const sleep = params.sleep ?? defaultSleep
  const getJitterMs = params.getJitterMs ?? defaultJitter

  const suppressTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let running = true

  const markReplied = (rid: string, ttlMs: number): void => {
    if (suppressTimers.has(rid)) return
    const timer = setTimeout(() => suppressTimers.delete(rid), ttlMs)
    suppressTimers.set(rid, timer)
  }

  const handleRequest = async (
    prc: string,
    request: RequestData,
    handler: BroadcastHandler | SuppressibleHandler,
    senderDID?: string,
  ): Promise<void> => {
    const isGather = request.gather === true
    if (!isGather && isSuppressible(handler)) {
      const { jitterMs = DEFAULT_JITTER_MS } = handler.suppress
      await sleep(getJitterMs(jitterMs))
      if (suppressTimers.has(request.rid)) return
    }
    let reply: ReplyData
    try {
      const ok = await handler(request.prm, { senderDID })
      reply = { kind: 'res', rid: request.rid, from, ok }
    } catch (error) {
      reply = {
        kind: 'res',
        rid: request.rid,
        from,
        err: error instanceof Error ? error.message : String(error),
      }
    }
    const ttlMs = isSuppressible(handler)
      ? (handler.suppress.suppressTtlMs ?? DEFAULT_SUPPRESS_TTL_MS)
      : DEFAULT_SUPPRESS_TTL_MS
    if (!isGather) markReplied(request.rid, ttlMs)
    await transport.write({ payload: { typ: 'event', prc, data: reply } }).catch(() => {})
  }

  type InboundData = { kind?: string; rid?: string; prm?: unknown; gather?: boolean }

  void (async () => {
    for await (const msg of transport) {
      if (!running) break
      const payload = msg?.payload
      if (payload?.typ !== 'event' || typeof payload.prc !== 'string') continue
      const data = payload.data as InboundData | undefined
      if (data?.kind === 'res' && typeof data.rid === 'string') {
        markReplied(data.rid, DEFAULT_SUPPRESS_TTL_MS)
        continue
      }
      if (data?.kind === 'req' && typeof data.rid === 'string') {
        const handler = requestHandlers[payload.prc]
        if (handler != null) {
          void handleRequest(payload.prc, data as RequestData, handler, msg.senderDID)
        }
        continue
      }
      const eventHandler = eventHandlers[payload.prc]
      if (eventHandler != null) {
        void Promise.resolve(eventHandler(payload.data, msg.senderDID)).catch(() => {})
      }
    }
  })().catch(() => {})

  return {
    dispose: async () => {
      running = false
      for (const timer of suppressTimers.values()) clearTimeout(timer)
      suppressTimers.clear()
      await transport.dispose()
    },
  }
}

export type { SuppressConfig }
