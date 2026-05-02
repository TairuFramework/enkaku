import { describe, expect, test } from 'vitest'
import { FrameDecodeError } from '../src/errors.js'
import { decodeFrame, encodeFrame, HUB_FRAME_VERSION, type HubFrame } from '../src/frame.js'

const SESSION = 'session-x'

const sampleEnkakuMessage = {
  header: { typ: 'unsigned' as const, alg: 'none' as const },
  payload: { typ: 'request' as const, prc: 'echo', rid: 'rid-1', prm: { hello: 'world' } },
}

describe('HubFrame round-trip', () => {
  test('encodes and decodes a message frame', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'message',
      body: sampleEnkakuMessage,
    }
    const bytes = encodeFrame(frame)
    expect(decodeFrame(bytes)).toEqual(frame)
  })

  test('encodes and decodes a session-end frame without reason', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'session-end',
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })

  test('encodes and decodes a session-end frame with reason', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'session-end',
      reason: 'idle-timeout',
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })

  test('round-trips correlationID on a message frame', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 7,
      correlationID: 'cid-42',
      kind: 'message',
      body: sampleEnkakuMessage,
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })

  test('round-trips correlationID on a session-end frame', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 7,
      correlationID: 'cid-42',
      kind: 'session-end',
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })
})

describe('HubFrame validation rejects', () => {
  test('message frame without body', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, sessionID: SESSION, seq: 0, kind: 'message' }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('session-end frame with body', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'session-end',
        body: sampleEnkakuMessage,
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('unknown kind', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, sessionID: SESSION, seq: 0, kind: 'rpc-req', body: {} }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('malformed body envelope', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'message',
        body: { not: 'an enkaku message' },
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('non-JSON bytes', () => {
    expect(() => decodeFrame(new Uint8Array([0xff, 0xff, 0xff]))).toThrow(FrameDecodeError)
  })

  test('frame with extra top-level property', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'message',
        body: sampleEnkakuMessage,
        extra: 'nope',
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('message body envelope with extra top-level property', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'message',
        body: { ...sampleEnkakuMessage, mystery: 'no' },
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('non-integer seq', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 1.5,
        kind: 'message',
        body: sampleEnkakuMessage,
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })
})

describe('HubFrame constants', () => {
  test('exposes HUB_FRAME_VERSION', () => {
    expect(HUB_FRAME_VERSION).toBe(1)
  })
})
