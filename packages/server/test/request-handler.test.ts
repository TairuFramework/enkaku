import type { ProtocolDefinition } from '@enkaku/protocol'

import { handleRequest } from '../src/handlers/request.js'
import { ErrorRejection } from '../src/rejections.js'
import type { HandlerContext } from '../src/types.js'

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

describe('handleRequest()', () => {
  test('synchronously returns an ErrorRejection if the handler is missing', () => {
    const payload = { typ: 'request', rid: '1', prc: 'unknown' }
    // @ts-ignore type instantiation too deep
    const returned = handleRequest(
      { handlers: {} } as unknown as HandlerContext<Protocol>,
      // @ts-expect-error
      { payload },
    )
    expect(returned).toBeInstanceOf(ErrorRejection)
    expect((returned as ErrorRejection).message).toBe('No handler for procedure: unknown')
    expect((returned as ErrorRejection).info).toEqual(payload)
  })
})
