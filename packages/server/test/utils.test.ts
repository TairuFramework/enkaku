import { EventEmitter } from '@enkaku/event'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { HandlerError } from '../src/error.js'
import type { HandlerContext, ServerEvents } from '../src/types.js'
import { executeHandler } from '../src/utils.js'

const protocol = {
  test: {
    type: 'request',
    param: {
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('executeHandler()', () => {
  const payload = { typ: 'request', rid: '1', prc: 'test', prm: { test: true } } as const

  test('sends an error response and emits in case of error', async () => {
    const error = new HandlerError({ code: 'TEST123', message: 'Request failed' })
    const controllers = { '1': new AbortController() }
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      throw error
    })
    const send = vi.fn()
    const handlerError = events.once('handlerError')

    // @ts-expect-error type instantiation too deep
    await executeHandler(
      {
        controllers,
        events,
        handlers: { test: handler },
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    expect(send).toHaveBeenCalledWith({
      typ: 'error',
      rid: '1',
      code: error.code,
      data: {},
      msg: 'Request failed',
    })

    const emittedError = await handlerError
    expect(emittedError.error.message).toBe('Error handling procedure: test')
    expect(emittedError.error.cause).toBe(error)
    expect(emittedError.payload).toEqual(payload)
    expect(controllers).toEqual({})
  })

  test('sends an error response if the abort signal is triggered with the "Close" reason', async () => {
    const error = new HandlerError({ code: 'TEST123', message: 'Request failed' })
    const controllers = { '1': new AbortController() }
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      return new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(error)
        }, 100)
      })
    })
    const send = vi.fn()
    const handlerError = events.once('handlerError')

    // @ts-expect-error type instantiation too deep
    const requestPromise = executeHandler(
      {
        controllers,
        events,
        handlers: { test: handler },
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    controllers['1']?.abort('Close')
    await requestPromise

    expect(send).toHaveBeenCalledWith({
      typ: 'error',
      rid: '1',
      code: error.code,
      data: {},
      msg: 'Request failed',
    })

    const emittedError = await handlerError
    expect(emittedError.error.message).toBe('Error handling procedure: test')
    expect(emittedError.error.cause).toBe(error)
    expect(emittedError.payload).toEqual(payload)
    expect(controllers).toEqual({})
  })

  test('does not send an error response if the abort signal is triggered with a reason other than "Close"', async () => {
    const error = new HandlerError({ code: 'TEST123', message: 'Request failed' })
    const controllers = { '1': new AbortController() }
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      return new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(error)
        }, 100)
      })
    })
    const send = vi.fn()
    const handlerError = events.once('handlerError')

    // @ts-expect-error type instantiation too deep
    const requestPromise = executeHandler(
      {
        controllers,
        events,
        handlers: { test: handler },
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    controllers['1']?.abort()
    await requestPromise

    expect(send).not.toHaveBeenCalled()
    const emittedError = await handlerError
    expect(emittedError.error.message).toBe('Error handling procedure: test')
    expect(emittedError.error.cause).toBe(error)
    expect(emittedError.payload).toEqual(payload)
    expect(controllers).toEqual({})
  })

  test('sends a result response with the handler returned value', async () => {
    const controllers = { '1': new AbortController() }
    const handler = vi.fn(() => 'OK')
    const reject = vi.fn()
    const send = vi.fn()

    await executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    expect(send).toHaveBeenCalledWith({ typ: 'result', rid: '1', val: 'OK' })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('sends a result response if the abort signal is triggered with the "Close" reason', async () => {
    const controllers = { '1': new AbortController() }
    const handler = vi.fn(() => {
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('OK')
        }, 100)
      })
    })
    const reject = vi.fn()
    const send = vi.fn()

    // @ts-expect-error type instantiation too deep
    const requestPromise = executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    controllers['1']?.abort('Close')
    await requestPromise

    expect(send).toHaveBeenCalledWith({ typ: 'result', rid: '1', val: 'OK' })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('does not send a result response if the abort signal is triggered with a reason other than "Close"', async () => {
    const controllers = { '1': new AbortController() }
    const handler = vi.fn(() => {
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('OK')
        }, 100)
      })
    })
    const reject = vi.fn()
    const send = vi.fn()

    // @ts-expect-error type instantiation too deep
    const requestPromise = executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    controllers['1']?.abort()
    await requestPromise

    expect(send).not.toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })
})
