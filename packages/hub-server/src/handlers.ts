import { fromB64, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore, StoredMessage } from '@enkaku/hub-protocol'
import type { ChannelHandler, ProcedureHandlers, RequestHandler } from '@enkaku/server'

import type { HubClientRegistry } from './registry.js'

export type CreateHandlersParams = {
  registry: HubClientRegistry
  store: HubStore
}

function getClientDID(ctx: { message: { payload: Record<string, unknown> } }): string {
  const payload = ctx.message.payload
  return typeof payload.iss === 'string' ? payload.iss : 'anonymous'
}

export function createHandlers(params: CreateHandlersParams): ProcedureHandlers<HubProtocol> {
  const { store, registry } = params

  return {
    'hub/send': (async (ctx) => {
      const { recipients, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      const payloadBytes = fromB64(payload)
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
      const { groupID, payload } = ctx.param
      const members = registry.getGroupMembers(groupID)
      if (members.length === 0) {
        throw new Error(`Unknown group: ${groupID}`)
      }

      const senderDID = getClientDID(ctx)
      const recipients = members.filter((did) => did !== senderDID)
      const payloadBytes = fromB64(payload)
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
      // Guard against double-bind. isOnline is true iff the receive-writer slot
      // is occupied; throwing here (before locking the writable/readable streams)
      // preserves the first subscriber's writer instead of leaking stream locks.
      if (registry.isOnline(clientDID)) {
        throw new Error(`receive writer already bound for DID ${clientDID}`)
      }

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
        writer
          .write({
            sequenceID: message.sequenceID,
            senderDID: message.senderDID,
            groupID: message.groupID,
            payload: toB64(message.payload),
          })
          .catch(() => {})
      })

      // Drain queued messages from store
      if (store != null) {
        let cursor: string | null | undefined = after
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
            await writer.write({
              sequenceID: msg.sequenceID,
              senderDID: msg.senderDID,
              groupID: msg.groupID,
              payload: toB64(msg.payload),
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
      const { keyPackages } = ctx.param
      const clientDID = getClientDID(ctx)
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
      const { groupID } = ctx.param
      const clientDID = getClientDID(ctx)
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { joined: true }
    }) as RequestHandler<HubProtocol, 'hub/group/join'>,

    'hub/group/leave': (async (ctx) => {
      const { groupID } = ctx.param
      const clientDID = getClientDID(ctx)
      registry.leaveGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { left: true }
    }) as RequestHandler<HubProtocol, 'hub/group/leave'>,
  }
}
