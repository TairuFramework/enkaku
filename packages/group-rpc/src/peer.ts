import {
  BroadcastClient,
  createBroadcastTransport,
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
import { handshakeTopic, inboxTopic, protocolTopic } from './topic.js'

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

  // Serialize inbound handshake processing: Commits must apply in MLS order, and
  // both processCommit and the epoch rebuild are async. Each op waits for init to
  // finish, then runs to completion before the next begins.
  const onHandshakeMessage = (message: StoredMessage): void => {
    handshakeTail = handshakeTail
      .then(async () => {
        await ready
        if (mls == null) return
        let frame: ReturnType<typeof decodeHandshakeFrame>
        try {
          frame = decodeHandshakeFrame(message.payload)
        } catch {
          return // ignore malformed frames on the handshake topic
        }
        if (frame.kind === HANDSHAKE_KIND.commit) {
          const { advanced } = await mls.processCommit(frame.payload, {
            senderDID: message.senderDID,
          })
          if (advanced) await rebuildEpoch()
        }
        // recovery kinds are handled in a later step
      })
      .catch(() => {})
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
    resync: async () => {
      await ready
      await rebuildEpoch()
    },
    dispose: async () => {
      await ready
      handshakeUnsubscribe?.()
      await teardownEpoch()
      await mux.dispose()
    },
  }
}
