import { EventEmitter } from '@enkaku/event'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { vi } from 'vitest'

import { handleEvent } from '../src/handlers/event.js'
import type { HandlerContext, ServerEvents } from '../src/types.js'

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
    // @ts-expect-error type instantiation too deep
    const returned = handleEvent({ handlers: {} } as unknown as HandlerContext<Protocol>, {
      // @ts-expect-error
      payload,
    })
    expect(returned).toBeInstanceOf(Error)
    expect((returned as Error).message).toBe('No handler for procedure: unknown')
  })

  test('sends an ErrorRejection if the handler fails but resolves the returned promise', async () => {
    const errorCause = new Error('Failed!')
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      throw errorCause
    })
    const handlerError = events.once('handlerError')

    // Handler promise should always resolve
    await expect(
      handleEvent(
        // @ts-expect-error type instantiation too deep
        { events, handlers: { test: handler } } as unknown as HandlerContext<Protocol>,
        clientToken,
      ),
    ).resolves.toBeUndefined()

    // Handler failure should emit an handlerError
    const emittedError = await handlerError
    expect(emittedError.error.message).toBe('Error handling procedure: test')
    expect(emittedError.error.cause).toBe(errorCause)
    expect(emittedError.payload).toEqual(clientToken.payload)
  })

  test('successfully calls the event handler', async () => {
    const payload = { typ: 'event', prc: 'test', data: { test: true } } as const
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn()
    const handlerErrorListener = vi.fn()
    events.once('handlerError', handlerErrorListener)

    await expect(
      handleEvent(
        // @ts-expect-error type instantiation too deep
        { events, handlers: { test: handler } } as unknown as HandlerContext<Protocol>,
        clientToken,
      ),
    ).resolves.toBeUndefined()
    expect(handler).toHaveBeenCalledWith({
      message: createUnsignedToken(payload),
      data: { test: true },
    })
    expect(handlerErrorListener).not.toHaveBeenCalled()
  })
})
