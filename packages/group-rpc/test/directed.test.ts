import type { ProtocolDefinition } from '@enkaku/protocol'
import type { ProcedureHandlers } from '@enkaku/server'
import { describe, expect, test } from 'vitest'

import { createDirectedClient, createInboxAcceptor } from '../src/directed.js'
import { createHubMux } from '../src/hub-mux.js'
import { inboxTopic } from '../src/topic.js'
import { FakeHub } from './fixtures/fake-hub.js'

const SECRET = new Uint8Array(32).fill(3)
const EPOCH = 1

const protocol = {
  'rpc/double': { type: 'request', param: { type: 'object' }, result: { type: 'object' } },
} as unknown as ProtocolDefinition

type Handlers = ProcedureHandlers<typeof protocol>

function member(hub: FakeHub, localDID: string, handlers: Record<string, unknown>) {
  const mux = createHubMux({ hub, localDID })
  const acceptor = createInboxAcceptor({
    mux,
    localDID,
    selfInboxTopic: inboxTopic(SECRET, EPOCH, localDID),
    resolveSendTopic: (senderDID) => inboxTopic(SECRET, EPOCH, senderDID),
    protocol,
    handlers: handlers as Handlers,
  })
  return { mux, acceptor }
}

describe('directed RPC', () => {
  test('a directed request reaches the target inbox server and returns its reply', async () => {
    const hub = new FakeHub()
    const bob = member(hub, 'bob', {
      'rpc/double': (ctx: { param: { n: number } }) => ({ n: ctx.param.n * 2 }),
    })
    const aliceMux = createHubMux({ hub, localDID: 'alice' })
    const { client, dispose } = createDirectedClient({
      mux: aliceMux,
      localDID: 'alice',
      memberDID: 'bob',
      secret: SECRET,
      epoch: EPOCH,
      getRandomID: () => 'session-a-b',
    })

    const result = await client.request('rpc/double', { param: { n: 21 } })
    expect(result).toEqual({ n: 42 })

    await dispose()
    await aliceMux.dispose()
    await bob.acceptor.dispose()
    await bob.mux.dispose()
  })

  test('two callers to the same member are served independently', async () => {
    const hub = new FakeHub()
    const bob = member(hub, 'bob', {
      'rpc/double': (ctx: { param: { n: number } }) => ({ n: ctx.param.n * 2 }),
    })
    const callers = ['alice', 'carol'].map((localDID, i) => {
      const mux = createHubMux({ hub, localDID })
      const { client, dispose } = createDirectedClient({
        mux,
        localDID,
        memberDID: 'bob',
        secret: SECRET,
        epoch: EPOCH,
        getRandomID: () => `session-${localDID}`,
      })
      return { mux, client, dispose, n: (i + 1) * 10 }
    })

    const results = await Promise.all(
      callers.map((c) => c.client.request('rpc/double', { param: { n: c.n } })),
    )
    expect(results).toEqual([{ n: 20 }, { n: 40 }])

    for (const c of callers) {
      await c.dispose()
      await c.mux.dispose()
    }
    await bob.acceptor.dispose()
    await bob.mux.dispose()
  })
})
