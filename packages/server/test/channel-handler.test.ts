import type { AnyServerPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { map } from '@enkaku/stream'
import { createUnsignedToken } from '@enkaku/token'
import { jest } from '@jest/globals'

import { handleChannel } from '../src/handlers/channel.js'
import type {
  ChannelController,
  ChannelHandlerContext,
  HandlerContext,
  HandlerController,
} from '../src/types.js'

const protocol = {
  test: {
    type: 'channel',
    param: {
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    },
    send: { type: 'number' },
    receive: { type: 'number' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type ChannelContext = ChannelHandlerContext<Protocol, 'test'>

describe('handleChannel()', () => {
  const clientToken = createUnsignedToken({
    typ: 'channel',
    rid: '1',
    prc: 'test',
    prm: { test: true },
  } as const)

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const unknownPayload = { typ: 'channel', rid: '1', prc: 'unknown', prm: {} } as const
    // @ts-expect-error type instantiation too deep
    const returned = handleChannel(
      { handlers: {} } as unknown as HandlerContext<Protocol>,
      // @ts-expect-error
      { payload: unknownPayload },
    )
    expect(returned).toBeInstanceOf(Error)
    expect((returned as Error).message).toBe('No handler for procedure: unknown')
  })

  test('sends receive messages', async () => {
    const controllers = {}
    const handler = jest.fn((ctx: ChannelContext) => {
      const writer = ctx.writable.getWriter()
      let count = 0
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          writer.write(count++)
          if (count === 3) {
            clearInterval(timer)
            resolve('OK')
          }
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn()

    await handleChannel(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      clientToken,
    )

    expect(send).toHaveBeenCalledTimes(4)
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 0 })
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 1 })
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 2 })
    expect(send).toHaveBeenCalledWith({ typ: 'result', rid: '1', val: 'OK' })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('stops sending receive messages if the abort signal is triggered', async () => {
    const controllers: Record<string, HandlerController> = {}
    const handler = jest.fn((ctx: ChannelContext) => {
      const writer = ctx.writable.getWriter()
      let count = 0
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          writer.write(count++)
          if (count === 3) {
            clearInterval(timer)
            resolve('OK')
          }
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn((payload: AnyServerPayloadOf<Protocol>) => {
      if (payload.typ === 'receive' && payload.val === 1) {
        controllers['1']?.abort()
      }
    })

    await handleChannel(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      clientToken,
    )

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 0 })
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 1 })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('receives sent messages', async () => {
    const controllers: Record<string, ChannelController> = {}
    const handler = jest.fn((ctx: ChannelContext) => {
      ctx.readable.pipeThrough(map((value) => value * 2)).pipeTo(ctx.writable)
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve('OK')
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn()

    // @ts-expect-error type instantiation too deep
    const resultPromise = handleChannel(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      clientToken,
    )
    await controllers['1'].writer.write(0)
    await controllers['1'].writer.write(1)
    await controllers['1'].writer.write(2)
    await resultPromise

    expect(send).toHaveBeenCalledTimes(4)
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 0 })
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 2 })
    expect(send).toHaveBeenCalledWith({ typ: 'receive', rid: '1', val: 4 })
    expect(send).toHaveBeenCalledWith({ typ: 'result', rid: '1', val: 'OK' })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })
})
