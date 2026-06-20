import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { adaptBusHandlers } from '../src/handlers.js'

const protocol = {
  'app/changed': { type: 'event' },
  'app/echo': { type: 'request' },
  'app/fetch': { type: 'request' },
  'app/sub': { type: 'stream', receive: { type: 'object' } },
} as const satisfies ProtocolDefinition

describe('adaptBusHandlers', () => {
  test('maps event procedures to handlers receiving data and sender at message.iss', async () => {
    const seen: Array<{ data: unknown; iss: unknown }> = []
    const handlers = {
      'app/changed': (ctx: { data: unknown; message: { payload: { iss?: string } } }) =>
        void seen.push({ data: ctx.data, iss: ctx.message.payload.iss }),
      'app/echo': () => ({}),
    }
    const { eventHandlers } = adaptBusHandlers(protocol, handlers)
    expect(Object.keys(eventHandlers)).toEqual(['app/changed'])
    await eventHandlers['app/changed']({ v: 1 }, 'did:key:alice')
    expect(seen).toEqual([{ data: { v: 1 }, iss: 'did:key:alice' }])
  })

  test('maps request procedures to anycast handlers with param + sender', async () => {
    const handlers = {
      'app/echo': (ctx: { param: unknown; message: { payload: { iss?: string } } }) => ({
        echoed: ctx.param,
        from: ctx.message.payload.iss,
      }),
      'app/fetch': (ctx: { param: unknown }) => ({ got: ctx.param }),
    }
    const { requestHandlers } = adaptBusHandlers(protocol, handlers)
    expect(Object.keys(requestHandlers).sort()).toEqual(['app/echo', 'app/fetch'])
    expect(await requestHandlers['app/echo']({ a: 1 }, { senderDID: 'did:key:bob' })).toEqual({
      echoed: { a: 1 },
      from: 'did:key:bob',
    })
  })

  test('omits stream/channel and procedures without a handler', () => {
    const handlers = { 'app/changed': () => {} }
    const { eventHandlers, requestHandlers } = adaptBusHandlers(protocol, handlers)
    expect(Object.keys(eventHandlers)).toEqual(['app/changed'])
    expect(Object.keys(requestHandlers)).toEqual([])
  })

  test('request handlers are tagged suppressible', () => {
    const handlers = { 'app/echo': () => ({}) }
    const { requestHandlers } = adaptBusHandlers(protocol, handlers, { jitterMs: 10 })
    expect((requestHandlers['app/echo'] as { suppress?: unknown }).suppress).toEqual({
      jitterMs: 10,
    })
  })
})
