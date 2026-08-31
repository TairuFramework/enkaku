import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createIdentity, randomIdentity } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/client.js'

const protocol = {
  'test/event': { type: 'event' },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createTransports() {
  return new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
}

async function readIssuer(transports: ReturnType<typeof createTransports>): Promise<unknown> {
  const read = await transports.server.read()
  const payload = read.value?.payload as unknown as Record<string, unknown> | undefined
  return payload?.iss
}

describe('ClientParams.embedLongForm', () => {
  test('did:peer:4: overrides the long-on-first-contact-per-audience policy, keeping every token long-form', async () => {
    const serverIdentity = randomIdentity()
    const clientIdentity = await createIdentity({
      didMethod: 'peer:4',
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })

    const transports = createTransports()
    const client = new Client<Protocol>({
      transport: transports.client,
      identity: clientIdentity,
      serverID: serverIdentity.id,
      embedLongForm: true,
    })

    await client.sendEvent('test/event')
    await client.sendEvent('test/event')

    // Without the flag, only the first token to a given audience is long-form
    // (see the control test below) — with it, the second is long-form too.
    expect(await readIssuer(transports)).toBe(clientIdentity.longForm)
    expect(await readIssuer(transports)).toBe(clientIdentity.longForm)

    await transports.dispose()
  })

  test('did:peer:4 control: without embedLongForm, only the first token to an audience is long-form', async () => {
    const serverIdentity = randomIdentity()
    const clientIdentity = await createIdentity({
      didMethod: 'peer:4',
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })

    const transports = createTransports()
    const client = new Client<Protocol>({
      transport: transports.client,
      identity: clientIdentity,
      serverID: serverIdentity.id,
    })

    await client.sendEvent('test/event')
    await client.sendEvent('test/event')

    expect(await readIssuer(transports)).toBe(clientIdentity.longForm)
    expect(await readIssuer(transports)).toBe(clientIdentity.id)

    await transports.dispose()
  })

  test('did:key: embedLongForm is a no-op, iss is the id on every token', async () => {
    const serverIdentity = randomIdentity()
    const clientIdentity = randomIdentity()

    const transports = createTransports()
    const client = new Client<Protocol>({
      transport: transports.client,
      identity: clientIdentity,
      serverID: serverIdentity.id,
      embedLongForm: true,
    })

    await client.sendEvent('test/event')
    await client.sendEvent('test/event')

    expect(await readIssuer(transports)).toBe(clientIdentity.id)
    expect(await readIssuer(transports)).toBe(clientIdentity.id)

    await transports.dispose()
  })
})
