import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const param: {
  anyOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }, { type: 'null' }]
} = {
  anyOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }, { type: 'null' }],
}
const protocol = {
  request: { type: 'request', param },
  stream: { type: 'stream', param, receive: { type: 'string' } },
  channel: { type: 'channel', param, send: { type: 'string' }, receive: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('call params', () => {
  test.each([0, false, '', null])('preserves non-null params: %s', async (param) => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })
    const calls = [
      client.request('request', { param }),
      client.createStream('stream', { param }),
      client.createChannel('channel', { param }),
    ]
    for (const call of calls) void call.catch(() => {})
    try {
      for (const type of ['request', 'stream', 'channel']) {
        const { value } = await transports.server.read()
        expect(value?.payload).toMatchObject({ typ: type, prc: type })
        if (param == null) expect(value?.payload).not.toHaveProperty('prm')
        else expect(value?.payload).toHaveProperty('prm', param)
      }
    } finally {
      await client.dispose()
      await transports.dispose()
    }
  })
})
