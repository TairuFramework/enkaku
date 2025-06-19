import { createValidator, isType } from '@enkaku/schema'
import { createUnsignedToken } from '@enkaku/token'

import {
  createClientMessageSchema,
  createServerMessageSchema,
  type ProtocolDefinition,
} from '../src'

const protocol = {
  'test/event': {
    type: 'event',
    data: { type: 'object', properties: { foo: { type: 'string' } }, additionalProperties: false },
  },
  'test/request': {
    type: 'request',
    result: { type: 'string' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', const: 'TEST' },
        message: { type: 'string' },
      },
      required: ['code', 'message'],
      additionalProperties: false,
    },
  },
  'test/stream': {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' },
  },
  'test/channel': {
    type: 'channel',
    param: { type: 'number' },
    send: { type: 'string' },
    receive: { type: 'number' },
  },
} as const satisfies ProtocolDefinition

describe('protocol messages validation', () => {
  test('createClientMessageSchema()', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client' })

    const validAbort = createUnsignedToken({ typ: 'abort', rid: '1' })
    expect(isType(validator, validAbort)).toBe(true)

    const invalidAbort = createUnsignedToken({ typ: 'abort' })
    expect(isType(validator, invalidAbort)).toBe(false)

    const validEvent = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { foo: 'bar' },
    })
    expect(isType(validator, validEvent)).toBe(true)

    const invalidEvent = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { foo: 'bar', invalid: true },
    })
    expect(isType(validator, invalidEvent)).toBe(false)

    const validRequest = createUnsignedToken({
      typ: 'request',
      prc: 'test/request',
      rid: '1',
    })
    expect(isType(validator, validRequest)).toBe(true)

    const invalidRequest = createUnsignedToken({
      typ: 'request',
      prc: 'test/request',
    })
    expect(isType(validator, invalidRequest)).toBe(false)

    const validStream = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: '1',
      prm: 1,
    })
    expect(isType(validator, validStream)).toBe(true)

    const invalidStream = createUnsignedToken({
      typ: 'stream',
      prc: 'test/other',
      rid: '1',
    })
    expect(isType(validator, invalidStream)).toBe(false)

    const validSend = createUnsignedToken({ typ: 'send', prc: 'test/channel', rid: '1', val: '1' })
    expect(isType(validator, validSend)).toBe(true)

    const invalidSend = createUnsignedToken({ typ: 'send', val: '1' })
    expect(isType(validator, invalidSend)).toBe(false)
  })

  test('createServerMessageSchema()', () => {
    const schema = createServerMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'server' })

    const validResult = createUnsignedToken({
      typ: 'result',
      rid: '1',
      val: 'test',
    })
    expect(isType(validator, validResult)).toBe(true)

    const invalidResult = createUnsignedToken({ typ: 'result', val: 'test' })
    expect(isType(validator, invalidResult)).toBe(false)

    const validReceive = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: 1,
    })
    expect(isType(validator, validReceive)).toBe(true)

    const invalidReceive = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: { test: true },
    })
    expect(isType(validator, invalidReceive)).toBe(false)
  })
})
