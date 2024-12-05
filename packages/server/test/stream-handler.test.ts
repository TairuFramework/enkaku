import type { AnyServerPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { jest } from '@jest/globals'

import { handleStream } from '../src/handlers/stream.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext, HandlerController, StreamHandlerContext } from '../src/types.js'

const protocol = {
  test: {
    type: 'stream',
    params: {
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    },
    receive: { type: 'number' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type StreamContext = StreamHandlerContext<Protocol, 'test'>

describe('handleStream()', () => {
  const clientToken = createUnsignedToken({
    typ: 'stream',
    rid: '1',
    cmd: 'test',
    prm: { test: true },
  } as const)

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const unknownPayload = { typ: 'stream', rid: '1', cmd: 'unknown' }
    // @ts-ignore type instantiation too deep
    const returned = handleStream(
      { handlers: {} } as unknown as HandlerContext<Protocol>,
      // @ts-expect-error
      { payload: unknownPayload },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for command: unknown')
    expect((returned as ErrorRejection).info).toEqual(unknownPayload)
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
    const send = jest.fn((payload: AnyServerPayloadOf<Protocol>) => {
      if (payload.typ === 'receive' && payload.val === 1) {
        controllers['1']?.abort()
      }
    })

    await handleStream(
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
})
