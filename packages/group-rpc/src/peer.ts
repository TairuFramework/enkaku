import {
  BroadcastClient,
  createBroadcastTransport,
  defaultJitter,
  defaultRandomID,
  type GatheredReply,
  type GatherOptions,
  type RequestOptions,
  type SuppressConfig,
} from '@enkaku/broadcast'
import type { Client } from '@enkaku/client'
import type { StoredMessage } from '@enkaku/hub-protocol'
import type { HubLike } from '@enkaku/hub-tunnel'
import type { ProtocolDefinition } from '@enkaku/protocol'
import type { ProcedureHandlers } from '@enkaku/server'

import { createGroupBusServer } from './bus-server.js'
import type { GroupCrypto, GroupMLS } from './crypto.js'
import { createDirectedClient, createInboxAcceptor } from './directed.js'
import { adaptBusHandlers } from './handlers.js'
import { decodeHandshakeFrame, encodeHandshakeFrame, HANDSHAKE_KIND } from './handshake.js'
import { createHubMux, type HubMux } from './hub-mux.js'
import {
  decodeRecoveryReply,
  decodeRecoveryRequest,
  encodeRecoveryReply,
  encodeRecoveryRequest,
} from './recovery.js'
import { handshakeTopic, inboxTopic, protocolTopic } from './topic.js'

const DEFAULT_RECOVERY_TIMEOUT_MS = 5000
const DEFAULT_RECOVERY_JITTER_MS = 250

export type GroupPeerParams<Protocols extends Record<string, ProtocolDefinition>> = {
  hub: HubLike
  crypto: GroupCrypto
  /** MLS lifecycle port. When provided, the peer runs the handshake lane. */
  mls?: GroupMLS
  localDID: string
  protocols: Protocols
  handlers: { [K in keyof Protocols]: ProcedureHandlers<Protocols[K]> }
  suppress?: SuppressConfig
  getRandomID?: () => string
  /** Recovery rendezvous tuning. `getDelayMs` is the responder reply jitter. */
  recovery?: { timeoutMs?: number; getDelayMs?: () => number }
}

export type ProtocolSurface<Protocol extends ProtocolDefinition> = {
  dispatch: (prc: string, data?: Record<string, unknown>) => Promise<void>
  request: (prc: string, prm?: unknown, options?: RequestOptions) => Promise<unknown>
  gather: (prc: string, prm?: unknown, options?: GatherOptions) => Promise<Array<GatheredReply>>
  to: (memberDID: string) => Client<Protocol>
}

export type GroupPeer<Protocols extends Record<string, ProtocolDefinition>> = {
  protocol: <K extends keyof Protocols>(name: K) => ProtocolSurface<Protocols[K]>
  /**
   * Announce a Commit the consumer just produced (and already applied locally):
   * fan it out on the handshake topic and rebuild this peer's app topics to the
   * now-current epoch. No-op when the peer has no MLS port.
   */
  localCommitted: (commit: Uint8Array) => Promise<void>
  /**
   * Deep recovery for a peer stranded past the handshake backlog: request current
   * state on the handshake topic, apply the first reply, and resync. Returns
   * whether the epoch advanced. No-op (`advanced:false`) without an MLS port or
   * if no reply arrives before the timeout.
   */
  recover: () => Promise<{ advanced: boolean }>
  resync: () => Promise<void>
  dispose: () => Promise<void>
}

type ProtocolRuntime = {
  client: BroadcastClient
  busServer: { dispose: () => Promise<void> }
  acceptor: { dispose: () => Promise<void> }
  directed: Map<string, { client: Client<ProtocolDefinition>; dispose: () => Promise<void> }>
}

export function createGroupPeer<Protocols extends Record<string, ProtocolDefinition>>(
  params: GroupPeerParams<Protocols>,
): GroupPeer<Protocols> {
  const { hub, crypto, mls, localDID, protocols, handlers, suppress } = params
  const getRandomID = params.getRandomID
  const recoveryTimeoutMs = params.recovery?.timeoutMs ?? DEFAULT_RECOVERY_TIMEOUT_MS
  const getReplyDelayMs =
    params.recovery?.getDelayMs ?? (() => defaultJitter(DEFAULT_RECOVERY_JITTER_MS))
  const mux: HubMux = createHubMux({ hub, localDID })

  let runtimes = new Map<string, ProtocolRuntime>()
  let secret: Uint8Array<ArrayBufferLike> = new Uint8Array()
  let epoch = 0

  const buildEpoch = async (): Promise<void> => {
    secret = await crypto.exportSecret()
    epoch = crypto.epoch()
    const next = new Map<string, ProtocolRuntime>()
    for (const [name, protocol] of Object.entries(protocols)) {
      const topicID = protocolTopic(secret, epoch, name)
      const client = new BroadcastClient({
        transport: createBroadcastTransport({
          topicID,
          bus: mux.bus,
          wrap: crypto.wrap,
          unwrap: crypto.unwrap,
        }),
        ...(getRandomID != null ? { getRandomID } : {}),
      })
      const { eventHandlers, requestHandlers } = adaptBusHandlers(
        protocol,
        handlers[name] as Record<string, unknown>,
        suppress,
      )
      const busServer = createGroupBusServer({
        transport: createBroadcastTransport({
          topicID,
          bus: mux.bus,
          wrap: crypto.wrap,
          unwrap: crypto.unwrap,
        }),
        from: localDID,
        eventHandlers,
        requestHandlers,
      })
      const acceptor = createInboxAcceptor<ProtocolDefinition>({
        mux,
        localDID,
        selfInboxTopic: inboxTopic(secret, epoch, localDID),
        resolveSendTopic: (senderDID) => inboxTopic(secret, epoch, senderDID),
        protocol: protocol as ProtocolDefinition,
        handlers: handlers[name] as unknown as ProcedureHandlers<ProtocolDefinition>,
      })
      next.set(name, { client, busServer, acceptor, directed: new Map() })
    }
    runtimes = next
  }

  const teardownEpoch = async (): Promise<void> => {
    // Disposal order is independent across runtimes and within a runtime, so tear
    // everything down concurrently and surface every failure rather than dying
    // on the first.
    const disposals: Array<Promise<unknown>> = []
    for (const runtime of runtimes.values()) {
      for (const directed of runtime.directed.values()) disposals.push(directed.dispose())
      runtime.directed.clear()
      disposals.push(runtime.busServer.dispose())
      disposals.push(runtime.acceptor.dispose())
      disposals.push(runtime.client.dispose())
    }
    runtimes = new Map()
    const results = await Promise.allSettled(disposals)
    const reasons = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))
    if (reasons.length > 0) {
      throw new AggregateError(reasons, 'Group epoch teardown failed')
    }
  }

  const surfaceFor = (name: string): ProtocolSurface<ProtocolDefinition> => {
    const runtime = runtimes.get(name)
    if (runtime == null) throw new Error(`Unknown protocol: ${name}`)
    return {
      dispatch: (prc, data) => runtime.client.dispatch(prc, data),
      request: (prc, prm, options) => runtime.client.request(prc, prm, options),
      gather: (prc, prm, options) => runtime.client.gather(prc, prm, options),
      to: (memberDID) => {
        const cached = runtime.directed.get(memberDID)
        if (cached != null) return cached.client
        const created = createDirectedClient<ProtocolDefinition>({
          mux,
          localDID,
          memberDID,
          secret,
          epoch,
          ...(getRandomID != null ? { getRandomID } : {}),
        })
        runtime.directed.set(memberDID, created)
        return created.client
      },
    }
  }

  const rebuildEpoch = async (): Promise<void> => {
    await teardownEpoch()
    await buildEpoch()
  }

  let handshakeUnsubscribe: (() => void) | undefined
  let handshakeTopicID: string | undefined
  let handshakeTail: Promise<void> = Promise.resolve()

  // Recovery rendezvous state, keyed by requestID.
  const recoveryWaiters = new Map<string, (groupInfo: Uint8Array | null) => void>()
  const recoveryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const pendingReplies = new Map<string, ReturnType<typeof setTimeout>>()
  const suppressedRequests = new Set<string>()

  // Responder: after a jitter delay, answer a recovery request with current
  // GroupInfo — unless another responder's reply has already been observed
  // (storm-collapse), in which case the scheduled reply is cancelled.
  const handleRecoveryRequest = (requestID: string): void => {
    if (mls == null || handshakeTopicID == null) return
    if (suppressedRequests.has(requestID) || pendingReplies.has(requestID)) return
    const port = mls
    const topicID = handshakeTopicID
    const timer = setTimeout(() => {
      pendingReplies.delete(requestID)
      void (async () => {
        try {
          const groupInfo = await port.exportGroupInfo()
          await mux.bus.publish(
            topicID,
            encodeHandshakeFrame(
              HANDSHAKE_KIND.recoveryReply,
              encodeRecoveryReply(requestID, groupInfo),
            ),
          )
        } catch {
          // a failed reply just means another responder (or a retry) covers it
        }
      })()
    }, getReplyDelayMs())
    pendingReplies.set(requestID, timer)
  }

  // Requester + storm-collapse: a reply resolves the local waiter (if any) and
  // suppresses this peer's own pending reply for the same request.
  const handleRecoveryReply = (reply: { requestID: string; groupInfo: Uint8Array }): void => {
    suppressedRequests.add(reply.requestID)
    const replyTimer = pendingReplies.get(reply.requestID)
    if (replyTimer != null) {
      clearTimeout(replyTimer)
      pendingReplies.delete(reply.requestID)
    }
    const waiter = recoveryWaiters.get(reply.requestID)
    if (waiter != null) {
      recoveryWaiters.delete(reply.requestID)
      const timer = recoveryTimers.get(reply.requestID)
      if (timer != null) {
        clearTimeout(timer)
        recoveryTimers.delete(reply.requestID)
      }
      waiter(reply.groupInfo)
    }
  }

  // Serialize inbound handshake processing: Commits must apply in MLS order, and
  // both processCommit and the epoch rebuild are async. Each op waits for init to
  // finish, then runs to completion before the next begins.
  const onHandshakeMessage = (message: StoredMessage, ack: () => void): void => {
    handshakeTail = handshakeTail
      .then(async () => {
        await ready
        if (mls == null) {
          ack()
          return
        }
        let frame: ReturnType<typeof decodeHandshakeFrame>
        try {
          frame = decodeHandshakeFrame(message.payload)
        } catch {
          ack() // drop malformed frames; acking stops poison redelivery
          return
        }
        if (frame.kind === HANDSHAKE_KIND.commit) {
          const { advanced } = await mls.processCommit(frame.payload, {
            senderDID: message.senderDID,
          })
          if (advanced) await rebuildEpoch()
          ack() // durably handled
          return
        }
        if (frame.kind === HANDSHAKE_KIND.recoveryRequest) {
          handleRecoveryRequest(decodeRecoveryRequest(frame.payload))
          ack()
          return
        }
        if (frame.kind === HANDSHAKE_KIND.recoveryReply) {
          handleRecoveryReply(decodeRecoveryReply(frame.payload))
          ack()
          return
        }
        ack()
      })
      .catch(() => {
        // processing failed (e.g. processCommit threw) — do NOT ack, so the hub
        // redelivers and we retry.
      })
  }

  const initHandshake = async (): Promise<void> => {
    if (mls == null) return
    const recoverySecret = await mls.exportRecoverySecret()
    const topicID = handshakeTopic(recoverySecret)
    handshakeTopicID = topicID
    // Subscribed once for the peer's whole life — deliberately NOT rebuilt on
    // resync, so a peer stranded on a stale epoch always shares this rendezvous
    // with the live group. Released only on dispose.
    handshakeUnsubscribe = mux.onInbound(topicID, onHandshakeMessage)
  }

  // Fan out a locally-produced Commit and rebuild this peer's app topics. The
  // publish + rebuild ride the same serial tail as inbound processing so they
  // never interleave with a concurrently-received Commit.
  const localCommitted = async (commit: Uint8Array): Promise<void> => {
    await ready
    if (mls == null || handshakeTopicID == null) return
    const topicID = handshakeTopicID
    const frame = encodeHandshakeFrame(HANDSHAKE_KIND.commit, commit)
    const op = handshakeTail.then(async () => {
      await mux.bus.publish(topicID, frame)
      await rebuildEpoch()
    })
    handshakeTail = op.catch(() => {})
    await op
  }

  const recover = async (): Promise<{ advanced: boolean }> => {
    await ready
    if (mls == null || handshakeTopicID == null) return { advanced: false }
    const port = mls
    const topicID = handshakeTopicID
    const requestID = (getRandomID ?? defaultRandomID)()
    const groupInfo = await new Promise<Uint8Array | null>((resolve) => {
      recoveryWaiters.set(requestID, resolve)
      recoveryTimers.set(
        requestID,
        setTimeout(() => {
          recoveryTimers.delete(requestID)
          if (recoveryWaiters.delete(requestID)) resolve(null)
        }, recoveryTimeoutMs),
      )
      void Promise.resolve(
        mux.bus.publish(
          topicID,
          encodeHandshakeFrame(HANDSHAKE_KIND.recoveryRequest, encodeRecoveryRequest(requestID)),
        ),
      ).catch(() => {})
    })
    if (groupInfo == null) return { advanced: false }
    let result = { advanced: false }
    const op = handshakeTail.then(async () => {
      const r = await port.applyRecovery(groupInfo)
      if (r.advanced) await rebuildEpoch()
      result = r
    })
    handshakeTail = op.catch(() => {})
    await op
    return result
  }

  const ready = (async () => {
    await initHandshake()
    await buildEpoch()
  })()
  const withReady = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    await ready
    return fn()
  }

  return {
    protocol: <K extends keyof Protocols>(name: K) => {
      const key = String(name)
      return {
        dispatch: (prc, data) => withReady(() => surfaceFor(key).dispatch(prc, data)),
        request: (prc, prm, options) => withReady(() => surfaceFor(key).request(prc, prm, options)),
        gather: (prc, prm, options) => withReady(() => surfaceFor(key).gather(prc, prm, options)),
        to: (memberDID) => surfaceFor(key).to(memberDID),
      } as ProtocolSurface<Protocols[K]>
    },
    localCommitted,
    recover,
    resync: async () => {
      await ready
      await rebuildEpoch()
    },
    dispose: async () => {
      await ready
      handshakeUnsubscribe?.()
      for (const timer of recoveryTimers.values()) clearTimeout(timer)
      for (const timer of pendingReplies.values()) clearTimeout(timer)
      recoveryTimers.clear()
      pendingReplies.clear()
      suppressedRequests.clear()
      await teardownEpoch()
      await mux.dispose()
    },
  }
}
