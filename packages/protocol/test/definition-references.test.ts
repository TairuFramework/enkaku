import { createUnsignedToken, randomIdentity } from '@kokuin/token'
import { createValidator, isType } from '@sozai/schema'
import { describe, expect, test } from 'vitest'

import {
  createClientMessageSchema,
  createServerMessageSchema,
  type ProtocolDefinition,
} from '../src/index.js'

// Procedure schemas with root-local definitions are embedded inside message envelopes.
// Their `#/definitions/...` and `#/$defs/...` references must keep resolving once nested.
const jsonDefinitions = {
  json: {
    anyOf: [
      { type: 'null' },
      { type: 'boolean' },
      { type: 'number' },
      { type: 'string' },
      { type: 'array', items: { $ref: '#/definitions/json' } },
      { type: 'object', additionalProperties: { $ref: '#/definitions/json' } },
    ],
  },
} as const

const recursiveParam = {
  type: 'object',
  properties: { value: { $ref: '#/definitions/json' } },
  required: ['value'],
  additionalProperties: false,
  definitions: jsonDefinitions,
} as const

const recursiveResult = {
  type: 'object',
  properties: { tree: { $ref: '#/$defs/node' } },
  required: ['tree'],
  additionalProperties: false,
  $defs: {
    node: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        children: { type: 'array', items: { $ref: '#/$defs/node' } },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
} as const

const protocol = {
  'flow/run': {
    type: 'request',
    param: recursiveParam,
    result: recursiveResult,
  },
  'flow/watch': {
    type: 'stream',
    param: recursiveParam,
    receive: recursiveResult,
  },
} as const satisfies ProtocolDefinition

const nestedValue = { a: [1, 'two', { b: [null, true, { c: [] }] }] }
const tree = { name: 'root', children: [{ name: 'a', children: [{ name: 'b' }] }] }

describe('definition references in message schemas', () => {
  test('client schema validates recursive unsigned payloads', () => {
    const validator = createValidator(createClientMessageSchema(protocol, 'unsigned'))
    const valid = createUnsignedToken({
      typ: 'request',
      prc: 'flow/run',
      rid: '1',
      prm: { value: nestedValue },
    })
    expect(isType(validator, valid)).toBe(true)

    const invalid = createUnsignedToken({
      typ: 'request',
      prc: 'flow/run',
      rid: '1',
      prm: { value: { a: [undefined, () => {}] } },
    })
    expect(isType(validator, invalid)).toBe(false)
  })

  test('client schema validates recursive signed payloads', async () => {
    const validator = createValidator(createClientMessageSchema(protocol, 'signed'))
    const identity = randomIdentity()
    const valid = await identity.signToken({
      typ: 'stream',
      prc: 'flow/watch',
      rid: '1',
      prm: { value: nestedValue },
    })
    expect(isType(validator, valid)).toBe(true)

    const invalid = await identity.signToken({
      typ: 'stream',
      prc: 'flow/watch',
      rid: '1',
      prm: { value: { a: [Symbol.for('x')] } },
    })
    expect(isType(validator, invalid)).toBe(false)
  })

  test('client schema accepts both envelope types by default', async () => {
    const validator = createValidator(createClientMessageSchema(protocol))
    const payload = { typ: 'request', prc: 'flow/run', rid: '1', prm: { value: nestedValue } }
    expect(isType(validator, createUnsignedToken(payload))).toBe(true)
    expect(isType(validator, await randomIdentity().signToken(payload))).toBe(true)
  })

  test('server schema validates recursive results and receive values', async () => {
    const validator = createValidator(createServerMessageSchema(protocol))
    expect(isType(validator, createUnsignedToken({ typ: 'result', rid: '1', val: { tree } }))).toBe(
      true,
    )
    expect(
      isType(
        validator,
        await randomIdentity().signToken({ typ: 'receive', rid: '1', val: { tree } }),
      ),
    ).toBe(true)
    expect(
      isType(
        validator,
        createUnsignedToken({ typ: 'result', rid: '1', val: { tree: { children: [] } } }),
      ),
    ).toBe(false)
  })

  test('validator can be compiled with a root $id', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-with-id' })
    const valid = createUnsignedToken({
      typ: 'request',
      prc: 'flow/run',
      rid: '1',
      prm: { value: nestedValue },
    })
    expect(isType(validator, valid)).toBe(true)
  })

  test('validates payloads using pointer-escaped definition names', () => {
    const escapedProtocol = {
      'escaped/event': {
        type: 'event',
        data: {
          type: 'object',
          properties: { value: { $ref: '#/definitions/a~1b~0c' } },
          required: ['value'],
          definitions: { 'a/b~c': { type: 'string' } },
        },
      },
    } as const satisfies ProtocolDefinition
    const validator = createValidator(createClientMessageSchema(escapedProtocol, 'unsigned'))
    const event = (value: unknown) =>
      createUnsignedToken({ typ: 'event', prc: 'escaped/event', data: { value } })
    expect(isType(validator, event('x'))).toBe(true)
    expect(isType(validator, event(1))).toBe(false)
  })

  test('validates literal $ref data with a const schema', () => {
    const literalProtocol = {
      'literal/event': {
        type: 'event',
        data: {
          type: 'object',
          properties: { ref: { const: { $ref: '#/definitions/json' } } },
          required: ['ref'],
          definitions: jsonDefinitions,
        },
      },
    } as const satisfies ProtocolDefinition
    const validator = createValidator(createClientMessageSchema(literalProtocol, 'unsigned'))
    expect(
      isType(
        validator,
        createUnsignedToken({
          typ: 'event',
          prc: 'literal/event',
          data: { ref: { $ref: '#/definitions/json' } },
        }),
      ),
    ).toBe(true)
  })
})
