import type { ErrorObject } from '@enkaku/protocol'

import { handleRequest } from '../src/handlers/request.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext } from '../src/types.js'

type Definitions = {
  test: {
    type: 'request'
    params: { test: boolean }
    result: string
    error: ErrorObject
  }
}
type Meta = undefined

describe('handleRequest()', () => {
  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const action = { type: 'request', id: '1', name: 'unknown' }
    const returned = handleRequest(
      { handlers: {} } as unknown as HandlerContext<Definitions, Meta>,
      // @ts-expect-error
      { action },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for action: unknown')
    expect((returned as ErrorRejection).info).toEqual(action)
  })
})
