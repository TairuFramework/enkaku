import type { HubProtocol, HubStore, StoredMessage } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { ChannelHandler, ProcedureHandlers, RequestHandler, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store?: HubStore
  accessControl?: boolean
  identity?: Identity
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

function getClientDID(ctx: { message: { payload: { iss?: string } } }): string {
  return ctx.message.payload.iss ?? 'anonymous'
}

function encodePayload(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function decodePayload(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const { store } = params

  const handlers: ProcedureHandlers<HubProtocol> = {
    'hub/send': (async (ctx) => {
      const senderDID = getClientDID(ctx)
      const { recipients, payload } = ctx.param

      if (store == null) {
        throw new Error('Store is required for hub/send')
      }

      const payloadBytes = decodePayload(payload)
      const sequenceID = await store.store({ senderDID, recipients, payload: payloadBytes })

      // Deliver to online recipients immediately
      for (const recipientDID of recipients) {
        if (recipientDID === senderDID) continue
        const client = registry.getClient(recipientDID)
        if (client?.sendMessage != null) {
          client.sendMessage({ sequenceID, senderDID, payload: payloadBytes })
        }
      }

      return { sequenceID }
    }) as RequestHandler<HubProtocol, 'hub/send'>,

    'hub/group/send': (async (ctx) => {
      const senderDID = getClientDID(ctx)
      const { groupID, payload } = ctx.param

      if (store == null) {
        throw new Error('Store is required for hub/group/send')
      }

      const members = registry.getGroupMembers(groupID)
      if (members.length === 0) {
        throw new Error(`Unknown group: ${groupID}`)
      }

      const recipients = members.filter((did) => did !== senderDID)
      const payloadBytes = decodePayload(payload)
      const sequenceID = await store.store({
        senderDID,
        recipients,
        payload: payloadBytes,
        groupID,
      })

      // Deliver to online recipients immediately
      for (const recipientDID of recipients) {
        const client = registry.getClient(recipientDID)
        if (client?.sendMessage != null) {
          client.sendMessage({ sequenceID, senderDID, groupID, payload: payloadBytes })
        }
      }

      return { sequenceID }
    }) as RequestHandler<HubProtocol, 'hub/group/send'>,

    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after, groupIDs } = ctx.param ?? {}

      registry.register(clientDID)

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      // Set up message delivery callback with optional group filter
      registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
        // Apply group filter: direct messages always pass, group messages only if in filter
        if (groupIDs != null && groupIDs.length > 0) {
          if (message.groupID != null && !groupIDs.includes(message.groupID)) {
            return
          }
        }
        const encoded = encodePayload(message.payload)
        writer
          .write({
            sequenceID: message.sequenceID,
            senderDID: message.senderDID,
            groupID: message.groupID,
            payload: encoded,
          })
          .catch(() => {})
      })

      // Drain queued messages from store
      if (store != null) {
        let cursor = after
        while (true) {
          const result = await store.fetch({
            recipientDID: clientDID,
            after: cursor ?? undefined,
            limit: 50,
          })
          for (const msg of result.messages) {
            // Apply group filter
            if (groupIDs != null && groupIDs.length > 0) {
              if (msg.groupID != null && !groupIDs.includes(msg.groupID)) {
                continue
              }
            }
            const encoded = encodePayload(msg.payload)
            await writer.write({
              sequenceID: msg.sequenceID,
              senderDID: msg.senderDID,
              groupID: msg.groupID,
              payload: encoded,
            })
          }
          cursor = result.cursor
          if (!result.hasMore) break
        }
      }

      // Read acks from device
      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value?.ack != null && store != null) {
              await store.ack({ recipientDID: clientDID, sequenceIDs: value.ack })
            }
          }
        } catch {
          // Channel closed
        }
      })()

      // Keep channel open until aborted
      return new Promise((resolve) => {
        ctx.signal.addEventListener(
          'abort',
          () => {
            registry.clearReceiveWriter(clientDID)
            reader.cancel().catch(() => {})
            writer.close().catch(() => {})
            resolve(undefined as never)
          },
          { once: true },
        )
      })
    }) as ChannelHandler<HubProtocol, 'hub/receive'>,

    'hub/keypackage/upload': (async (ctx) => {
      if (store == null) {
        throw new Error('Store is required for key package operations')
      }
      const clientDID = getClientDID(ctx)
      const { keyPackages } = ctx.param
      await Promise.all(keyPackages.map((kp: string) => store.storeKeyPackage(clientDID, kp)))
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
      const clientDID = getClientDID(ctx)
      const { groupID } = ctx.param
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { joined: true }
    }) as RequestHandler<HubProtocol, 'hub/group/join'>,

    'hub/group/leave': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { groupID } = ctx.param
      registry.leaveGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { left: true }
    }) as RequestHandler<HubProtocol, 'hub/group/leave'>,
  }

  const server = serve<HubProtocol>({
    handlers,
    transport: params.transport,
    accessControl: params.accessControl ?? false,
    identity: params.identity,
  })

  return { registry, server }
}
