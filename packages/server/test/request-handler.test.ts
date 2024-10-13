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

describe('handleRequest()', () => {
  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const payload = { typ: 'request', rid: '1', cmd: 'unknown' }
    const returned = handleRequest(
      { handlers: {} } as unknown as HandlerContext<Definitions>,
      // @ts-expect-error
      { payload },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for command: unknown')
    expect((returned as ErrorRejection).info).toEqual(payload)
  })
})
