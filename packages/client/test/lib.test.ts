import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ChannelPayloadOf,
  ProtocolDefinition,
  RequestPayloadOf,
  StreamPayloadOf,
} from '@enkaku/protocol'
import { createArraySink } from '@enkaku/stream'
import { randomTokenSigner, createUnsignedToken as unsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

import { Client } from '../src/client.js'

describe('Client', () => {
  test('sendEvent()', async () => {
    const serverSigner = randomTokenSigner()
    const clientSigner = randomTokenSigner()

    const protocol = {
      'test/event': {
        type: 'event',
        data: {
          type: 'object',
          properties: { hello: { type: 'string' } },
          required: ['hello'],
          additionalProperties: false,
        },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      serverID: serverSigner.id,
      signer: clientSigner,
      transport: transports.client,
    })

    await client.sendEvent('test/event', { hello: 'world' })
    const signedMessage = await clientSigner.createToken({
      aud: serverSigner.id,
      typ: 'event',
      prc: 'test/event',
      data: { hello: 'world' },
    })

    const eventRead = await transports.server.read()
    expect(eventRead.done).toBe(false)
    expect(eventRead.value).toEqual(signedMessage)
    await transports.dispose()
  })

  describe('request()', () => {
    const protocol = {
      'test/request': {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    test('sends request and gets result', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const request = client.request('test/request')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Protocol['test/request']
      >
      expect(payload.prc).toBe('test/request')
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(request).resolves.toBe('OK')

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const request = client.request('test/request')
      request.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Protocol['test/request']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'AbortError',
      })
      await expect(request).rejects.toBeInstanceOf(AbortSignal)

      await transports.dispose()
    })
  })

  describe('createStream()', () => {
    const protocol = {
      'test/stream': {
        type: 'stream',
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    test('sends request and gets receive stream and result', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const stream = client.createStream('test/stream')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Protocol['test/stream']
      >

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(stream).resolves.toBe('OK')

      const [writable, received] = createArraySink<number>()
      stream.readable.pipeTo(writable)
      await expect(received).resolves.toEqual([1, 2, 3])

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const stream = client.createStream('test/stream')
      stream.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Protocol['test/stream']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'AbortError',
      })
      await expect(stream).rejects.toBeInstanceOf(AbortSignal)

      await transports.dispose()
    })

    test('closes the stream', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const stream = client.createStream('test/stream')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Protocol['test/stream']
      >

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))

      stream.close()
      const closeRead = await transports.server.read()
      expect(closeRead.value?.payload).toEqual({ typ: 'abort', rid: payload.rid, rsn: 'Close' })

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(stream).resolves.toBe('OK')

      const [writable, received] = createArraySink<number>()
      stream.readable.pipeTo(writable)
      await expect(received).resolves.toEqual([1, 2, 3])

      await transports.dispose()
    })
  })

  describe('createChannel()', () => {
    const protocol = {
      'test/channel': {
        type: 'channel',
        send: { type: 'number' },
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    test('sends request and channel values and gets receive stream and result', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >

      await channel.send(1)
      const sentRead1 = await transports.server.read()
      const sent1 = sentRead1.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      await expect(sent1).toEqual({ typ: 'send', rid: payload.rid, val: 1 })

      await channel.send(2)
      const sentRead2 = await transports.server.read()
      const sent2 = sentRead2.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      await expect(sent2).toEqual({ typ: 'send', rid: payload.rid, val: 2 })

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(channel).resolves.toBe('OK')

      const [writable, received] = createArraySink<number>()
      channel.readable.pipeTo(writable)
      await expect(received).resolves.toEqual([1, 2, 3])

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      channel.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'AbortError',
      })
      await expect(channel).rejects.toBeInstanceOf(AbortSignal)

      await transports.dispose()
    })

    test('closes the channel', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >

      await channel.send(1)
      const sentRead1 = await transports.server.read()
      const sent1 = sentRead1.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      await expect(sent1).toEqual({ typ: 'send', rid: payload.rid, val: 1 })

      await channel.send(2)
      const sentRead2 = await transports.server.read()
      const sent2 = sentRead2.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      await expect(sent2).toEqual({ typ: 'send', rid: payload.rid, val: 2 })

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))

      channel.close()
      const closeRead = await transports.server.read()
      expect(closeRead.value?.payload).toEqual({ typ: 'abort', rid: payload.rid, rsn: 'Close' })

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(channel).resolves.toBe('OK')

      const [writable, received] = createArraySink<number>()
      channel.readable.pipeTo(writable)
      await expect(received).resolves.toEqual([1, 2, 3])

      await transports.dispose()
    })
  })
})
