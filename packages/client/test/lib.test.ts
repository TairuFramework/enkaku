import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ChannelDefinition,
  ChannelPayloadOf,
  EventDefinition,
  RequestDefinition,
  RequestPayloadOf,
  StreamDefinition,
  StreamPayloadOf,
} from '@enkaku/protocol'
import {
  createSignedToken,
  randomSigner,
  createUnsignedToken as unsignedToken,
} from '@enkaku/token'
import { createDirectTransports } from '@enkaku/transport'
import { Result } from 'typescript-result'

import { Client } from '../src/client.js'
import { ABORTED } from '../src/constants.js'

describe('Client', () => {
  test('sendEvent()', async () => {
    const [serverSigner, clientSigner] = await Promise.all([randomSigner(), randomSigner()])

    type Definitions = {
      'test/event': EventDefinition<{ hello: string }>
    }

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()
    const client = new Client({
      serverID: serverSigner.did,
      signer: clientSigner,
      transport: transports.client,
    })

    await client.sendEvent('test/event', { hello: 'world' })
    const signedMessage = await createSignedToken(clientSigner, {
      aud: serverSigner.did,
      typ: 'event',
      cmd: 'test/event',
      data: { hello: 'world' },
    })

    const eventRead = await transports.server.read()
    expect(eventRead.done).toBe(false)
    expect(eventRead.value).toEqual(signedMessage)
    await transports.dispose()
  })

  describe('request()', () => {
    type Definitions = {
      'test/request': RequestDefinition<undefined, string>
    }

    test('sends request and gets result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const request = await client.request('test/request')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Definitions['test/request']
      >
      expect(payload.cmd).toBe('test/request')
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      const result = await request.result
      expect(result).toBeInstanceOf(Result)
      expect(result.isOk()).toBe(true)
      expect(result.value).toBe('OK')

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const request = await client.request('test/request')
      request.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Definitions['test/request']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({ typ: 'abort', rid: payload.rid })
      const result = await request.result
      expect(result.error).toBe(ABORTED)

      await transports.dispose()
    })
  })

  describe('createStream()', () => {
    type Definitions = {
      'test/stream': StreamDefinition<undefined, number, string>
    }

    test('sends request and gets receive stream and result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const stream = await client.createStream('test/stream')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Definitions['test/stream']
      >

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      const result = await stream.result
      expect(result.value).toBe('OK')

      const reader = stream.receive.getReader()
      const received: Array<number> = []
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        received.push(next.value)
      }
      expect(received).toEqual([1, 2, 3])

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const stream = await client.createStream('test/stream')
      stream.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Definitions['test/stream']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({ typ: 'abort', rid: payload.rid })
      const result = await stream.result
      expect(result.error).toBe(ABORTED)

      await transports.dispose()
    })
  })

  describe('createChannel()', () => {
    type Definitions = {
      'test/channel': ChannelDefinition<undefined, number, number, string>
    }

    test('sends request and channel values and gets receive stream and result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const channel = await client.createChannel('test/channel')
      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >

      await channel.send(1)
      const sentRead1 = await transports.server.read()
      const sent1 = sentRead1.value?.payload as ChannelPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      await expect(sent1).toEqual({ typ: 'send', rid: payload.rid, val: 1 })

      await channel.send(2)
      const sentRead2 = await transports.server.read()
      const sent2 = sentRead2.value?.payload as ChannelPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      await expect(sent2).toEqual({ typ: 'send', rid: payload.rid, val: 2 })

      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 2 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: payload.rid, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      const result = await channel.result
      expect(result.value).toBe('OK')

      const reader = channel.receive.getReader()
      const received: Array<number> = []
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        received.push(next.value)
      }
      expect(received).toEqual([1, 2, 3])

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()
      const client = new Client({ transport: transports.client })

      const channel = await client.createChannel('test/channel')
      channel.abort()

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({ typ: 'abort', rid: payload.rid })
      const result = await channel.result
      expect(result.error).toBe(ABORTED)

      await transports.dispose()
    })
  })
})
