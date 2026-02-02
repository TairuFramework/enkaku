import { DisposeInterruption } from '@enkaku/async'
import type { Logger } from '@enkaku/log'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ChannelPayloadOf,
  ClientTransportOf,
  ProtocolDefinition,
  RequestPayloadOf,
  StreamPayloadOf,
} from '@enkaku/protocol'
import { createArraySink } from '@enkaku/stream'
import { randomIdentity, createUnsignedToken as unsignedToken } from '@enkaku/token'
import { DirectTransports, Transport } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/client.js'

describe('Client', () => {
  describe('handles transport disposed', () => {
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

    test('uses the new transport provided', async () => {
      const replacementStart = vi.fn(() => null)
      const handleTransportDisposed = vi.fn(() => {
        return new Transport({
          stream: {
            readable: new ReadableStream({ start: replacementStart }),
            writable: new WritableStream(),
          },
        })
      })
      const logger = {
        debug: vi.fn(),
      } as unknown as Logger

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({
        handleTransportDisposed,
        logger,
        transport: transports.client,
      })

      await transports.client.dispose()
      expect(handleTransportDisposed).toHaveBeenCalled()
      expect(replacementStart).toHaveBeenCalled()
      expect(client.signal.aborted).toBe(false)
      expect(logger.debug).toHaveBeenCalledWith(
        'using new transport provided by transport disposed handler',
      )
    })

    test('aborts the client if no new transport is provided', async () => {
      const handleTransportDisposed = vi.fn(() => {})
      const logger = {
        debug: vi.fn(),
      } as unknown as Logger

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({
        handleTransportDisposed,
        logger,
        transport: transports.client,
      })

      await transports.client.dispose()
      expect(handleTransportDisposed).toHaveBeenCalled()
      expect(client.signal.aborted).toBe(true)
      expect(client.signal.reason).toBe('TransportDisposed')
      expect(logger.debug).toHaveBeenCalledWith('transport disposed')
    })

    test('aborts the client if no handler provided', async () => {
      const logger = {
        debug: vi.fn(),
      } as unknown as Logger

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      await transports.client.dispose()
      expect(client.signal.aborted).toBe(true)
      expect(client.signal.reason).toBe('TransportDisposed')
      expect(logger.debug).toHaveBeenCalledWith('transport disposed')
    })

    test('does not call the handler if the client itself is aborted', async () => {
      const handleTransportDisposed = vi.fn(() => {})
      const logger = {
        debug: vi.fn(),
      } as unknown as Logger

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({
        handleTransportDisposed,
        logger,
        transport: transports.client,
      })

      await client.dispose()
      expect(handleTransportDisposed).not.toHaveBeenCalled()
      expect(client.signal.aborted).toBe(true)
      expect(client.signal.reason).toBeInstanceOf(DisposeInterruption)
      expect(logger.debug).toHaveBeenCalledWith('disposed')
    })
  })

  describe('handles transport error', () => {
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

    test('uses the new transport provided', async () => {
      const cause = new Error('Transport error')
      const replacementStart = vi.fn()
      const handleTransportError = vi.fn((error) => {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Transport read failed')
        expect((error as Error).cause).toBe(cause)

        return new Transport({
          stream: {
            readable: new ReadableStream({ start: replacementStart }),
            writable: new WritableStream(),
          },
        })
      })
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger

      const client = new Client<Protocol>({
        handleTransportError,
        logger,
        transport: new Transport({
          stream: {
            readable: new ReadableStream({
              pull(controller) {
                controller.error(cause)
              },
            }),
            writable: new WritableStream(),
          },
        }) as ClientTransportOf<Protocol>,
      })
      await client.sendEvent('test/event', { hello: 'test' })

      expect(handleTransportError).toHaveBeenCalled()
      expect(replacementStart).toHaveBeenCalled()
      expect(client.signal.aborted).toBe(false)
      expect(logger.debug).toHaveBeenCalledWith('failed to read from transport', { cause })
      expect(logger.debug).toHaveBeenCalledWith(
        'using new transport provided by transport error handler',
      )
    })

    test('aborts the client if no new transport is provided', async () => {
      const cause = new Error('Transport error')
      const handleTransportError = vi.fn((error) => {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Transport read failed')
        expect((error as Error).cause).toBe(cause)
      })
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
        warn: vi.fn(),
      } as unknown as Logger

      const client = new Client<Protocol>({
        handleTransportError,
        logger,
        transport: new Transport({
          stream: {
            readable: new ReadableStream({
              pull(controller) {
                controller.error(cause)
              },
            }),
            writable: new WritableStream(),
          },
        }) as ClientTransportOf<Protocol>,
      })
      await client.sendEvent('test/event', { hello: 'test' })

      expect(handleTransportError).toHaveBeenCalled()
      expect(client.signal.aborted).toBe(true)
      expect((client.signal.reason as Error).message).toBe('Transport read failed')
      expect(logger.debug).toHaveBeenCalledWith('failed to read from transport', { cause })
      expect(logger.warn).toHaveBeenCalledWith('aborting following unhanded transport error')
    })

    test('aborts the client if no handler provided', async () => {
      const cause = new Error('Transport error')
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
        warn: vi.fn(),
      } as unknown as Logger

      const client = new Client<Protocol>({
        logger,
        transport: new Transport({
          stream: {
            readable: new ReadableStream({
              pull(controller) {
                controller.error(cause)
              },
            }),
            writable: new WritableStream(),
          },
        }) as ClientTransportOf<Protocol>,
      })
      await client.sendEvent('test/event', { hello: 'test' })

      expect(client.signal.aborted).toBe(true)
      expect((client.signal.reason as Error).message).toBe('Transport read failed')
      expect((client.signal.reason as Error).cause).toBe(cause)
      expect(logger.debug).toHaveBeenCalledWith('failed to read from transport', { cause })
      expect(logger.warn).toHaveBeenCalledWith('aborting following unhanded transport error')
    })

    test('does not call the handler if the client itself is aborted', async () => {
      const cause = new Error('Transport error')
      const handleTransportError = vi.fn(() => {})
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger

      const client = new Client<Protocol>({
        handleTransportError,
        logger,
        transport: new Transport({
          stream: {
            readable: new ReadableStream({
              pull(controller) {
                controller.error(cause)
              },
            }),
            writable: new WritableStream(),
          },
        }) as ClientTransportOf<Protocol>,
      })
      await client.dispose()
      await expect(client.sendEvent('test/event', { hello: 'test' })).rejects.toThrow(
        'Client aborted',
      )

      expect(handleTransportError).not.toHaveBeenCalled()
      expect(client.signal.aborted).toBe(true)
      expect(client.signal.reason).toBeInstanceOf(DisposeInterruption)
      expect(logger.debug).toHaveBeenCalledWith('disposed')
    })
  })

  test('sendEvent()', async () => {
    const serverIdentity = randomIdentity()
    const clientIdentity = randomIdentity()

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

    const logger = {
      debug: vi.fn(),
      trace: vi.fn(),
    } as unknown as Logger

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      logger,
      serverID: serverIdentity.id,
      identity: clientIdentity,
      transport: transports.client,
    })

    await client.sendEvent('test/event', { data: { hello: 'world' } })
    const signedMessage = await clientIdentity.signToken({
      aud: serverIdentity.id,
      typ: 'event',
      prc: 'test/event',
      data: { hello: 'world' },
    })
    expect(logger.trace).toHaveBeenCalledWith('send event {procedure}', {
      procedure: 'test/event',
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
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const request = client.request('test/request')
      expect(logger.trace).toHaveBeenCalledWith('send request {procedure} with ID {rid}', {
        procedure: 'test/request',
        rid: request.id,
        param: undefined,
      })

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Protocol['test/request']
      >
      expect(payload.prc).toBe('test/request')
      await transports.server.write(unsignedToken({ typ: 'result', rid: payload.rid, val: 'OK' }))
      await expect(request).resolves.toBe('OK')
      expect(logger.trace).toHaveBeenCalledWith(
        'result reply for {type} {procedure} with ID {rid}',
        {
          type: 'request',
          procedure: 'test/request',
          rid: request.id,
          result: 'OK',
        },
      )

      await transports.dispose()
    })

    test('aborts request', async () => {
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const request = client.request('test/request')
      expect(logger.trace).toHaveBeenCalledWith('send request {procedure} with ID {rid}', {
        procedure: 'test/request',
        rid: request.id,
        param: undefined,
      })
      request.abort('test')

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as RequestPayloadOf<
        'test/request',
        Protocol['test/request']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'test',
      })
      await expect(request).rejects.toBeInstanceOf(AbortSignal)
      expect(logger.trace).toHaveBeenCalledWith('abort {type} {procedure} with ID {rid}', {
        type: 'request',
        procedure: 'test/request',
        rid: request.id,
        reason: 'test',
      })

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
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const stream = client.createStream('test/stream')
      expect(logger.trace).toHaveBeenCalledWith('create stream {procedure} with ID {rid}', {
        procedure: 'test/stream',
        rid: stream.id,
        param: undefined,
      })

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

      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'stream',
          procedure: 'test/stream',
          rid: stream.id,
          receive: 1,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'stream',
          procedure: 'test/stream',
          rid: stream.id,
          receive: 2,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'stream',
          procedure: 'test/stream',
          rid: stream.id,
          receive: 3,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'result reply for {type} {procedure} with ID {rid}',
        {
          type: 'stream',
          procedure: 'test/stream',
          rid: stream.id,
          result: 'OK',
        },
      )

      await transports.dispose()
    })

    test('aborts the stream', async () => {
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const stream = client.createStream('test/stream')
      stream.abort('test')

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as StreamPayloadOf<
        'test/stream',
        Protocol['test/stream']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'test',
      })
      await expect(stream).rejects.toBeInstanceOf(AbortSignal)
      expect(logger.trace).toHaveBeenCalledWith('abort {type} {procedure} with ID {rid}', {
        type: 'stream',
        procedure: 'test/stream',
        rid: stream.id,
        reason: 'test',
      })

      await transports.dispose()
    })

    test('aborting the stream closes the readable', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const [writable, receivedPromise] = createArraySink<number>()
      const stream = client.createStream('test/stream')
      const pipeDone = stream.readable.pipeTo(writable)

      await transports.server.read()
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 2 }))

      stream.abort()
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 3 }))
      await pipeDone
      await expect(receivedPromise).resolves.toEqual([1, 2])
      stream.catch((reason) => {
        expect(reason).toBeInstanceOf(AbortSignal)
      })

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

    test('closing the stream closes the readable', async () => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const [writable, receivedPromise] = createArraySink<number>()
      const stream = client.createStream('test/stream')
      const pipeDone = stream.readable.pipeTo(writable)

      await transports.server.read()
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 1 }))
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 2 }))

      stream.close()
      await transports.server.write(unsignedToken({ typ: 'receive', rid: stream.id, val: 3 }))
      await transports.server.write(unsignedToken({ typ: 'result', rid: stream.id, val: 'OK' }))

      await pipeDone
      await expect(receivedPromise).resolves.toEqual([1, 2, 3])
      await expect(stream).resolves.toBe('OK')

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
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const channel = client.createChannel('test/channel')
      expect(logger.trace).toHaveBeenCalledWith('create channel {procedure} with ID {rid}', {
        procedure: 'test/channel',
        rid: channel.id,
        param: undefined,
      })

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >

      await channel.send(1)
      expect(logger.trace).toHaveBeenCalledWith('send value to channel {procedure} with ID {rid}', {
        procedure: 'test/channel',
        rid: channel.id,
        value: 1,
      })
      const sentRead1 = await transports.server.read()
      const sent1 = sentRead1.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      await expect(sent1).toEqual({ typ: 'send', rid: payload.rid, val: 1 })

      await channel.send(2)
      expect(logger.trace).toHaveBeenCalledWith('send value to channel {procedure} with ID {rid}', {
        procedure: 'test/channel',
        rid: channel.id,
        value: 2,
      })
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

      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'channel',
          procedure: 'test/channel',
          rid: channel.id,
          receive: 1,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'channel',
          procedure: 'test/channel',
          rid: channel.id,
          receive: 2,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'receive reply for {type} {procedure} with ID {rid}',
        {
          type: 'channel',
          procedure: 'test/channel',
          rid: channel.id,
          receive: 3,
        },
      )
      expect(logger.trace).toHaveBeenCalledWith(
        'result reply for {type} {procedure} with ID {rid}',
        {
          type: 'channel',
          procedure: 'test/channel',
          rid: channel.id,
          result: 'OK',
        },
      )

      await transports.dispose()
    })

    test('aborts the channel', async () => {
      const logger = {
        debug: vi.fn(),
        trace: vi.fn(),
      } as unknown as Logger
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ logger, transport: transports.client })

      const channel = client.createChannel('test/channel')
      channel.abort('test')

      const requestRead = await transports.server.read()
      const payload = requestRead.value?.payload as ChannelPayloadOf<
        'test/channel',
        Protocol['test/channel']
      >
      const abortRead = await transports.server.read()
      expect(abortRead.value?.payload).toEqual({
        typ: 'abort',
        rid: payload.rid,
        rsn: 'test',
      })
      await expect(channel).rejects.toBeInstanceOf(AbortSignal)
      expect(logger.trace).toHaveBeenCalledWith('abort {type} {procedure} with ID {rid}', {
        type: 'channel',
        procedure: 'test/channel',
        rid: channel.id,
        reason: 'test',
      })

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
