import { createValidator, isType } from '@enkaku/schema'
import { createUnsignedToken } from '@enkaku/token'

import {
  type CommandsRecordProtocol,
  createClientMessageSchema,
  createServerMessageSchema,
} from '../src'

const protocol = {
  'test/event': {
    type: 'event',
    data: { type: 'object', properties: { foo: { type: 'string' } }, additionalProperties: false },
  },
  'test/request': {
    type: 'request',
    result: { type: 'string' },
  },
  'test/stream': {
    type: 'stream',
    params: { type: 'number' },
    receive: { type: 'number' },
  },
  'test/channel': {
    type: 'channel',
    params: { type: 'number' },
    send: { type: 'string' },
    receive: { type: 'number' },
  },
} satisfies CommandsRecordProtocol<string>

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
      cmd: 'test/event',
      data: { foo: 'bar' },
    })
    expect(isType(validator, validEvent)).toBe(true)

    const invalidEvent = createUnsignedToken({
      typ: 'event',
      cmd: 'test/event',
      data: { foo: 'bar', invalid: true },
    })
    expect(isType(validator, invalidEvent)).toBe(false)

    const validRequest = createUnsignedToken({
      typ: 'request',
      cmd: 'test/request',
      rid: '1',
    })
    expect(isType(validator, validRequest)).toBe(true)

    const invalidRequest = createUnsignedToken({
      typ: 'request',
      cmd: 'test/request',
      rid: '1',
      prm: true,
    })
    expect(isType(validator, invalidRequest)).toBe(false)

    const validStream = createUnsignedToken({
      typ: 'stream',
      cmd: 'test/stream',
      rid: '1',
      prm: 1,
    })
    expect(isType(validator, validStream)).toBe(true)

    const invalidStream = createUnsignedToken({
      typ: 'stream',
      cmd: 'test/other',
      rid: '1',
    })
    expect(isType(validator, invalidStream)).toBe(false)

    const validSend = createUnsignedToken({ typ: 'send', rid: '1', val: '1' })
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
