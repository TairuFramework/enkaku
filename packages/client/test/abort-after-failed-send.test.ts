import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('abort after failed send', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('abort() does not produce an unhandled rejection when the request was never sent', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    // Pre-aborted signal: the request is rejected before send and `sent` is a
    // rejected promise
    const signal = AbortSignal.abort('AlreadyAborted')
    const request = client.request('test/request', { signal })
    await expect(request).rejects.toBeDefined()

    // Pre-fix: this chains .then on the rejected `sent` promise → unhandled rejection
    request.abort('Cleanup')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)

    await client.dispose()
    await transports.dispose()
  })
})
