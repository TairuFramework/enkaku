import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  echo: {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'null' },
  },
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

describe('channel dispose', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)
  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => process.off('unhandledRejection', onRejection))

  test('dispose() ends readable and resolves, with no unhandled rejection', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read() // consume the open
    const reader = channel.readable.getReader()
    const done = reader.read().then((r) => r.done)
    await expect(channel.dispose()).resolves.toBeUndefined()
    await expect(done).resolves.toBe(true) // readable closed
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
    await client.dispose()
    expect(rejections).toEqual([])
  })

  test('no unhandled rejection when the transport is disposed BEFORE dispose()', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    await client.dispose() // client-wide teardown first -> #abortControllers rejects the channel
    await new Promise((r) => setTimeout(r, 0))
    await expect(channel.dispose()).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })

  test('post-dispose send() rejects (no send for a dead rid)', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    await channel.dispose()
    await expect(channel.send({})).rejects.toBeDefined()
  })

  test('double dispose() is idempotent and returns the same resolved promise', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    const a = channel.dispose()
    const b = channel.dispose()
    expect(a).toBe(b)
    await expect(a).resolves.toBeUndefined()
  })

  test('pre-aborted channel: no unhandled rejection, readable already closed, dispose() no-op', async () => {
    const { client } = setup()
    const signal = AbortSignal.abort('AlreadyAborted')
    const channel = client.createChannel('echo', { param: {}, signal })
    void channel.catch(() => {})
    const reader = channel.readable.getReader()
    await expect(reader.read().then((r) => r.done)).resolves.toBe(true)
    await expect(channel.dispose()).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })

  test('a consumer awaiting a disposed call observes the rejection when dispose wins', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    const awaited = expect(channel).rejects.toBeDefined()
    await channel.dispose()
    await awaited
  })

  test('dispose() reports requestEnd status "aborted", not "error"', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    void channel.catch(() => {})
    await transports.server.read() // consume the open
    const requestEnds: Array<{ rid: string; procedure: string; status: string }> = []
    client.events.on('requestEnd', (data) => {
      requestEnds.push(data)
    })
    await channel.dispose()
    await new Promise((r) => setTimeout(r, 0))
    expect(requestEnds).toHaveLength(1)
    expect(requestEnds[0]?.status).toBe('aborted')
  })

  test('no unhandled rejection when a stream is aborted then the client is disposed', async () => {
    const streamProtocol = {
      sub: { type: 'stream', receive: { type: 'string' }, result: { type: 'null' } },
    } as const satisfies ProtocolDefinition
    const transports = new DirectTransports<
      AnyServerMessageOf<typeof streamProtocol>,
      AnyClientMessageOf<typeof streamProtocol>
    >()
    const client = new Client<typeof streamProtocol>({ transport: transports.client })
    const stream = client.createStream('sub')
    stream.abort('Close')
    await client.dispose()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })
})
