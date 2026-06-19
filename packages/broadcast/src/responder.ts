import type { TransportType } from '@enkaku/transport'

import type { ReplyData, RequestData } from './client.js'
import type { BroadcastMessage } from './transport.js'

export type BroadcastHandler = (prm: unknown) => unknown | Promise<unknown>
export type SuppressConfig = { jitterMs?: number; suppressTtlMs?: number }
export type SuppressibleHandler = BroadcastHandler & { suppress: SuppressConfig }

const DEFAULT_JITTER_MS = 250
const DEFAULT_SUPPRESS_TTL_MS = 30_000

/** Tag a handler for jitter + observe-and-suppress storm-collapse. */
export function suppressible(
  handler: BroadcastHandler,
  config: SuppressConfig = {},
): SuppressibleHandler {
  return Object.assign(handler.bind(null) as BroadcastHandler, { suppress: config })
}

function isSuppressible(handler: BroadcastHandler): handler is SuppressibleHandler {
  return (handler as SuppressibleHandler).suppress != null
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defaultJitter(maxMs: number): number {
  return Math.floor(Math.random() * (maxMs + 1))
}

export type BroadcastResponderParams = {
  transport: TransportType<BroadcastMessage, BroadcastMessage>
  from: string
  handlers: Record<string, BroadcastHandler | SuppressibleHandler>
  sleep?: (ms: number) => Promise<void>
  getJitterMs?: (maxMs: number) => number
}

export function createBroadcastResponder(params: BroadcastResponderParams): {
  dispose: () => Promise<void>
} {
  const { transport, from, handlers } = params
  const sleep = params.sleep ?? defaultSleep
  const getJitterMs = params.getJitterMs ?? defaultJitter

  // Request IDs for which any reply (ours or another peer's) has been observed.
  const repliedTo = new Set<string>()
  let running = true

  const markReplied = (rid: string, ttlMs: number) => {
    repliedTo.add(rid)
    setTimeout(() => repliedTo.delete(rid), ttlMs)
  }

  const handleRequest = async (
    prc: string,
    request: RequestData,
    handler: BroadcastHandler | SuppressibleHandler,
  ): Promise<void> => {
    if (isSuppressible(handler)) {
      const { jitterMs = DEFAULT_JITTER_MS } = handler.suppress
      await sleep(getJitterMs(jitterMs))
      if (repliedTo.has(request.rid)) {
        return
      }
    }

    let reply: ReplyData
    try {
      const ok = await handler(request.prm)
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
    markReplied(request.rid, ttlMs)
    await transport.write({ payload: { typ: 'event', prc, data: reply } })
  }

  type InboundData = {
    kind?: string
    rid?: string
    from?: string
    prm?: unknown
    ok?: unknown
    err?: string
  }

  ;(async () => {
    for await (const msg of transport) {
      if (!running) {
        break
      }
      const payload = msg?.payload
      if (payload?.typ !== 'event') {
        continue
      }
      const data = payload.data as InboundData | undefined
      if (data?.kind === 'res' && typeof data.rid === 'string') {
        markReplied(data.rid, DEFAULT_SUPPRESS_TTL_MS)
        continue
      }
      if (data?.kind !== 'req' || typeof data.rid !== 'string' || typeof payload.prc !== 'string') {
        continue
      }
      const handler = handlers[payload.prc]
      if (handler != null) {
        void handleRequest(payload.prc, data as RequestData, handler)
      }
    }
  })()

  return {
    dispose: async () => {
      running = false
      await transport.dispose()
    },
  }
}
