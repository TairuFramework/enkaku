import type { AnyServerMessageOf, ErrorObject } from '@enkaku/protocol'
import { jest } from '@jest/globals'

import { handleStream } from '../src/handlers/stream.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext, StreamHandlerContext } from '../src/types.js'

type Definitions = {
  test: {
    type: 'stream'
    params: { test: boolean }
    receive: number
    result: string
    error: ErrorObject
  }
}
type Meta = undefined

type StreamContext = StreamHandlerContext<
  Definitions['test']['params'],
  Definitions['test']['receive'],
  Meta
>

describe('handleStream()', () => {
  const action = { type: 'stream', id: '1', name: 'test', params: { test: true } } as const

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const unknownAction = { type: 'stream', id: '1', name: 'unknown' }
    const returned = handleStream(
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
    const handler = jest.fn((ctx: StreamContext) => {
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

    await handleStream(
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
    const handler = jest.fn((ctx: StreamContext) => {
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

    await handleStream(
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
})
