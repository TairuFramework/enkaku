import { describe, expect, test } from 'vitest'

import { hubProtocol } from '../src/protocol.js'

describe('hubProtocol', () => {
  test('defines the pub/sub + bootstrap procedures', () => {
    expect(Object.keys(hubProtocol).sort()).toEqual(
      [
        'hub/keypackage/fetch',
        'hub/keypackage/upload',
        'hub/publish',
        'hub/receive',
        'hub/subscribe',
        'hub/unsubscribe',
      ].sort(),
    )
  })

  test('removes the legacy group/recipients procedures', () => {
    expect(hubProtocol).not.toHaveProperty('hub/send')
    expect(hubProtocol).not.toHaveProperty('hub/group/send')
    expect(hubProtocol).not.toHaveProperty('hub/group/join')
    expect(hubProtocol).not.toHaveProperty('hub/group/leave')
  })

  test('hub/publish is a request keyed by topicID', () => {
    const publish = hubProtocol['hub/publish']
    expect(publish.type).toBe('request')
    expect(publish.param.required).toEqual(['topicID', 'payload'])
  })

  test('hub/subscribe and hub/unsubscribe are topicID requests', () => {
    expect(hubProtocol['hub/subscribe'].type).toBe('request')
    expect(hubProtocol['hub/subscribe'].param.required).toEqual(['topicID'])
    expect(hubProtocol['hub/unsubscribe'].type).toBe('request')
    expect(hubProtocol['hub/unsubscribe'].param.required).toEqual(['topicID'])
  })

  test('hub/receive carries topicID and not groupID', () => {
    const receive = hubProtocol['hub/receive']
    expect(receive.type).toBe('channel')
    expect(receive.receive.required).toEqual(['sequenceID', 'senderDID', 'topicID', 'payload'])
    expect(receive.receive.properties).not.toHaveProperty('groupID')
    expect(receive.param.properties).not.toHaveProperty('groupIDs')
  })
})
