import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import type { Logger } from '@sozai/log'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/client.js'

const protocol = {
  'test/event': {
    type: 'event',
    data: {
      type: 'object',
      properties: { hello: { type: 'string' } },
      required: ['hello'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const NOW_MS = 1_700_000_000_000

function testLogger(): Logger {
  return { debug: vi.fn(), trace: vi.fn() } as unknown as Logger
}

describe('replay claims on signed messages', () => {
  test('stamps a uuid jti and integer iat (seconds) on a signed request', async () => {
    const identity = randomIdentity()
    const issuedIDs: Array<string> = []
    const getRandomID = () => {
      const id = `id-${issuedIDs.length}`
      issuedIDs.push(id)
      return id
    }

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      transport: transports.client,
      identity,
      logger: testLogger(),
      getRandomID,
      now: () => NOW_MS,
    })

    await client.sendEvent('test/event', { data: { hello: 'world' } })
    const first = await transports.server.read()
    const firstPayload = first.value?.payload as Record<string, unknown>

    expect(typeof firstPayload.jti).toBe('string')
    expect(issuedIDs).toContain(firstPayload.jti)
    expect(firstPayload.iat).toBe(Math.floor(NOW_MS / 1000))

    await client.sendEvent('test/event', { data: { hello: 'again' } })
    const second = await transports.server.read()
    const secondPayload = second.value?.payload as Record<string, unknown>

    expect(typeof secondPayload.jti).toBe('string')
    expect(issuedIDs).toContain(secondPayload.jti)
    expect(secondPayload.jti).not.toBe(firstPayload.jti)

    await transports.dispose()
  })

  test('unsigned client stamps neither jti nor iat', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      transport: transports.client,
      logger: testLogger(),
    })

    await client.sendEvent('test/event', { data: { hello: 'world' } })
    const read = await transports.server.read()
    const payload = read.value?.payload as Record<string, unknown>

    expect(payload.jti).toBeUndefined()
    expect(payload.iat).toBeUndefined()

    await transports.dispose()
  })
})
