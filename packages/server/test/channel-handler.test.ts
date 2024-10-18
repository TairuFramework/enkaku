import { createUnsignedToken } from '@enkaku/jwt'
import type { AnyServerPayloadOf, ErrorObject } from '@enkaku/protocol'
import { jest } from '@jest/globals'

import { handleChannel } from '../src/handlers/channel.js'
import { ErrorRejection } from '../src/rejections.js'
import type {
  ChannelController,
  ChannelHandlerContext,
  HandlerContext,
  HandlerController,
} from '../src/types.js'
import { consumeReader } from '../src/utils.js'

type Definitions = {
  test: {
    type: 'channel'
    params: { test: boolean }
    send: number
    receive: number
    result: string
    error: ErrorObject
  }
}

type ChannelContext = ChannelHandlerContext<
  Definitions['test']['params'],
  Definitions['test']['send'],
  Definitions['test']['receive']
>

describe('handleChannel()', () => {
  const clientToken = createUnsignedToken({
    typ: 'channel',
    rid: '1',
    cmd: 'test',
    prm: { test: true },
  } as const)

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const unknownPayload = { typ: 'channel', rid: '1', cmd: 'unknown', prm: {} } as const
    const returned = handleChannel(
      { handlers: {} } as unknown as HandlerContext<Definitions>,
      // @ts-expect-error
      { payload: unknownPayload },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for command: unknown')
    expect((returned as ErrorRejection).info).toEqual(unknownPayload)
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
      } as unknown as HandlerContext<Definitions>,
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
    const send = jest.fn((payload: AnyServerPayloadOf<Definitions>) => {
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
      } as unknown as HandlerContext<Definitions>,
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
      const writer = ctx.writable.getWriter()

      consumeReader({
        onValue: (value) => writer.write(value * 2),
        reader: ctx.readable.getReader(),
        signal: ctx.signal,
      })

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve('OK')
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn()

    const resultPromise = handleChannel(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Definitions>,
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
