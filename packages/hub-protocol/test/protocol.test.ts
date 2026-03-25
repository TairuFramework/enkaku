import { describe, expect, test } from 'vitest'

import { type HubProtocol, hubProtocol } from '../src/protocol.js'

describe('HubProtocol', () => {
  test('handler types are assignable from protocol', () => {
    const check: HubProtocol extends Record<string, unknown> ? true : false = true
    expect(check).toBe(true)
  })

  test('all procedures have valid type field', () => {
    const validTypes = new Set(['event', 'request', 'stream', 'channel'])
    for (const [name, def] of Object.entries(hubProtocol)) {
      expect(validTypes.has(def.type), `${name} has invalid type: ${def.type}`).toBe(true)
    }
  })

  test('request procedures have param and result', () => {
    const requestProcedures = [
      'hub/send',
      'hub/keypackage/upload',
      'hub/keypackage/fetch',
      'hub/group/join',
      'hub/group/leave',
    ]
    for (const name of requestProcedures) {
      const def = hubProtocol[name as keyof typeof hubProtocol]
      expect(def.type, `${name} should be request`).toBe('request')
      expect('param' in def, `${name} should have param`).toBe(true)
      expect('result' in def, `${name} should have result`).toBe(true)
    }
  })

  test('stream procedure has param and receive', () => {
    const def = hubProtocol['hub/receive']
    expect(def.type).toBe('stream')
    expect('param' in def).toBe(true)
    expect('receive' in def).toBe(true)
  })

  test('channel procedure has param, send, and receive', () => {
    const def = hubProtocol['hub/tunnel/request']
    expect(def.type).toBe('channel')
    expect('param' in def).toBe(true)
    expect('send' in def).toBe(true)
    expect('receive' in def).toBe(true)
  })

  test('defines exactly 7 procedures', () => {
    expect(Object.keys(hubProtocol)).toHaveLength(7)
  })
})
