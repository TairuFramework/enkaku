import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { defer } from '@sozai/async'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  chat: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('auth-mode message ordering', () => {
  test('a send arriving behind its channel open is not dropped', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const receivedValues: Array<unknown> = []
    // ctx.readable is a ReadableStream (server/src/types.ts:98), so read it with
    // a reader rather than for-await — the DOM lib type has no asyncIterator.
    const handler = vi.fn(async (ctx: { readable: ReadableStream<unknown> }) => {
      const reader = ctx.readable.getReader()
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        receivedValues.push(next.value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    // Blocks the channel's access check — and only the channel's, because the
    // send/abort paths never reach checkProcedureAccess.
    const gate = defer<void>()
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async () => {
            await gate.promise
            return true
          },
        },
      },
      transport: transports.server,
    })

    const channelMsg = await clientSigner.signToken({
      typ: 'channel',
      prc: 'chat',
      rid: 'c1',
      aud: serverSigner.id,
    } as const)
    const sendMsg = await clientSigner.signToken({
      typ: 'send',
      prc: 'chat',
      rid: 'c1',
      val: 'hello',
      aud: serverSigner.id,
    } as const)

    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
    await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)

    // The send has raced ahead while the channel is stuck in its access check.
    await new Promise((resolve) => setTimeout(resolve, 20))
    gate.resolve()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toEqual(['hello'])

    await server.dispose()
    await transports.dispose()
  })

  test('a send for a channel whose auth failed is still dropped', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const receivedValues: Array<unknown> = []
    // ctx.readable is a ReadableStream (server/src/types.ts:98), so read it with
    // a reader rather than for-await — the DOM lib type has no asyncIterator.
    const handler = vi.fn(async (ctx: { readable: ReadableStream<unknown> }) => {
      const reader = ctx.readable.getReader()
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        receivedValues.push(next.value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { '*': { allow: async () => false } },
      transport: transports.server,
    })

    const channelMsg = await clientSigner.signToken({
      typ: 'channel',
      prc: 'chat',
      rid: 'c1',
      aud: serverSigner.id,
    } as const)
    const sendMsg = await clientSigner.signToken({
      typ: 'send',
      prc: 'chat',
      rid: 'c1',
      val: 'hello',
      aud: serverSigner.id,
    } as const)

    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
    await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toEqual([])
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('distinct rids still verify concurrently', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    let concurrent = 0
    let maxConcurrent = 0
    const gate = defer<void>()

    const handlers = {
      chat: vi.fn(async () => 'done'),
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async () => {
            concurrent += 1
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await gate.promise
            concurrent -= 1
            return true
          },
        },
      },
      transport: transports.server,
    })

    for (const rid of ['c1', 'c2', 'c3']) {
      const msg = await clientSigner.signToken({
        typ: 'channel',
        prc: 'chat',
        rid,
        aud: serverSigner.id,
      } as const)
      await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(maxConcurrent).toBeGreaterThan(1)
    gate.resolve()

    await server.dispose()
    await transports.dispose()
  })
})
