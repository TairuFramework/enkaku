import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ChannelActionDefinition,
  ChannelActionPayloadOf,
  EventActionDefinition,
  RequestActionDefinition,
  RequestActionPayloadOf,
  StreamActionDefinition,
  StreamActionPayloadOf,
} from '@enkaku/protocol'
import { createDirectTransports } from '@enkaku/transport'

import { Client } from '../src/client.js'
import { ABORTED } from '../src/constants.js'

describe('Client', () => {
  type Meta = { test: boolean }

  test('sendEvent()', async () => {
    type Definitions = {
      'test/event': EventActionDefinition<{ hello: string }>
    }

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions, Meta>
    >()
    const client = new Client({ meta: { test: true }, transport: transports.client })

    await client.sendEvent('test/event', { hello: 'world' })
    const eventRead = await transports.server.read()
    expect(eventRead.done).toBe(false)
    expect(eventRead.value).toEqual({
      action: { type: 'event', name: 'test/event', data: { hello: 'world' } },
      meta: { test: true },
    })
    await transports.dispose()
  })

  describe('request()', () => {
    type Definitions = {
      'test/request': RequestActionDefinition<undefined, string>
    }

    test('sends request and gets result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const request = await client.request('test/request')
      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as RequestActionPayloadOf<
        'test/request',
        Definitions['test/request']
      >
      expect(action.name).toBe('test/request')
      await transports.server.write({ action: { type: 'result', id: action.id, value: 'OK' } })
      await expect(request.result).resolves.toBe('OK')

      await transports.dispose()
    })

    test('aborts request', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const request = await client.request('test/request')
      request.abort()

      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as RequestActionPayloadOf<
        'test/request',
        Definitions['test/request']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.action).toEqual({ type: 'abort', id: action.id })
      await expect(request.result).rejects.toBe(ABORTED)

      await transports.dispose()
    })
  })

  describe('createStream()', () => {
    type Definitions = {
      'test/stream': StreamActionDefinition<undefined, number, string>
    }

    test('sends request and gets receive stream and result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const stream = await client.createStream('test/stream')
      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as StreamActionPayloadOf<
        'test/stream',
        Definitions['test/stream']
      >

      await transports.server.write({ action: { type: 'receive', id: action.id, value: 1 } })
      await transports.server.write({ action: { type: 'receive', id: action.id, value: 2 } })
      await transports.server.write({ action: { type: 'receive', id: action.id, value: 3 } })
      await transports.server.write({ action: { type: 'result', id: action.id, value: 'OK' } })
      await expect(stream.result).resolves.toBe('OK')

      const received: Array<number> = []
      while (true) {
        const next = await stream.receive.read()
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
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const stream = await client.createStream('test/stream')
      stream.abort()

      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as StreamActionPayloadOf<
        'test/stream',
        Definitions['test/stream']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.action).toEqual({ type: 'abort', id: action.id })
      await expect(stream.result).rejects.toBe(ABORTED)

      await transports.dispose()
    })
  })

  describe('createChannel()', () => {
    type Definitions = {
      'test/channel': ChannelActionDefinition<undefined, number, number, string>
    }

    test('sends request and channel values and gets receive stream and result', async () => {
      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const channel = await client.createChannel('test/channel')
      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as ChannelActionPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >

      await channel.send(1)
      const sentRead1 = await transports.server.read()
      const sent1 = sentRead1.value?.action as ChannelActionPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      await expect(sent1).toEqual({ type: 'send', id: action.id, value: 1 })

      await channel.send(2)
      const sentRead2 = await transports.server.read()
      const sent2 = sentRead2.value?.action as ChannelActionPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      await expect(sent2).toEqual({ type: 'send', id: action.id, value: 2 })

      await transports.server.write({ action: { type: 'receive', id: action.id, value: 1 } })
      await transports.server.write({ action: { type: 'receive', id: action.id, value: 2 } })
      await transports.server.write({ action: { type: 'receive', id: action.id, value: 3 } })
      await transports.server.write({ action: { type: 'result', id: action.id, value: 'OK' } })
      await expect(channel.result).resolves.toBe('OK')

      const received: Array<number> = []
      while (true) {
        const next = await channel.receive.read()
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
        AnyClientMessageOf<Definitions, Meta>
      >()
      const client = new Client({ meta: { test: true }, transport: transports.client })

      const channel = await client.createStream('test/channel')
      channel.abort()

      const requestRead = await transports.server.read()
      const action = requestRead.value?.action as ChannelActionPayloadOf<
        'test/channel',
        Definitions['test/channel']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.action).toEqual({ type: 'abort', id: action.id })
      await expect(channel.result).rejects.toBe(ABORTED)

      await transports.dispose()
    })
  })
})
