import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { createGroupPeer } from '../src/index.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'

const flush = () => new Promise((r) => setTimeout(r, 40))

const app = {
  'app/ping': { type: 'event', data: { type: 'object' } },
  'app/who': { type: 'request', param: { type: 'object' }, result: { type: 'object' } },
  'app/feed': {
    type: 'stream',
    param: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'object' },
  },
  'app/sync': {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'object' },
  },
} as const satisfies ProtocolDefinition

type Protocols = { app: typeof app }

function peer(hub: FakeHub, localDID: string, handlers: Record<string, unknown>) {
  return createGroupPeer<Protocols>({
    hub,
    crypto: createFakeCrypto({ epoch: 1, localDID }),
    localDID,
    protocols: { app },
    handlers: { app: handlers } as never,
  })
}

describe('group-rpc end-to-end (3 members over one hub)', () => {
  test('bus, anycast, gather, and directed request/stream/channel all work', async () => {
    const hub = new FakeHub()
    const pings: Array<unknown> = []

    const alice = peer(hub, 'alice', {})
    const bobHandlers = {
      'app/ping': (ctx: { data: unknown }) => void pings.push(ctx.data),
      'app/who': () => ({ id: 'bob' }),
      'app/feed': async (ctx: {
        param: { count: number }
        signal: AbortSignal
        message: unknown
        writable: WritableStream<{ i: number }>
      }) => {
        const writer = ctx.writable.getWriter()
        for (let i = 0; i < ctx.param.count; i++) await writer.write({ i })
        await writer.close()
        return { done: true }
      },
      'app/sync': async (ctx: {
        param: Record<string, unknown>
        signal: AbortSignal
        message: unknown
        readable: ReadableStream<{ n: number }>
        writable: WritableStream<{ doubled: number }>
      }) => {
        const reader = ctx.readable.getReader()
        const writer = ctx.writable.getWriter()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write({ doubled: value.n * 2 })
        }
        await writer.close()
        return { ok: true }
      },
    }
    peer(hub, 'bob', bobHandlers)
    peer(hub, 'carol', {
      'app/ping': (ctx: { data: unknown }) => void pings.push(ctx.data),
      'app/who': () => ({ id: 'carol' }),
    })
    await flush()

    // 1) Bus event reaches bob + carol.
    await alice.protocol('app').dispatch('app/ping', { seq: 1 })
    await flush()
    expect(pings).toHaveLength(2)

    // 2) Anycast request: exactly one answer.
    const who = await alice.protocol('app').request('app/who', {}, { timeoutMs: 500 })
    expect((who as { id: string }).id).toMatch(/bob|carol/)

    // 3) Gather: both answer.
    const all = await alice.protocol('app').gather('app/who', {}, { timeoutMs: 300 })
    expect(all.map((r) => (r.value as { id: string }).id).sort()).toEqual(['bob', 'carol'])

    // 4) Directed stream from bob.
    const stream = alice
      .protocol('app')
      .to('bob')
      .createStream('app/feed', { param: { count: 3 } })
    const got: Array<number> = []
    const reader = stream.readable.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      got.push((value as { i: number }).i)
    }
    expect(got).toEqual([0, 1, 2])

    // 5) Directed channel with bob.
    const channel = alice.protocol('app').to('bob').createChannel('app/sync', { param: {} })
    await channel.send({ n: 5 })
    const back = await channel.readable.getReader().read()
    expect((back.value as { doubled: number }).doubled).toBe(10)
    channel.close()
    // Suppress the benign 'Close' rejection produced by channel.close().
    await channel.catch(() => {})

    await alice.dispose()
  })
})
