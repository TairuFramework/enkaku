import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyServerMessageOf,
  ProtocolDefinition,
} from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Client, RequestTimeoutError } from '../src/index.js'

const protocol = {
  request: { type: 'request', result: { type: 'string' } },
  stream: { type: 'stream', receive: { type: 'string' }, result: { type: 'string' } },
  channel: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('abort before sent', () => {
  const cleanups: Array<() => Promise<void>> = []

  function setup(requestTimeoutMs?: number) {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const payloads: Array<AnyClientPayloadOf<Protocol>> = []
    const write = vi.spyOn(transports.client, 'write').mockImplementation((message) => {
      payloads.push(message.payload)
      return message.payload.typ === 'abort' ? Promise.resolve() : new Promise<void>(() => {})
    })
    const client = new Client<Protocol>({ transport: transports.client, requestTimeoutMs })
    cleanups.push(async () => {
      await client.dispose()
      await transports.dispose()
    })
    return { client, payloads, write }
  }

  afterEach(async () => {
    vi.useRealTimers()
    for (const cleanup of cleanups.splice(0)) await cleanup()
    vi.restoreAllMocks()
  })

  test('request rejects on call.abort() while write is pending', async () => {
    const { client, payloads } = setup()
    const call = client.request('request')
    await vi.waitFor(() =>
      expect(payloads).toContainEqual(expect.objectContaining({ typ: 'request' })),
    )

    call.abort('Stop')

    await vi.waitFor(async () => await expect(call).rejects.toBe('Stop'))
    expect(payloads).toContainEqual(expect.objectContaining({ typ: 'abort', rid: call.id }))
  })

  test('request rejects on config.signal abort while write is pending', async () => {
    const { client, payloads } = setup()
    const ac = new AbortController()
    const call = client.request('request', { signal: ac.signal })
    await vi.waitFor(() => expect(payloads).toHaveLength(1))

    ac.abort('Gone')

    await vi.waitFor(async () => await expect(call).rejects.toBe('Gone'))
  })

  test('request rejects on timeout while write is pending', async () => {
    vi.useFakeTimers()
    const { client, payloads } = setup(1000)
    const call = client.request('request')
    await vi.waitFor(() => expect(payloads).toHaveLength(1))
    const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)

    await vi.advanceTimersByTimeAsync(1000)

    await vi.waitFor(async () => await rejected)
  })

  test('stream and channel reject on abort while write is pending', async () => {
    const { client, payloads } = setup()
    const stream = client.createStream('stream')
    const channel = client.createChannel('channel')
    await vi.waitFor(() => expect(payloads).toHaveLength(2))

    stream.abort()
    channel.abort()

    await vi.waitFor(async () => {
      await expect(stream).rejects.toBeInstanceOf(DOMException)
      await expect(channel).rejects.toBeInstanceOf(DOMException)
    })
  })

  test('pre-aborted signal rejects with the signal object', async () => {
    const { client } = setup()
    const signal = AbortSignal.abort('Already')

    await expect(client.request('request', { signal })).rejects.toBe(signal)
    await expect(client.createStream('stream', { signal })).rejects.toBe(signal)
    await expect(client.createChannel('channel', { signal })).rejects.toBe(signal)
  })

  test('no unhandled rejection when sent rejects after abort', async () => {
    const rejections: Array<unknown> = []
    const onRejection = (reason: unknown) => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onRejection)
    try {
      const { client, write } = setup()
      const sent = Promise.withResolvers<void>()
      write.mockImplementationOnce(() => sent.promise)
      const call = client.request('request')
      void call.catch(() => {})
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())

      call.abort()
      setTimeout(() => sent.reject(new Error('Late send failure')), 10)
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(rejections).toHaveLength(0)
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})
