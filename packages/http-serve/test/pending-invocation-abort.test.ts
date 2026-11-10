import type { ProtocolDefinition } from '@enkaku/protocol'
import { type InvocationContext, Server } from '@enkaku/server'
import { randomIdentity } from '@kokuin/token'
import { defer } from '@sozai/async'
import { expect, test, vi } from 'vitest'

import { ServerTransport } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
  probe: { type: 'request', result: { type: 'string' } },
  watch: { type: 'stream', receive: { type: 'string' }, result: { type: 'string' } },
} as const satisfies ProtocolDefinition

test.each([false, true])('unary disconnect cancels a pending hook (auth=%s)', async (auth) => {
  await checkCancellation('request', auth)
})

test.each([false, true])('SSE session drop cancels a pending hook (auth=%s)', async (auth) => {
  await checkCancellation('stream', auth)
})

async function checkCancellation(typ: 'request' | 'stream', auth: boolean) {
  const gate = defer<void>()
  const entered = defer<InvocationContext>()
  const identity = randomIdentity()
  const caller = randomIdentity()
  const handler = vi.fn(() => 'done')
  const transport = new ServerTransport<typeof protocol>({ maxSessionBufferBytes: 256 })
  const server = new Server<typeof protocol>({
    protocol,
    handlers: { ping: handler, watch: handler, probe: () => 'ready' },
    onInvocation: async (ctx) => {
      if (ctx.rid === 'pending') {
        entered.resolve(ctx)
        await gate.promise
      }
    },
    ...(auth ? { identity, accessRules: { '*': { allow: true } } } : { requireAuth: false }),
  })
  server.handle(transport)
  const abort = new AbortController()
  const message = await caller.signToken({
    payload: {
      typ,
      rid: 'pending',
      prc: typ === 'request' ? 'ping' : 'watch',
      aud: identity.id,
      iat: Math.floor(Date.now() / 1000),
    },
  })
  const pending = transport.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify(message),
      signal: abort.signal,
    }),
  )
  try {
    const ctx = await entered.promise
    expect(ctx.signal.aborted).toBe(false)
    if (typ === 'request') {
      abort.abort()
      expect((await pending).status).toBe(499)
    } else {
      expect((await pending).status).toBe(200)
      await transport.write({
        header: { typ: 'JWT', alg: 'none' },
        payload: { typ: 'receive', rid: 'pending', val: 'x'.repeat(300) },
      })
    }
    expect(ctx.signal.aborted).toBe(true)
    expect(ctx.signal.reason).toBe(typ === 'request' ? 'ClientDisconnected' : 'SessionClosed')
    gate.resolve()
    const probe = await caller.signToken({
      payload: {
        typ: 'request',
        rid: 'probe',
        prc: 'probe',
        aud: identity.id,
        iat: Math.floor(Date.now() / 1000),
      },
    })
    const response = await transport.fetch(
      new Request('http://localhost/', {
        method: 'POST',
        body: JSON.stringify(probe),
      }),
    )
    expect((await response.json()).payload).toMatchObject({ typ: 'result', val: 'ready' })
    // Check before disposal, which also aborts pending hooks.
    expect(handler).not.toHaveBeenCalled()
  } finally {
    gate.resolve()
    await server.dispose()
    await transport.dispose()
    await pending
  }
}
