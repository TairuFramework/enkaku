import { fromB64, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore, StoredMessage } from '@enkaku/hub-protocol'
import {
  type ChannelHandler,
  HandlerError,
  type ProcedureHandlers,
  type RequestHandler,
} from '@enkaku/server'

import { createRateLimiter, type RateLimitConfig } from './rateLimit.js'
import type { HubClientRegistry } from './registry.js'

export type AuthorizeAction = 'publish' | 'subscribe'

export type AuthorizeHook = (
  did: string,
  action: AuthorizeAction,
  topicID: string,
) => boolean | Promise<boolean>

export type HubRateLimits = {
  perDID: RateLimitConfig
  perTopic: RateLimitConfig
}

export const DEFAULT_RATE_LIMITS: HubRateLimits = {
  perDID: { rate: 20, burst: 50 },
  perTopic: { rate: 100, burst: 200 },
}

export type KeyPackageFetchLimits = {
  /** Maximum number of key packages returned per fetch. Default: 10 */
  maxCount: number
  /** Maximum number of fetch requests per requester DID per window. Default: 30 */
  maxRequests: number
  /** Rate-limit window duration in milliseconds. Default: 60000 (1 min) */
  windowMs: number
}

export const DEFAULT_KEYPACKAGE_FETCH_LIMITS: KeyPackageFetchLimits = {
  maxCount: 10,
  maxRequests: 30,
  windowMs: 60_000,
}

export type CreateHandlersParams = {
  registry: HubClientRegistry
  store: HubStore
  authorize?: AuthorizeHook
  rateLimits?: Partial<HubRateLimits>
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
}

function getClientDID(ctx: { message: { payload: Record<string, unknown> } }): string {
  const iss = ctx.message.payload.iss
  if (typeof iss !== 'string' || iss.length === 0) {
    throw new Error('Unauthenticated message: missing verified issuer DID')
  }
  return iss
}

export function createHandlers(params: CreateHandlersParams): ProcedureHandlers<HubProtocol> {
  const { store, registry } = params
  const authorize: AuthorizeHook = params.authorize ?? (() => true)
  const rateLimits: HubRateLimits = {
    perDID: { ...DEFAULT_RATE_LIMITS.perDID, ...params.rateLimits?.perDID },
    perTopic: { ...DEFAULT_RATE_LIMITS.perTopic, ...params.rateLimits?.perTopic },
  }
  const didLimiter = createRateLimiter(rateLimits.perDID)
  const topicLimiter = createRateLimiter(rateLimits.perTopic)

  const fetchLimits: KeyPackageFetchLimits = {
    ...DEFAULT_KEYPACKAGE_FETCH_LIMITS,
    ...params.keyPackageFetchLimits,
  }
  const fetchWindows = new Map<string, { count: number; resetAt: number }>()

  function assertKeyPackageFetchAllowed(requesterDID: string): void {
    const now = Date.now()
    if (fetchWindows.size > 1024) {
      for (const [did, window] of fetchWindows) {
        if (window.resetAt <= now) {
          fetchWindows.delete(did)
        }
      }
    }
    const window = fetchWindows.get(requesterDID)
    if (window == null || window.resetAt <= now) {
      fetchWindows.set(requesterDID, { count: 1, resetAt: now + fetchLimits.windowMs })
      return
    }
    if (window.count >= fetchLimits.maxRequests) {
      throw new Error('Key package fetch rate limit exceeded')
    }
    window.count++
  }

  return {
    'hub/publish': (async (ctx) => {
      const { topicID, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      if (!(await authorize(senderDID, 'publish', topicID))) {
        throw new HandlerError({ code: 'EK02', message: 'Not authorized to publish to topic' })
      }
      if (!didLimiter.tryConsume(senderDID)) {
        throw new HandlerError({ code: 'EK01', message: 'Publish rate limit exceeded for DID' })
      }
      if (!topicLimiter.tryConsume(topicID)) {
        throw new HandlerError({ code: 'EK01', message: 'Publish rate limit exceeded for topic' })
      }
      const payloadBytes = fromB64(payload)
      const sequenceID = await store.publish({ senderDID, topicID, payload: payloadBytes })

      // Live-deliver to currently-connected subscribers (minus the sender).
      const subscribers = await store.getSubscribers(topicID)
      for (const recipientDID of subscribers) {
        if (recipientDID === senderDID) continue
        const client = registry.getClient(recipientDID)
        if (client?.sendMessage != null) {
          client.sendMessage({ sequenceID, senderDID, topicID, payload: payloadBytes })
        }
      }

      return { sequenceID }
    }) as RequestHandler<HubProtocol, 'hub/publish'>,

    'hub/subscribe': (async (ctx) => {
      const { topicID } = ctx.param
      const clientDID = getClientDID(ctx)
      if (!(await authorize(clientDID, 'subscribe', topicID))) {
        throw new HandlerError({ code: 'EK02', message: 'Not authorized to subscribe to topic' })
      }
      await store.subscribe(clientDID, topicID)
      return { subscribed: true }
    }) as RequestHandler<HubProtocol, 'hub/subscribe'>,

    'hub/unsubscribe': (async (ctx) => {
      const { topicID } = ctx.param
      const clientDID = getClientDID(ctx)
      await store.unsubscribe(clientDID, topicID)
      return { unsubscribed: true }
    }) as RequestHandler<HubProtocol, 'hub/unsubscribe'>,

    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after } = ctx.param ?? {}

      registry.register(clientDID)
      if (registry.isWriterBound(clientDID)) {
        throw new HandlerError({
          code: 'EK01',
          message: `receive writer already bound for DID ${clientDID}`,
        })
      }

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      try {
        registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
          writer
            .write({
              sequenceID: message.sequenceID,
              senderDID: message.senderDID,
              topicID: message.topicID,
              payload: toB64(message.payload),
            })
            .catch(() => {})
        })

        let cursor: string | null | undefined = after
        while (true) {
          const result = await store.fetch({
            recipientDID: clientDID,
            after: cursor ?? undefined,
            limit: 50,
          })
          for (const msg of result.messages) {
            await writer.write({
              sequenceID: msg.sequenceID,
              senderDID: msg.senderDID,
              topicID: msg.topicID,
              payload: toB64(msg.payload),
            })
          }
          cursor = result.cursor
          if (!result.hasMore) break
        }
      } catch (error) {
        registry.clearReceiveWriter(clientDID)
        registry.unregisterIfIdle(clientDID)
        reader.cancel().catch(() => {})
        writer.abort(error).catch(() => {})
        throw error
      }

      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value?.ack != null) {
              await store.ack({ recipientDID: clientDID, sequenceIDs: value.ack })
            }
          }
        } catch {
          // Channel closed
        }
      })()

      return new Promise((resolve) => {
        ctx.signal.addEventListener(
          'abort',
          () => {
            registry.clearReceiveWriter(clientDID)
            registry.unregisterIfIdle(clientDID)
            reader.cancel().catch(() => {})
            writer.close().catch(() => {})
            resolve(undefined as never)
          },
          { once: true },
        )
      })
    }) as ChannelHandler<HubProtocol, 'hub/receive'>,

    'hub/keypackage/upload': (async (ctx) => {
      const { keyPackages } = ctx.param
      const clientDID = getClientDID(ctx)
      await Promise.all(keyPackages.map((kp: string) => store.storeKeyPackage(clientDID, kp)))
      return { stored: keyPackages.length }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/upload'>,

    'hub/keypackage/fetch': (async (ctx) => {
      const requesterDID = getClientDID(ctx)
      assertKeyPackageFetchAllowed(requesterDID)
      const { did, count } = ctx.param
      const cappedCount = Math.min(Math.max(count ?? 1, 1), fetchLimits.maxCount)
      const keyPackages = await store.fetchKeyPackages(did, cappedCount)
      return { keyPackages }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/fetch'>,
  }
}
