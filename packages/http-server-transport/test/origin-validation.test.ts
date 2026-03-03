import { describe, expect, test } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('origin validation', () => {
  describe('default (same-origin only)', () => {
    test('allows requests without origin header', async () => {
      const bridge = createServerBridge()
      const res = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'OPTIONS' }),
      )
      expect(res.status).toBe(204)
    })

    test('rejects requests with origin header', async () => {
      const bridge = createServerBridge()
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'https://example.com' },
        }),
      )
      expect(res.status).toBe(403)
    })
  })

  describe('explicit wildcard mode', () => {
    test('reflects valid origin', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'https://example.com' },
        }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com')
    })

    test('rejects origin with invalid URL format', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'not-a-valid-url' },
        }),
      )
      expect(res.status).toBe(403)
    })

    test('returns literal * when no origin header is sent', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'OPTIONS' }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
    })

    test('rejects origin with javascript: scheme', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'javascript:alert(1)' },
        }),
      )
      expect(res.status).toBe(403)
    })

    test('accepts origin with http scheme', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'http://localhost:3000' },
        }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })

    test('accepts origin with https scheme', async () => {
      const bridge = createServerBridge({ allowedOrigin: '*' })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'https://app.example.com' },
        }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    })
  })

  describe('explicit origin list', () => {
    test('validates allowed origin', async () => {
      const bridge = createServerBridge({ allowedOrigin: ['https://example.com'] })
      const res = await bridge.handleRequest(
        new Request('http://localhost/', {
          method: 'OPTIONS',
          headers: { origin: 'https://example.com' },
        }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com')
    })
  })
})
