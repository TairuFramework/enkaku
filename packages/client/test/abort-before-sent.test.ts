import type {
  AnyClientMessageOf,
  AnyClientPayloadOf,
  AnyServerMessageOf,
  ProtocolDefinition,
} from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import type { Identity } from '@kokuin/token'
import { getLogger } from '@sozai/log'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Client, type ClientParams, RequestTimeoutError } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
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

  function setup(requestTimeoutMs?: number, options?: Partial<ClientParams<Protocol>>) {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const payloads: Array<AnyClientPayloadOf<Protocol>> = []
    const write = vi.spyOn(transports.client, 'write').mockImplementation((message) => {
      payloads.push(message.payload)
      return message.payload.typ === 'abort' ? Promise.resolve() : new Promise<void>(() => {})
    })
    const client = new Client<Protocol>({
      transport: transports.client,
      requestTimeoutMs,
      ...options,
    })
    cleanups.push(async () => {
      await client.dispose()
      await transports.dispose()
    })
    return { client, payloads, write, transports }
  }

  afterEach(async () => {
    vi.useRealTimers()
    for (const cleanup of cleanups.splice(0)) await cleanup()
    vi.restoreAllMocks()
  })

  test('aborted request is never written', async () => {
    const { client, payloads, write } = setup()
    write.mockImplementation((message) => {
      payloads.push(message.payload)
      return Promise.resolve()
    })
    const call = client.request('test/request')

    call.abort()

    await expect(call).rejects.toBeInstanceOf(DOMException)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(payloads.map((payload) => payload.typ)).toEqual(['abort'])
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

  test.each(['request', 'stream', 'channel'] as const)(
    '%s drops replies after message creation fails',
    async (type) => {
      const identity = Promise.withResolvers<Identity>()
      const logger = getLogger(['enkaku', 'test', 'send-error'])
      const warn = vi.spyOn(logger, 'warn')
      const { client, transports, write } = setup(undefined, {
        identity: identity.promise,
        logger,
      })
      const call =
        type === 'request'
          ? client.request('request')
          : type === 'stream'
            ? client.createStream('stream')
            : client.createChannel('channel')
      const failure = new Error('Message creation failed')
      const rejected = expect(call).rejects.toBe(failure)
      identity.reject(failure)
      await rejected
      expect(write).not.toHaveBeenCalled()

      await transports.server.write({
        header: { typ: 'JWT', alg: 'none' },
        payload: { typ: 'result', rid: call.id, val: 'late' },
      })
      await vi.waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          'controller not found for request {rid}',
          expect.objectContaining({ rid: call.id }),
        ),
      )
    },
  )

  test('no unhandled rejection when sent rejects after abort', async () => {
    const rejections: Array<unknown> = []
    const onRejection = (reason: unknown) => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onRejection)
    try {
      const identity = Promise.withResolvers<Identity>()
      const { client, write } = setup(undefined, { identity: identity.promise })
      const abortFailure = vi.fn()
      client.events.on('requestError', abortFailure)
      const call = client.request('request')
      const rejected = expect(call).rejects.toBe('Stop')

      call.abort('Stop')
      await rejected
      const failure = new Error('Late message creation failure')
      identity.reject(failure)
      await vi.waitFor(() =>
        expect(abortFailure).toHaveBeenCalledWith({ rid: call.id, error: failure }),
      )
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(write).not.toHaveBeenCalled()
      expect(rejections).toHaveLength(0)
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})
