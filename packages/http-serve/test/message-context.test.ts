import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

function createPost(typ: string, rid: string, sessionID?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (sessionID != null) headers.set('enkaku-session-id', sessionID)
  return new Request('http://localhost/rpc', {
    method: 'POST',
    headers,
    body: JSON.stringify(createUnsignedToken({ payload: { typ, rid, prc: 'test/procedure' } })),
  })
}

describe('HTTP message context', () => {
  test('unary request message has request context', async () => {
    const bridge = createServerBridge()
    const reader = bridge.stream.readable.getReader()
    const request = createPost('request', 'r1')
    const response = bridge.handleRequest(request)
    try {
      const { value: message } = await reader.read()
      const context = bridge.getMessageContext(message)
      expect(context?.request).toBe(request)
      expect(context?.request.url).toBe(request.url)
      expect(context?.sessionID).toBeUndefined()
    } finally {
      bridge.dispose()
      reader.releaseLock()
      await response
    }
  })

  test.each(['stream', 'channel'])('%s message context carries new sessionID', async (typ) => {
    const bridge = createServerBridge()
    const reader = bridge.stream.readable.getReader()
    const request = createPost(typ, 'r1')
    try {
      const response = await bridge.handleRequest(request)
      const sessionID = response.headers.get('enkaku-session-id')
      expect(sessionID).toBeTruthy()
      const { value: message } = await reader.read()
      expect(bridge.getMessageContext(message)).toEqual({ request, sessionID })
    } finally {
      bridge.dispose()
      reader.releaseLock()
    }
  })

  test.each(['send', 'abort', 'stream', 'channel'])(
    '%s on existing session carries that sessionID',
    async (typ) => {
      const bridge = createServerBridge()
      const reader = bridge.stream.readable.getReader()
      try {
        const response = await bridge.handleRequest(createPost('channel', 'r1'))
        const sessionID = response.headers.get('enkaku-session-id') as string
        expect(sessionID).toBeTruthy()
        await reader.read()
        const request = createPost(typ, 'r2', sessionID)
        expect((await bridge.handleRequest(request)).status).toBe(204)
        const { value: message } = await reader.read()
        expect(bridge.getMessageContext(message)).toEqual({ request, sessionID })
      } finally {
        bridge.dispose()
        reader.releaseLock()
      }
    },
  )

  test.each(['event', 'send', 'abort'])('%s without session has request context', async (typ) => {
    const bridge = createServerBridge()
    const reader = bridge.stream.readable.getReader()
    const request = createPost(typ, 'r1')
    try {
      expect((await bridge.handleRequest(request)).status).toBe(204)
      const { value: message } = await reader.read()
      expect(bridge.getMessageContext(message)).toEqual({ request })
    } finally {
      bridge.dispose()
      reader.releaseLock()
    }
  })

  test('unknown object returns undefined', () => {
    const bridge = createServerBridge()
    try {
      expect(bridge.getMessageContext({})).toBeUndefined()
    } finally {
      bridge.dispose()
    }
  })

  test('context map is weak', async () => {
    const bridge = createServerBridge()
    const reader = bridge.stream.readable.getReader()
    try {
      const request = createPost('event', 'r1')
      await bridge.handleRequest(request)
      const { value: message } = await reader.read()
      expect(bridge.getMessageContext(message)?.request).toBe(request)
      expect(bridge.getMessageContext(structuredClone(message))).toBeUndefined()
      expect(bridge.getMessageContext({})).toBeUndefined()
    } finally {
      bridge.dispose()
      reader.releaseLock()
    }
  })

  test.each([null, undefined, 'message', 42])('non-object %s returns undefined', (message) => {
    const bridge = createServerBridge()
    try {
      expect(bridge.getMessageContext(message)).toBeUndefined()
    } finally {
      bridge.dispose()
    }
  })

  test('ServerTransport exposes context for the server-side message', async () => {
    const transport = new ServerTransport()
    try {
      const request = createPost('event', 'r1')
      await transport.fetch(request)
      const { value: message } = await transport.read()
      expect(transport.getMessageContext(message)).toEqual({ request })
      expect(transport.getMessageContext({})).toBeUndefined()
    } finally {
      await transport.dispose()
    }
  })
})
