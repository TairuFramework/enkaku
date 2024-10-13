import type { ErrorObject } from '@enkaku/protocol'
import { jest } from '@jest/globals'

import { HandlerError } from '../src/error.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext } from '../src/types.js'
import { executeHandler, toPromise } from '../src/utils.js'

type Definitions = {
  test: {
    type: 'request'
    params: { test: boolean }
    result: string
    error: ErrorObject
  }
}

describe('executeHandler()', () => {
  const payload = { typ: 'request', rid: '1', cmd: 'test', prm: { test: true } } as const

  test('sends an error response and a rejection in case of error', async () => {
    const error = new HandlerError({ code: 'TEST123', message: 'Request failed' })
    const controllers = { '1': new AbortController() }
    const handler = jest.fn(() => {
      throw error
    })
    const reject = jest.fn()
    const send = jest.fn()

    await executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Definitions>,
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
    expect(reject).toHaveBeenCalled()
    const rejection = reject.mock.calls[0][0]
    expect(rejection).toBeInstanceOf(ErrorRejection)
    expect((rejection as ErrorRejection).message).toBe('Error handling command: test')
    expect((rejection as ErrorRejection).info).toBe(payload)
    expect((rejection as ErrorRejection).cause).toBe(error)
    expect(controllers).toEqual({})
  })

  test('does not send an error response if the abort signal is triggered', async () => {
    const error = new HandlerError({ code: 'TEST123', message: 'Request failed' })
    const controllers = { '1': new AbortController() }
    const handler = jest.fn(() => {
      return new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(error)
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn()

    const requestPromise = executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Definitions>,
      payload,
      () => handler(),
    )
    controllers['1']?.abort()
    await requestPromise

    expect(send).not.toHaveBeenCalled()
    expect(reject).toHaveBeenCalled()
    const rejection = reject.mock.calls[0][0]
    expect(rejection).toBeInstanceOf(ErrorRejection)
    expect((rejection as ErrorRejection).message).toBe('Error handling command: test')
    expect((rejection as ErrorRejection).info).toBe(payload)
    expect((rejection as ErrorRejection).cause).toBe(error)
    expect(controllers).toEqual({})
  })

  test('sends a result response with the handler returned value', async () => {
    const controllers = { '1': new AbortController() }
    const handler = jest.fn(() => 'OK')
    const reject = jest.fn()
    const send = jest.fn()

    await executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Definitions>,
      payload,
      () => handler(),
    )
    expect(send).toHaveBeenCalledWith({ typ: 'result', rid: '1', val: 'OK' })
    expect(reject).not.toHaveBeenCalled()
    expect(controllers).toEqual({})
  })

  test('does not send a result response if the abort signal is triggered', async () => {
    const controllers = { '1': new AbortController() }
    const handler = jest.fn(() => {
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('OK')
        }, 100)
      })
    })
    const reject = jest.fn()
    const send = jest.fn()

    const requestPromise = executeHandler(
      {
        controllers,
        handlers: { test: handler },
        reject,
        send,
      } as unknown as HandlerContext<Definitions>,
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

describe('toPromise()', () => {
  test('with sync return', async () => {
    await expect(toPromise(() => 'OK')).resolves.toBe('OK')
  })

  test('with sync throw', async () => {
    await expect(
      toPromise(() => {
        throw 'thrown'
      }),
    ).rejects.toBe('thrown')
  })

  test('with resolved promise', async () => {
    await expect(toPromise(() => Promise.resolve('OK'))).resolves.toBe('OK')
  })

  test('with rejected promise', async () => {
    await expect(toPromise(() => Promise.reject('rejected'))).rejects.toBe('rejected')
  })
})
