import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { ValidationError } from '@enkaku/schema'
import { createUnsignedToken, randomTokenSigner } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

import {
  type ChannelHandler,
  type EventHandler,
  type ProcedureHandlers,
  type RequestHandler,
  type StreamHandler,
  serve,
} from '../src/index.js'

describe('serve()', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 mins from now

  test('optionally validates protocol messages', async () => {
    const protocol = {
      test: {
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

    const handler = jest.fn() as jest.Mock<EventHandler<Protocol, 'test'>>

    const handlers = { test: handler } as ProcedureHandlers<Protocol>
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const signer = randomTokenSigner()
    const server = serve<Protocol>({
      handlers,
      id: signer.id,
      protocol,
      transport: transports.server,
    })
    const invalidMessageEventPromise = server.events.once('invalidMessage')

    const invalidMessage = await signer.createToken({
      typ: 'event',
      aud: signer.id,
      prc: 'invalid',
      data: { hello: 'world' },
      exp: expiresAt,
    } as const)
    // @ts-expect-error: invalid message
    await transports.client.write(invalidMessage)

    expect(handler).not.toHaveBeenCalled()
    const emittedError = await invalidMessageEventPromise
    expect(emittedError.error.message).toBe('Invalid protocol message')
    expect(emittedError.error.cause).toBeInstanceOf(ValidationError)

    const message = await signer.createToken({
      typ: 'event',
      aud: signer.id,
      prc: 'test',
      data: { hello: 'world' },
      exp: expiresAt,
    } as const)
    await transports.client.write(message)

    await server.dispose()
    await transports.dispose()

    expect(handler).toHaveBeenCalledWith({
      message,
      data: { hello: 'world' },
    })
  })

  test('handles events', async () => {
    const protocol = {
      test: {
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

    const handler = jest.fn() as jest.Mock<EventHandler<Protocol, 'test'>>

    const handlers = { test: handler } as ProcedureHandlers<Protocol>
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const signer = randomTokenSigner()
    const server = serve<Protocol>({
      handlers,
      id: signer.id,
      protocol,
      transport: transports.server,
    })

    const message = await signer.createToken({
      typ: 'event',
      aud: signer.id,
      prc: 'test',
      data: { hello: 'world' },
      exp: expiresAt,
    } as const)
    await transports.client.write(message)
    await server.dispose()
    await transports.dispose()

    expect(handler).toHaveBeenCalledWith({
      message,
      data: { hello: 'world' },
    })
  })

  test('handles requests', async () => {
    const protocol = {
      test: {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = jest.fn((ctx) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve('OK')
        }, 100)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    }) as jest.Mock<RequestHandler<Protocol, 'test'>>
    const handlers = { test: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomTokenSigner()
    serve<Protocol>({ handlers, id: signer.id, protocol, transport: transports.server })

    const message = (await signer.createToken({
      typ: 'request',
      iss: signer.id,
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()
    expect(read.value?.payload.val).toBe('OK')

    await transports.dispose()
  })

  test('handles streams', async () => {
    const protocol = {
      test: {
        type: 'stream',
        param: { type: 'number' },
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = jest.fn((ctx) => {
      return new Promise((resolve, reject) => {
        const writer = ctx.writable.getWriter()
        let count = 0
        const timer = setInterval(() => {
          if (count === 3) {
            clearInterval(timer)
            resolve('END')
          } else {
            writer.write(ctx.param + count++)
          }
        }, 50)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    }) as jest.Mock<StreamHandler<Protocol, 'test'>>
    const handlers = { test: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomTokenSigner()
    serve<Protocol>({ handlers, id: signer.id, protocol, transport: transports.server })

    const message = await signer.createToken({
      typ: 'stream',
      prc: 'test',
      rid: '1',
      prm: 3,
    } as const)
    await transports.client.write(message)

    const received: Array<number> = []
    let result = ''
    for await (const msg of transports.client) {
      if (msg.payload.typ === 'receive') {
        received.push(msg.payload.val)
      } else if (msg.payload.typ === 'result') {
        result = msg.payload.val
        break
      }
    }
    expect(received).toEqual([3, 4, 5])
    expect(result).toBe('END')

    await transports.dispose()
  })

  test('handles channels', async () => {
    const protocol = {
      test: {
        type: 'channel',
        param: { type: 'number' },
        send: { type: 'number' },
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = jest.fn(async (ctx) => {
      const reader = ctx.readable.getReader()
      const writer = ctx.writable.getWriter()
      let count = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done || count++ === 3) {
          break
        }
        writer.write(ctx.param + value)
      }
      return 'END'
    }) as jest.Mock<ChannelHandler<Protocol, 'test'>>
    const handlers = { test: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomTokenSigner()
    serve<Protocol>({ handlers, id: signer.id, protocol, transport: transports.server })

    const message = await signer.createToken({
      typ: 'channel',
      prc: 'test',
      rid: '1',
      prm: 5,
    } as const)
    await transports.client.write(message)

    const send = [5, 3, 10, 20]
    async function sendNext() {
      const val = send.shift()
      if (val != null) {
        await transports.client.write(
          createUnsignedToken({ typ: 'send', prc: 'test', rid: '1', val }),
        )
      }
    }
    sendNext()

    const received: Array<number> = []
    let result = ''
    for await (const msg of transports.client) {
      if (msg.payload.typ === 'receive') {
        received.push(msg.payload.val)
        sendNext()
      } else if (msg.payload.typ === 'result') {
        result = msg.payload.val
        break
      }
    }
    expect(received).toEqual([10, 8, 15])
    expect(result).toBe('END')

    await transports.dispose()
  })
})
