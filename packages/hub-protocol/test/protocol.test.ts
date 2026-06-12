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
      'hub/group/send',
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

  test('channel procedure has param, send, and receive', () => {
    const def = hubProtocol['hub/receive']
    expect(def.type).toBe('channel')
    expect('param' in def).toBe(true)
    expect('send' in def).toBe(true)
    expect('receive' in def).toBe(true)
  })

  test('defines exactly 7 procedures', () => {
    expect(Object.keys(hubProtocol)).toHaveLength(7)
  })

  test('schema quotas bound list and string sizes', () => {
    const sendParam = hubProtocol['hub/send'].param
    expect(sendParam.properties.recipients.maxItems).toBe(100)
    expect(sendParam.properties.recipients.items.maxLength).toBe(256)
    expect(sendParam.properties.payload.maxLength).toBe(1048576)

    const groupSendParam = hubProtocol['hub/group/send'].param
    expect(groupSendParam.properties.groupID.maxLength).toBe(128)
    expect(groupSendParam.properties.payload.maxLength).toBe(1048576)

    const receiveParam = hubProtocol['hub/receive'].param
    expect(receiveParam.properties.after.maxLength).toBe(64)
    expect(receiveParam.properties.groupIDs.maxItems).toBe(100)
    expect(receiveParam.properties.groupIDs.items.maxLength).toBe(128)
    const receiveSend = hubProtocol['hub/receive'].send
    expect(receiveSend.properties.ack.maxItems).toBe(1000)
    expect(receiveSend.properties.ack.items.maxLength).toBe(64)

    const uploadParam = hubProtocol['hub/keypackage/upload'].param
    expect(uploadParam.properties.keyPackages.maxItems).toBe(50)
    expect(uploadParam.properties.keyPackages.items.maxLength).toBe(16384)

    const fetchParam = hubProtocol['hub/keypackage/fetch'].param
    expect(fetchParam.properties.did.maxLength).toBe(256)
    expect(fetchParam.properties.count.minimum).toBe(1)
    expect(fetchParam.properties.count.maximum).toBe(10)

    const joinParam = hubProtocol['hub/group/join'].param
    expect(joinParam.properties.groupID.maxLength).toBe(128)
    expect(joinParam.properties.credential.maxLength).toBe(16384)
    expect(joinParam.properties.delegationChain.maxItems).toBe(10)

    const leaveParam = hubProtocol['hub/group/leave'].param
    expect(leaveParam.properties.groupID.maxLength).toBe(128)
  })
})
