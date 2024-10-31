import { createSignedToken, createUnsignedToken, randomSigner } from '@enkaku/jwt'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ChannelDefinition,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from '@enkaku/protocol'
import { createDirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

import {
  type ChannelHandler,
  type CommandHandlers,
  type EventHandler,
  type RequestHandler,
  type StreamHandler,
  serve,
} from '../src/index.js'

describe('serve()', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 mins from now

  test('handles events', async () => {
    type Definitions = {
      'test/event': EventDefinition<{ hello: string }>
    }

    const handler = jest.fn() as jest.Mock<EventHandler<'test/event', { hello: string }>>

    const handlers = { 'test/event': handler } as CommandHandlers<Definitions>
    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()

    const signer = await randomSigner()
    const server = serve<Definitions>({ handlers, id: signer.did, transport: transports.server })

    const message = await createSignedToken(signer, {
      typ: 'event',
      aud: signer.did,
      cmd: 'test/event',
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
    type Definitions = {
      'test/request': RequestDefinition<undefined, string>
    }

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
    }) as jest.Mock<RequestHandler<'test/request', undefined, string>>
    const handlers = { 'test/request': handler } as CommandHandlers<Definitions>

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()
    const signer = await randomSigner()
    serve<Definitions>({ handlers, id: signer.did, transport: transports.server })

    const message = await createSignedToken(signer, {
      typ: 'request',
      cmd: 'test/request',
      rid: '1',
      prm: undefined,
    } as const)
    await transports.client.write(message)
    const read = await transports.client.read()
    expect(read.value?.payload.val).toBe('OK')

    await transports.dispose()
  })

  test('handles streams', async () => {
    type Definitions = {
      'test/stream': StreamDefinition<number, number, string>
    }

    const handler = jest.fn((ctx) => {
      return new Promise((resolve, reject) => {
        const writer = ctx.writable.getWriter()
        let count = 0
        const timer = setInterval(() => {
          if (count === 3) {
            clearInterval(timer)
            resolve('END')
          } else {
            writer.write(ctx.params + count++)
          }
        }, 50)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    }) as jest.Mock<StreamHandler<'test/stream', number, number, string>>
    const handlers = { 'test/stream': handler } as CommandHandlers<Definitions>

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()
    const signer = await randomSigner()
    serve<Definitions>({ handlers, id: signer.did, transport: transports.server })

    const message = await createSignedToken(signer, {
      typ: 'stream',
      cmd: 'test/stream',
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
    type Definitions = {
      'test/channel': ChannelDefinition<number, number, number, string>
    }

    const handler = jest.fn(async (ctx) => {
      const reader = ctx.readable.getReader()
      const writer = ctx.writable.getWriter()
      let count = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done || count++ === 3) {
          break
        }
        writer.write(ctx.params + value)
      }
      return 'END'
    }) as jest.Mock<ChannelHandler<'test/channel', number, number, number, string>>
    const handlers = { 'test/channel': handler } as CommandHandlers<Definitions>

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()
    const signer = await randomSigner()
    serve<Definitions>({ handlers, id: signer.did, transport: transports.server })

    const message = await createSignedToken(signer, {
      typ: 'channel',
      cmd: 'test/channel',
      rid: '1',
      prm: 5,
    } as const)
    await transports.client.write(message)

    const send = [5, 3, 10, 20]
    async function sendNext() {
      const val = send.shift()
      if (val != null) {
        await transports.client.write(
          createUnsignedToken({ typ: 'send', cmd: 'test/channel', rid: '1', val }),
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
