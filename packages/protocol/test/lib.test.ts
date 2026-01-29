import { createValidator, isType } from '@enkaku/schema'
import { createUnsignedToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

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

describe('H-06: additional properties rejection', () => {
  test('rejects client payload with extra fields', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h06' })

    const abortWithExtra = createUnsignedToken({ typ: 'abort', rid: '1', extra: 'field' })
    expect(isType(validator, abortWithExtra)).toBe(false)

    const requestWithExtra = createUnsignedToken({
      typ: 'request',
      prc: 'test/request',
      rid: '1',
      extra: 'field',
    })
    expect(isType(validator, requestWithExtra)).toBe(false)

    const eventWithExtra = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { foo: 'bar' },
      extra: 'field',
    })
    expect(isType(validator, eventWithExtra)).toBe(false)

    const sendWithExtra = createUnsignedToken({
      typ: 'send',
      prc: 'test/channel',
      rid: '1',
      val: '1',
      extra: 'field',
    })
    expect(isType(validator, sendWithExtra)).toBe(false)
  })

  test('rejects server payload with extra fields', () => {
    const schema = createServerMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'server-h06' })

    const resultWithExtra = createUnsignedToken({
      typ: 'result',
      rid: '1',
      val: 'test',
      extra: 'field',
    })
    expect(isType(validator, resultWithExtra)).toBe(false)

    const receiveWithExtra = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: 1,
      extra: 'field',
    })
    expect(isType(validator, receiveWithExtra)).toBe(false)

    const errorWithExtra = createUnsignedToken({
      typ: 'error',
      rid: '1',
      code: 'ERR',
      msg: 'test',
      extra: 'field',
    })
    expect(isType(validator, errorWithExtra)).toBe(false)
  })

  test('rejects unsigned message wrapper with extra fields', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'wrapper-h06' })

    const token = createUnsignedToken({ typ: 'abort', rid: '1' })
    const withExtra = { ...token, extraField: 'value' }
    expect(isType(validator, withExtra)).toBe(false)
  })

  test('still accepts valid messages without extra fields', () => {
    const clientSchema = createClientMessageSchema(protocol)
    const clientValidator = createValidator({ ...clientSchema, $id: 'client-h06-valid' })

    expect(isType(clientValidator, createUnsignedToken({ typ: 'abort', rid: '1' }))).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'request', prc: 'test/request', rid: '1' }),
      ),
    ).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'event', prc: 'test/event', data: { foo: 'bar' } }),
      ),
    ).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'send', prc: 'test/channel', rid: '1', val: '1' }),
      ),
    ).toBe(true)

    const serverSchema = createServerMessageSchema(protocol)
    const serverValidator = createValidator({ ...serverSchema, $id: 'server-h06-valid' })

    expect(
      isType(serverValidator, createUnsignedToken({ typ: 'result', rid: '1', val: 'test' })),
    ).toBe(true)
    expect(
      isType(serverValidator, createUnsignedToken({ typ: 'receive', rid: '1', val: 1 })),
    ).toBe(true)
    expect(
      isType(
        serverValidator,
        createUnsignedToken({ typ: 'error', rid: '1', code: 'ERR', msg: 'test' }),
      ),
    ).toBe(true)
  })

  test('accepts messages with optional jti field', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h06-jti' })

    const abortWithJti = createUnsignedToken({ typ: 'abort', rid: '1', jti: 'abc-123' })
    expect(isType(validator, abortWithJti)).toBe(true)
  })
})
