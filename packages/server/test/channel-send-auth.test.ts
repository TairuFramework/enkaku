import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
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

describe('Channel send authorization', () => {
  test('send to non-existent channel is ignored', async () => {
    const receivedValues: Array<unknown> = []
    const handler = vi.fn(async (ctx) => {
      for await (const value of ctx.readable) {
        receivedValues.push(value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
    })

    // Send to non-existent channel - should be ignored
    await transports.client.write(
      createUnsignedToken({ typ: 'send', prc: 'chat', rid: 'unknown', val: 'hello' }),
    )

    // Give time for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toEqual([])

    await server.dispose()
    await transports.dispose()
  })

  test('send messages require signing in non-public mode', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300
    const signer = randomIdentity()
    const receivedValues: Array<unknown> = []

    const handler = vi.fn(async (ctx) => {
      for await (const value of ctx.readable) {
        receivedValues.push(value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      public: false,
      access: { chat: true },
      transport: transports.server,
    })

    // Establish channel with valid signed token
    const channelMsg = await signer.signToken({
      typ: 'channel',
      aud: signer.id,
      prc: 'chat',
      rid: 'ch1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(channelMsg)

    // Give time for channel to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send unsigned message - should be rejected
    await transports.client.write(
      createUnsignedToken({ typ: 'send', prc: 'chat', rid: 'ch1', val: 'unauthorized' }),
    )

    // Should receive error
    const errorMsg = await transports.client.read()
    expect(errorMsg.value?.payload.typ).toBe('error')
    expect(errorMsg.value?.payload.rid).toBe('ch1')
    expect(errorMsg.value?.payload.msg).toContain('signed')

    // Value should not have been received by handler
    expect(receivedValues).toEqual([])

    await server.dispose()
    await transports.dispose()
  })

  test('signed send from channel owner succeeds in non-public mode', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300
    const signer = randomIdentity()
    const receivedValues: Array<unknown> = []

    const handler = vi.fn(async (ctx) => {
      for await (const value of ctx.readable) {
        receivedValues.push(value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      public: false,
      access: { chat: true },
      transport: transports.server,
    })

    // Establish channel with valid signed token
    const channelMsg = await signer.signToken({
      typ: 'channel',
      aud: signer.id,
      prc: 'chat',
      rid: 'ch1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(channelMsg)

    // Give time for channel to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send signed message from the same identity that opened the channel
    const sendMsg = await signer.signToken({
      typ: 'send',
      rid: 'ch1',
      val: 'hello from owner',
    } as const)
    await transports.client.write(sendMsg)

    // Give time for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Value should have been received by handler
    expect(receivedValues).toContain('hello from owner')

    await server.dispose()
    await transports.dispose()
  })

  test('signed send from different identity is rejected in non-public mode', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300
    const signer = randomIdentity()
    const otherIdentity = randomIdentity()
    const receivedValues: Array<unknown> = []

    const handler = vi.fn(async (ctx) => {
      for await (const value of ctx.readable) {
        receivedValues.push(value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      public: false,
      access: { chat: true },
      transport: transports.server,
    })

    // Establish channel with valid signed token
    const channelMsg = await signer.signToken({
      typ: 'channel',
      aud: signer.id,
      prc: 'chat',
      rid: 'ch1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(channelMsg)

    // Give time for channel to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send signed message from a different identity
    const sendMsg = await otherIdentity.signToken({
      typ: 'send',
      rid: 'ch1',
      val: 'hello from intruder',
    } as const)
    await transports.client.write(sendMsg)

    // Should receive error
    const errorMsg = await transports.client.read()
    expect(errorMsg.value?.payload.typ).toBe('error')
    expect(errorMsg.value?.payload.rid).toBe('ch1')

    // Value should not have been received by handler
    expect(receivedValues).toEqual([])

    await server.dispose()
    await transports.dispose()
  })

  test('send messages work without auth check in public mode', async () => {
    const receivedValues: Array<unknown> = []

    const handler = vi.fn(async (ctx) => {
      for await (const value of ctx.readable) {
        receivedValues.push(value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
    })

    // Establish channel
    await transports.client.write(
      createUnsignedToken({ typ: 'channel', prc: 'chat', rid: 'ch1', prm: undefined }),
    )

    // Give time for channel to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send unsigned message in public mode - should work
    await transports.client.write(
      createUnsignedToken({ typ: 'send', rid: 'ch1', val: 'hello public' }),
    )

    // Give time for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toContain('hello public')

    await server.dispose()
    await transports.dispose()
  })
})
