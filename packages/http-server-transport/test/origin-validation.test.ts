import { describe, expect, test } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('origin validation (H-10)', () => {
  test('reflects valid origin in wildcard mode', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com')
  })

  test('rejects origin with invalid URL format in wildcard mode', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'OPTIONS',
        headers: { origin: 'not-a-valid-url' },
      }),
    )
    expect(res.status).toBe(403)
  })

  test('returns literal * when no origin header is sent in wildcard mode', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(new Request('http://localhost/', { method: 'OPTIONS' }))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  test('rejects origin with javascript: scheme', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'OPTIONS',
        headers: { origin: 'javascript:alert(1)' },
      }),
    )
    expect(res.status).toBe(403)
  })

  test('accepts origin with http scheme', async () => {
    const bridge = createServerBridge()
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
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.example.com' },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
  })

  test('still validates format even for explicitly allowed origins', async () => {
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
