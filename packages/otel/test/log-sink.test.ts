import { describe, expect, test } from 'vitest'

import { createOTelLogSink } from '../src/log-sink.js'

describe('createOTelLogSink', () => {
  test('returns a function (Sink type)', () => {
    const sink = createOTelLogSink()
    expect(typeof sink).toBe('function')
  })

  test('accepts a log record without throwing', () => {
    const sink = createOTelLogSink()
    expect(() =>
      sink({
        category: ['enkaku', 'server'],
        level: 'info',
        message: ['server started'],
        rawMessage: 'server started',
        properties: { serverID: 'test-id' },
        timestamp: Date.now(),
      }),
    ).not.toThrow()
  })
})
