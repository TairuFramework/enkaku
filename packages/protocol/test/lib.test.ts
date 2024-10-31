import { createUnsignedToken } from '@enkaku/jwt'
import { createSchemaType } from '@enkaku/schema'

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
    const type = createSchemaType({ ...schema, $id: 'client' })

    const validAbort = createUnsignedToken({ typ: 'abort', rid: '1' })
    expect(type.is(validAbort)).toBe(true)

    const invalidAbort = createUnsignedToken({ typ: 'abort' })
    expect(type.is(invalidAbort)).toBe(false)

    const validEvent = createUnsignedToken({
      typ: 'event',
      cmd: 'test/event',
      data: { foo: 'bar' },
    })
    expect(type.is(validEvent)).toBe(true)

    const invalidEvent = createUnsignedToken({
      typ: 'event',
      cmd: 'test/event',
      data: { foo: 'bar', invalid: true },
    })
    expect(type.is(invalidEvent)).toBe(false)

    const validRequest = createUnsignedToken({
      typ: 'request',
      cmd: 'test/request',
      rid: '1',
    })
    expect(type.is(validRequest)).toBe(true)

    const invalidRequest = createUnsignedToken({
      typ: 'request',
      cmd: 'test/request',
      rid: '1',
      prm: true,
    })
    expect(type.is(invalidRequest)).toBe(false)

    const validStream = createUnsignedToken({
      typ: 'stream',
      cmd: 'test/stream',
      rid: '1',
      prm: 1,
    })
    expect(type.is(validStream)).toBe(true)

    const invalidStream = createUnsignedToken({
      typ: 'stream',
      cmd: 'test/other',
      rid: '1',
    })
    expect(type.is(invalidStream)).toBe(false)

    const validSend = createUnsignedToken({ typ: 'send', rid: '1', val: '1' })
    expect(type.is(validSend)).toBe(true)

    const invalidSend = createUnsignedToken({ typ: 'send', val: '1' })
    expect(type.is(invalidSend)).toBe(false)
  })

  test('createServerMessageSchema()', () => {
    const schema = createServerMessageSchema(protocol)
    // console.log('schema', JSON.stringify(schema, null, 2))
    const type = createSchemaType({ ...schema, $id: 'server' })

    const validResult = createUnsignedToken({
      typ: 'result',
      rid: '1',
      val: 'test',
    })
    expect(type.is(validResult)).toBe(true)

    const invalidResult = createUnsignedToken({ typ: 'result', val: 'test' })
    expect(type.is(invalidResult)).toBe(false)

    const validReceive = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: 1,
    })
    expect(type.is(validReceive)).toBe(true)

    const invalidReceive = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: { test: true },
    })
    expect(type.is(invalidReceive)).toBe(false)
  })
})
