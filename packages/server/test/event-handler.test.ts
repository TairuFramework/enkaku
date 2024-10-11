import { jest } from '@jest/globals'

import { handleEvent } from '../src/handlers/event.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext } from '../src/types.js'

type Definitions = {
  test: {
    type: 'event'
    data: { test: boolean }
  }
}
type Meta = undefined

describe('handleEvent()', () => {
  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const action = { type: 'event', name: 'unknown' }
    const returned = handleEvent({ handlers: {} } as unknown as HandlerContext<Definitions, Meta>, {
      // @ts-expect-error
      action,
    })
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for action: unknown')
    expect((returned as ErrorRejection).info).toEqual(action)
  })

  test('sends an ErrorRejection if the handler fails but resolves the returned promise', async () => {
    const action = { type: 'event', name: 'test', data: { test: true } } as const
    const errorCause = new Error('Failed!')
    const handler = jest.fn(() => {
      throw errorCause
    })
    const reject = jest.fn()

    // Handler promise should always resolve
    await expect(
      handleEvent(
        { handlers: { test: handler }, reject } as unknown as HandlerContext<Definitions, Meta>,
        { action, meta: undefined },
      ),
    ).resolves.toBeUndefined()

    // Handler failure should cause a reject() call
    expect(reject).toHaveBeenCalled()
    const rejection = reject.mock.calls[0][0]
    expect(rejection).toBeInstanceOf(ErrorRejection)
    expect((rejection as ErrorRejection).message).toBe('Error handling action: test')
    expect((rejection as ErrorRejection).info).toBe(action)
    expect((rejection as ErrorRejection).cause).toBe(errorCause)
  })

  test('successfully calls the event handler', async () => {
    const action = { type: 'event', name: 'test', data: { test: true } } as const
    const handler = jest.fn()
    const reject = jest.fn()

    await expect(
      handleEvent(
        { handlers: { test: handler }, reject } as unknown as HandlerContext<Definitions, Meta>,
        { action, meta: undefined },
      ),
    ).resolves.toBeUndefined()
    expect(reject).not.toHaveBeenCalled()
  })
})
