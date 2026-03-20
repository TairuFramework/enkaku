import type { HubProtocol, HubStore, RoutedMessage } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type {
  ChannelHandler,
  ProcedureHandlers,
  RequestHandler,
  StreamHandler,
} from '@enkaku/server'
import { serve } from '@enkaku/server'

import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store?: HubStore
  accessControl?: boolean
  identity?: unknown
}

export type HubInstance = {
  registry: HubClientRegistry
}

/**
 * Create a hub server using standard Enkaku serve() with HubProtocol.
 */
export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const { store } = params

  const handlers: ProcedureHandlers<HubProtocol> = {
    'hub/send': (async (ctx) => {
      const { groupID, epoch, contentType, payload } = ctx.param
      const senderDID =
        ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'

      const message: RoutedMessage = {
        senderDID,
        groupID,
        epoch,
        contentType,
        payload,
      }

      let delivered = 0
      let queued = 0

      // Fan out to online group members
      const members = registry.getOnlineGroupMembers(groupID)
      for (const memberDID of members) {
        if (memberDID === senderDID) continue // Don't echo back to sender
        const client = registry.getClient(memberDID)
        if (client?.sendMessage != null) {
          client.sendMessage(message)
          delivered++
        }
      }

      // Store-and-forward for offline members (if store is provided)
      if (store != null) {
        const allMembers = await store.getGroupMembers(groupID)
        for (const memberDID of allMembers) {
          if (memberDID === senderDID) continue
          if (!registry.isOnline(memberDID)) {
            await store.enqueue(memberDID, message)
            queued++
          }
        }
      }

      return { delivered, queued }
    }) as RequestHandler<HubProtocol, 'hub/send'>,

    'hub/receive': (async (ctx) => {
      const { groups } = ctx.param
      const clientDID =
        ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'
      const writer = ctx.writable.getWriter()

      // Register this client's receive stream
      const entry = registry.register(clientDID)
      registry.setReceiveWriter(clientDID, (message: RoutedMessage) => {
        writer.write(message).catch(() => {})
      })

      // Join requested groups
      for (const groupID of groups) {
        registry.joinGroup(clientDID, groupID)
      }

      // Drain queued messages
      if (store != null) {
        const queued = await store.dequeue(clientDID)
        for (const message of queued) {
          await writer.write(message)
        }
      }

      // Keep stream open until aborted
      return new Promise((resolve) => {
        ctx.signal.addEventListener('abort', () => {
          registry.clearReceiveWriter(clientDID)
          writer.close().catch(() => {})
          resolve(undefined as never)
        })
      })
    }) as StreamHandler<HubProtocol, 'hub/receive'>,

    'hub/tunnel/request': (async (ctx) => {
      const { peerDID, groupID } = ctx.param
      const clientDID =
        ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'

      if (!registry.isOnline(peerDID)) {
        throw new Error(`Peer ${peerDID} is not online`)
      }

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      // Read from this client and forward to peer
      const peerClient = registry.getClient(peerDID)
      // For tunnels, we'd need a more sophisticated mechanism
      // to pair two channel handlers. For now, forward through the registry.

      // Forward incoming data to peer via their receive writer
      // (In a full implementation, tunnels would pair channels directly)
      const readLoop = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            // Would forward to peer's tunnel channel
          }
        } catch {
          // Stream closed
        }
      }
      readLoop()

      return new Promise((resolve) => {
        ctx.signal.addEventListener('abort', () => {
          reader.cancel().catch(() => {})
          writer.close().catch(() => {})
          resolve(undefined as never)
        })
      })
    }) as ChannelHandler<HubProtocol, 'hub/tunnel/request'>,

    'hub/keypackage/upload': (async (ctx) => {
      if (store == null) {
        throw new Error('Key package storage requires a HubStore')
      }
      const { keyPackages } = ctx.param
      for (const kp of keyPackages) {
        const clientDID =
          ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'
        await store.storeKeyPackage(clientDID, kp)
      }
      return { stored: keyPackages.length }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/upload'>,

    'hub/keypackage/fetch': (async (ctx) => {
      if (store == null) {
        return { keyPackages: [] }
      }
      const { did, count } = ctx.param
      const keyPackages = await store.fetchKeyPackages(did, count)
      return { keyPackages }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/fetch'>,

    'hub/group/join': (async (ctx) => {
      const { groupID } = ctx.param
      const clientDID =
        ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'

      const entry = registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)

      // Update store if available
      if (store != null) {
        const members = await store.getGroupMembers(groupID)
        if (!members.includes(clientDID)) {
          members.push(clientDID)
          await store.setGroupMembers(groupID, members)
        }
      }

      return { joined: true }
    }) as RequestHandler<HubProtocol, 'hub/group/join'>,

    'hub/group/leave': (async (ctx) => {
      const { groupID } = ctx.param
      const clientDID =
        ((ctx.message?.payload as Record<string, unknown>)?.iss as string) ?? 'anonymous'

      registry.leaveGroup(clientDID, groupID)

      // Update store if available
      if (store != null) {
        const members = await store.getGroupMembers(groupID)
        const updated = members.filter((m) => m !== clientDID)
        await store.setGroupMembers(groupID, updated)
      }

      return { left: true }
    }) as RequestHandler<HubProtocol, 'hub/group/leave'>,
  }

  serve<HubProtocol>({
    handlers,
    transport: params.transport,
    accessControl: params.accessControl ?? false,
  })

  return { registry }
}
