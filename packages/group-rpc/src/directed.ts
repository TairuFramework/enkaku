import { Client } from '@enkaku/client'
import { createHubTunnelTransport, decodeFrame } from '@enkaku/hub-tunnel'
import type { ClientTransportOf, ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { type ProcedureHandlers, Server } from '@enkaku/server'

import type { HubMux } from './hub-mux.js'
import { inboxTopic } from './topic.js'

export type DirectedClientParams<Protocol extends ProtocolDefinition> = {
  mux: HubMux
  localDID: string
  memberDID: string
  secret: Uint8Array
  epoch: number
  getRandomID?: () => string
}

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

/**
 * Directed 1:1 RPC client to a single member, over a hub-tunnel transport whose
 * send/receive topics are the two members' inbox topics for the current epoch.
 */
export function createDirectedClient<Protocol extends ProtocolDefinition>(
  params: DirectedClientParams<Protocol>,
): { client: Client<Protocol>; dispose: () => Promise<void> } {
  const { mux, localDID, memberDID, secret, epoch } = params
  const getRandomID = params.getRandomID ?? defaultRandomID
  const transport = createHubTunnelTransport({
    hub: mux.hubLike,
    sessionID: getRandomID(),
    localDID,
    sendTopicID: inboxTopic(secret, epoch, memberDID),
    receiveTopicID: inboxTopic(secret, epoch, localDID),
  }) as ClientTransportOf<Protocol>
  const client = new Client<Protocol>({ transport, serverID: memberDID })
  return {
    client,
    dispose: async () => {
      await client.dispose()
    },
  }
}

export type InboxAcceptorParams<Protocol extends ProtocolDefinition> = {
  mux: HubMux
  localDID: string
  selfInboxTopic: string
  /** Map an inbound senderDID to the topic we send replies on (their inbox). */
  resolveSendTopic: (senderDID: string) => string
  protocol: Protocol
  handlers: ProcedureHandlers<Protocol>
}

/**
 * Accept directed RPC: one shared inbox `Server` plus a lazily-created
 * server-side hub-tunnel per inbound session. Relies on the mux delivering the
 * triggering frame to the new tunnel's sink (onInbound fires before sinks).
 */
export function createInboxAcceptor<Protocol extends ProtocolDefinition>(
  params: InboxAcceptorParams<Protocol>,
): { dispose: () => Promise<void> } {
  const { mux, localDID, selfInboxTopic, resolveSendTopic, protocol, handlers } = params
  const server = new Server<Protocol>({ protocol, handlers, requireAuth: false })
  const tunnels = new Map<string, ReturnType<typeof createHubTunnelTransport>>()

  const unsubscribe = mux.onInbound(selfInboxTopic, (message) => {
    let sessionID: string
    try {
      const frame = decodeFrame(message.payload)
      sessionID = frame.sessionID
      if (frame.kind === 'session-end') {
        const existing = tunnels.get(sessionID)
        if (existing != null) {
          tunnels.delete(sessionID)
          void existing.dispose()
        }
        return
      }
      if (frame.kind !== 'message') return
    } catch {
      return
    }
    if (tunnels.has(sessionID)) return
    const tunnel = createHubTunnelTransport({
      hub: mux.hubLike,
      sessionID: { auto: true },
      localDID,
      sendTopicID: resolveSendTopic(message.senderDID),
      receiveTopicID: selfInboxTopic,
    })
    tunnels.set(sessionID, tunnel)
    void server.handle(tunnel as ServerTransportOf<Protocol>)
  })

  return {
    dispose: async () => {
      unsubscribe()
      for (const tunnel of tunnels.values()) void tunnel.dispose()
      tunnels.clear()
      await server.dispose()
    },
  }
}
