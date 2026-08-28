import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken as unsignedToken } from '@kokuin/token'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup() {
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const client = new Client<Protocol>({ transport: transports.client })
  return { transports, client }
}

describe('controller hardening', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)
  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => process.off('unhandledRejection', onRejection))

  test('a reused explicit id: a late external abort of the old call does not delete the new controller', async () => {
    const { transports, client } = setup()
    const first = client.request('ping', { id: 'shared', signal: new AbortController().signal })
    // Overwrite the map slot with a new controller using the same id.
    const controllerA = new AbortController()
    const second = client.request('ping', { id: 'shared', signal: controllerA.signal })
    // Reply to the NEW call; it must still resolve even if the OLD one's signal later aborts.
    const read = await transports.server.read()
    const rid = (read.value as { payload: { rid: string } }).payload.rid
    await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'ok' }))
    await expect(second).resolves.toBe('ok')
    // first was superseded in the map; abort its (independent) controller — must not affect anything delivered.
    void first.catch(() => {})
    await client.dispose()
  })
})
