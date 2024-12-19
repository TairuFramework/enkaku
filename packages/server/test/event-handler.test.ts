import type { ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { jest } from '@jest/globals'

import { handleEvent } from '../src/handlers/event.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext } from '../src/types.js'

const protocol = {
  test: {
    type: 'event',
    data: {
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('handleEvent()', () => {
  const clientToken = createUnsignedToken({
    typ: 'event',
    prc: 'test',
    data: { test: true },
  } as const)

  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const payload = { typ: 'event', prc: 'unknown' }
    // @ts-ignore type instantiation too deep
    const returned = handleEvent({ handlers: {} } as unknown as HandlerContext<Protocol>, {
      // @ts-expect-error
      payload,
    })
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for procedure: unknown')
    expect((returned as ErrorRejection).info).toEqual(payload)
  })

  test('sends an ErrorRejection if the handler fails but resolves the returned promise', async () => {
    const errorCause = new Error('Failed!')
    const handler = jest.fn(() => {
      throw errorCause
    })
    const reject = jest.fn()

    // Handler promise should always resolve
    await expect(
      handleEvent(
        { handlers: { test: handler }, reject } as unknown as HandlerContext<Protocol>,
        clientToken,
      ),
    ).resolves.toBeUndefined()

    // Handler failure should cause a reject() call
    expect(reject).toHaveBeenCalled()
    const rejection = reject.mock.calls[0][0]
    expect(rejection).toBeInstanceOf(ErrorRejection)
    expect((rejection as ErrorRejection).message).toBe('Error handling procedure: test')
    expect((rejection as ErrorRejection).info).toBe(clientToken.payload)
    expect((rejection as ErrorRejection).cause).toBe(errorCause)
  })

  test('successfully calls the event handler', async () => {
    const payload = { typ: 'event', prc: 'test', data: { test: true } } as const
    const handler = jest.fn()
    const reject = jest.fn()

    await expect(
      handleEvent(
        { handlers: { test: handler }, reject } as unknown as HandlerContext<Protocol>,
        clientToken,
      ),
    ).resolves.toBeUndefined()
    expect(handler).toHaveBeenCalledWith({
      message: createUnsignedToken(payload),
      data: { test: true },
    })
    expect(reject).not.toHaveBeenCalled()
  })
})
