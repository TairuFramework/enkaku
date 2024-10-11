import type { AnyServerMessageOf, ErrorObject } from '@enkaku/protocol'
import { jest } from '@jest/globals'

import { handleChannel } from '../src/handlers/channel.js'
import { ErrorRejection } from '../src/rejections.js'
import type { ChannelHandlerContext, HandlerContext } from '../src/types.js'
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
type Meta = undefined

type ChannelContext = ChannelHandlerContext<
  Definitions['test']['params'],
  Definitions['test']['send'],
  Definitions['test']['receive'],
  Meta
>

describe('handleChannel()', () => {
  const action = { type: 'channel', id: '1', name: 'test', params: { test: true } } as const

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const unknownAction = { type: 'channel', id: '1', name: 'unknown', params: {} } as const
    const returned = handleChannel(
      { handlers: {} } as unknown as HandlerContext<Definitions, Meta>,
      // @ts-expect-error
      { action: unknownAction },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for action: unknown')
    expect((returned as ErrorRejection).info).toEqual(unknownAction)
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
      { controllers, handlers: { test: handler }, reject, send } as unknown as HandlerContext<
        Definitions,
        Meta
      >,
      { action, meta: undefined },
    )

    expect(send).toHaveBeenCalledTimes(4)
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 0 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 1 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 2 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'result', id: '1', value: 'OK' } })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('stops sending receive messages if the abort signal is triggered', async () => {
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
    const send = jest.fn((msg: AnyServerMessageOf<Definitions>) => {
      if (msg.action.type === 'receive' && msg.action.value === 1) {
        controllers['1']?.abort()
      }
    })

    await handleChannel(
      { controllers, handlers: { test: handler }, reject, send } as unknown as HandlerContext<
        Definitions,
        Meta
      >,
      { action, meta: undefined },
    )

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 0 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 1 } })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('receives sent messages', async () => {
    const controllers = {}
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
      { controllers, handlers: { test: handler }, reject, send } as unknown as HandlerContext<
        Definitions,
        Meta
      >,
      { action, meta: undefined },
    )
    await controllers['1'].writer.write(0)
    await controllers['1'].writer.write(1)
    await controllers['1'].writer.write(2)
    await resultPromise

    expect(send).toHaveBeenCalledTimes(4)
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 0 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 2 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'receive', id: '1', value: 4 } })
    expect(send).toHaveBeenCalledWith({ action: { type: 'result', id: '1', value: 'OK' } })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })
})
