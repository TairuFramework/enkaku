import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, type RequestHandler, serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

const protocol = {
  ping: {
    type: 'request',
    result: { type: 'object', properties: { ok: { type: 'boolean' } } },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('access control: predicate end-to-end', () => {
  test('listed DID passes; unlisted DID is denied', async () => {
    const serverIdentity = randomIdentity()
    const allowed = randomIdentity()
    const blocked = randomIdentity()
    const allowedSet = new Set([allowed.id])

    const handlers: ProcedureHandlers<Protocol> = {
      ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
    }

    const allowedTransports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    serve<Protocol>({
      handlers,
      identity: serverIdentity,
      protocol,
      transport: allowedTransports.server,
      accessRules: {
        '*': { allow: ({ payload }) => allowedSet.has(payload.iss) },
      },
    })
    const allowedClient = new Client<Protocol>({
      identity: allowed,
      serverID: serverIdentity.id,
      transport: allowedTransports.client,
    })
    await expect(allowedClient.request('ping')).resolves.toEqual({ ok: true })
    await allowedClient.dispose()
    await allowedTransports.dispose()

    const blockedTransports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    serve<Protocol>({
      handlers,
      identity: serverIdentity,
      protocol,
      transport: blockedTransports.server,
      accessRules: {
        '*': { allow: ({ payload }) => allowedSet.has(payload.iss) },
      },
    })
    const blockedClient = new Client<Protocol>({
      identity: blocked,
      serverID: serverIdentity.id,
      transport: blockedTransports.client,
    })
    await expect(blockedClient.request('ping')).rejects.toThrow(/Access denied|denied/)
    await blockedClient.dispose()
    await blockedTransports.dispose()
  })
})
