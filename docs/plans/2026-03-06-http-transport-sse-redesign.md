# HTTP Transport SSE Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace EventSource with fetch + eventsource-parser and switch from GET-based session handshake to POST-based SSE establishment, keeping single multiplexed SSE connection.

**Architecture:** First stream/channel POST returns SSE response with `enkaku-session-id` header. Subsequent stream/channel POSTs include that header and get 204; responses route through the established SSE stream. Non-streaming messages (request, event, abort, send) are unchanged. Client uses `eventsource-parser` callback API for SSE parsing — zero platform dependencies, works on React Native without polyfills.

**Tech Stack:** TypeScript, Vitest, eventsource-parser, pnpm workspaces

**Reference:** `docs/plans/2026-03-06-http-transport-sse-redesign-design.md`

---

### Task 1: Add eventsource-parser dependency

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/http-client-transport/package.json`

**Step 1: Add eventsource-parser to pnpm catalog**

In `pnpm-workspace.yaml`, add to the `catalog:` section (alphabetical order, after `del-cli`):

```yaml
  eventsource-parser: ^3.0.0
```

**Step 2: Add eventsource-parser to http-client-transport dependencies**

In `packages/http-client-transport/package.json`, add to `dependencies`:

```json
"eventsource-parser": "catalog:"
```

Remove from `devDependencies`:

```json
"undici": "catalog:"
```

**Step 3: Install dependencies**

Run: `pnpm install`

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/http-client-transport/package.json pnpm-lock.yaml
git commit -m "Add eventsource-parser dependency, remove undici"
```

---

### Task 2: Server transport — POST-based SSE for stream/channel

**Files:**
- Modify: `packages/http-server-transport/src/index.ts`
- Modify: `packages/http-server-transport/test/lib.test.ts`

**Context:** Currently stream/channel POSTs require a pre-established SSE session via two GETs. The new behavior: if no `enkaku-session-id` header, create a session and return SSE response. If header present, validate session and return 204.

**Step 1: Write failing tests for POST-based SSE session creation**

Add a new `describe` block at the end of `packages/http-server-transport/test/lib.test.ts`:

```ts
describe('POST-based SSE sessions', () => {
  test('first stream POST creates SSE session', async () => {
    const bridge = createServerBridge()

    const streamMsg = { payload: { typ: 'stream', rid: 'r1', prc: 'test/stream' } }
    const response = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(streamMsg),
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('enkaku-session-id')).toBeTruthy()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  test('first channel POST creates SSE session', async () => {
    const bridge = createServerBridge()

    const channelMsg = { payload: { typ: 'channel', rid: 'r1', prc: 'test/channel' } }
    const response = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(channelMsg),
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('enkaku-session-id')).toBeTruthy()
  })

  test('subsequent stream POST with session ID returns 204', async () => {
    const bridge = createServerBridge()

    // First POST — creates session
    const firstMsg = { payload: { typ: 'stream', rid: 'r1', prc: 'test/stream' } }
    const firstResponse = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(firstMsg),
      }),
    )
    const sessionID = firstResponse.headers.get('enkaku-session-id')!

    // Second POST — uses existing session
    const secondMsg = { payload: { typ: 'stream', rid: 'r2', prc: 'test/stream2' } }
    const secondResponse = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'enkaku-session-id': sessionID,
        },
        body: JSON.stringify(secondMsg),
      }),
    )

    expect(secondResponse.status).toBe(204)
  })

  test('stream POST with invalid session ID returns 400', async () => {
    const bridge = createServerBridge()

    const streamMsg = { payload: { typ: 'stream', rid: 'r1', prc: 'test/stream' } }
    const response = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'enkaku-session-id': 'nonexistent',
        },
        body: JSON.stringify(streamMsg),
      }),
    )

    expect(response.status).toBe(400)
  })

  test('routes responses through SSE stream', async () => {
    const bridge = createServerBridge()

    // Create SSE session via stream POST
    const streamMsg = { payload: { typ: 'stream', rid: 'r1', prc: 'test/stream' } }
    const response = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(streamMsg),
      }),
    )

    // Read the client message from bridge readable
    const reader = bridge.stream.readable.getReader()
    const { value: clientMsg } = await reader.read()
    expect(clientMsg).toEqual(streamMsg)
    reader.releaseLock()

    // Write a response to bridge writable (simulates server handler)
    const writer = bridge.stream.writable.getWriter()
    const serverMsg = { payload: { typ: 'result', rid: 'r1', val: 'hello' } }
    await writer.write(serverMsg)
    writer.releaseLock()

    // Read SSE from response body — expect the comment flush + data event
    const sseReader = response.body!.getReader()
    const decoder = new TextDecoder()
    let sseData = ''
    while (true) {
      const { done, value } = await sseReader.read()
      if (done) break
      sseData += decoder.decode(value, { stream: true })
      if (sseData.includes('data:')) break
    }

    const dataMatch = sseData.match(/data: (.+)\n/)
    expect(dataMatch).toBeTruthy()
    expect(JSON.parse(dataMatch![1])).toEqual(serverMsg)
  })

  test('rejects session creation when maxSessions reached', async () => {
    const bridge = createServerBridge({ maxSessions: 1 })

    // First POST — creates session (uses the one slot)
    const firstMsg = { payload: { typ: 'stream', rid: 'r1', prc: 'test/stream' } }
    const firstRes = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(firstMsg),
      }),
    )
    expect(firstRes.status).toBe(200)

    // Second POST without session ID — tries to create new session, should fail
    const secondMsg = { payload: { typ: 'stream', rid: 'r2', prc: 'test/stream2' } }
    const secondRes = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(secondMsg),
      }),
    )
    expect(secondRes.status).toBe(503)
    const body = await secondRes.json()
    expect(body.error).toMatch(/session limit/i)
  })
})
```

Add the `createServerBridge` import at the top of the file (it's already imported in other test files but not in `lib.test.ts`):

```ts
import { createServerBridge, ServerTransport } from '../src/index.js'
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/http-server-transport && pnpm run test:unit`

Expected: New tests FAIL (stream/channel POST currently requires pre-established GET session).

**Step 3: Implement POST-based SSE for stream/channel**

In `packages/http-server-transport/src/index.ts`, replace the `stream`/`channel` case in `handlePostRequest` (current lines 318-326):

```ts
        // Stateful response message
        case 'channel':
        case 'stream': {
          const sid = request.headers.get('enkaku-session-id')
          if (sid != null) {
            // Existing session — validate and route through it
            const session = sessions.get(sid)
            if (session == null) {
              return Response.json({ error: 'Invalid session ID' }, { headers, status: 400 })
            }
            if (session.controller == null) {
              return Response.json({ error: 'Inactive session' }, { headers, status: 400 })
            }
            session.lastAccess = Date.now()
            inflight.set(message.payload.rid, { type: 'stream', sessionID: sid })
            controller.enqueue(message)
            return new Response(null, { headers, status: 204 })
          }

          // No session — create one and return SSE stream
          if (sessions.size >= maxSessions) {
            return Response.json(
              { error: 'Session limit reached' },
              { headers, status: 503 },
            )
          }
          const sessionID = globalThis.crypto.randomUUID()
          const [body, sseController] = createReadable<string>()
          // Send an SSE comment to flush response headers immediately.
          sseController.enqueue(':\n\n')
          sessions.set(sessionID, { controller: sseController, lastAccess: Date.now() })

          request.signal.addEventListener('abort', () => {
            try {
              sseController.close()
            } catch {}
            sessions.delete(sessionID)
          })

          inflight.set(message.payload.rid, { type: 'stream', sessionID })
          controller.enqueue(message)

          return new Response(body.pipeThrough(new TextEncoderStream()), {
            headers: {
              ...headers,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-store',
              'enkaku-session-id': sessionID,
            },
            status: 200,
          })
        }
```

Also remove the `getRequestSessionController` function (lines 153-170) — it's no longer used.

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-server-transport && pnpm run test:unit`

Expected: All new tests PASS. Existing tests may still pass (GET handler still exists).

**Step 5: Commit**

```bash
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/lib.test.ts
git commit -m "Server transport: POST-based SSE for stream/channel"
```

---

### Task 3: Server transport — Remove GET handler, update CORS and tests

**Files:**
- Modify: `packages/http-server-transport/src/index.ts`
- Modify: `packages/http-server-transport/test/lib.test.ts`
- Modify: `packages/http-server-transport/test/session-limits.test.ts`

**Step 1: Remove GET handler and update CORS headers**

In `packages/http-server-transport/src/index.ts`:

1. Delete the entire `handleGetRequest` function.

2. In `getAccessControlHeaders`, update allowed methods and add expose header:

```ts
  function getAccessControlHeaders(origin: string) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, enkaku-session-id',
      'Access-Control-Expose-Headers': 'enkaku-session-id',
      'Access-Control-Max-Age': '86400',
    }
  }
```

3. In `handleRequest`, remove the `case 'GET':` branch and update the default `Allow` header:

```ts
      switch (request.method) {
        case 'OPTIONS':
          response = handleOptionsRequest(request)
          break
        case 'POST':
          response = await handlePostRequest(request)
          break
        default:
          response = Response.json(
            { error: 'Method not allowed' },
            { headers: { Allow: 'POST, OPTIONS' }, status: 405 },
          )
      }
```

**Step 2: Update existing server tests**

In `packages/http-server-transport/test/lib.test.ts`, update the unsupported methods test:

```ts
  test('errors on unsupported methods', async () => {
    const transport = new ServerTransport()
    const res = await transport.fetch(new Request('http://localhost/test', { method: 'HEAD' }))
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST, OPTIONS')
    await expect(res.json()).resolves.toEqual({ error: 'Method not allowed' })
  })
```

Update the CORS tests to expect `'POST, OPTIONS'` instead of `'GET, POST, OPTIONS'`:

- Change all `expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')` to `expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')`
- Add assertions for the new expose header: `expect(res.headers.get('access-control-expose-headers')).toBe('enkaku-session-id')`

**Step 3: Rewrite session-limits tests for POST-based sessions**

Replace the contents of `packages/http-server-transport/test/session-limits.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

function createStreamPost(rid: string, sessionID?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sessionID != null) {
    headers['enkaku-session-id'] = sessionID
  }
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('session limits', () => {
  test('rejects session creation when maxSessions is reached', async () => {
    const bridge = createServerBridge({ maxSessions: 1 })

    // First POST creates session
    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)
    expect(res1.headers.get('enkaku-session-id')).toBeTruthy()

    // Second POST without session ID tries to create new session — rejected
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(503)
    const body = await res2.json()
    expect(body.error).toMatch(/session limit/i)
  })

  test('cleans up expired sessions after sessionTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(createStreamPost('r1'))
      expect(res1.status).toBe(200)

      // Advance past timeout
      vi.advanceTimersByTime(1500)

      // Session should have been cleaned up; new session accepted
      const res2 = await bridge.handleRequest(createStreamPost('r2'))
      expect(res2.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  test('session access via POST refreshes its timeout', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create session
      const res1 = await bridge.handleRequest(createStreamPost('r1'))
      const sessionID = res1.headers.get('enkaku-session-id')!

      // Advance partway (800ms)
      vi.advanceTimersByTime(800)

      // Access session with another stream POST — refreshes timeout
      const res2 = await bridge.handleRequest(createStreamPost('r2', sessionID))
      expect(res2.status).toBe(204)

      // Advance another 800ms (1600ms total, but only 800ms since refresh)
      vi.advanceTimersByTime(800)

      // Should NOT be cleaned up yet — try to create new session, should fail
      const res3 = await bridge.handleRequest(createStreamPost('r3'))
      expect(res3.status).toBe(503)
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults to generous limits', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)
  })
})
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-server-transport && pnpm run test:unit`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/http-server-transport/
git commit -m "Server transport: remove GET handler, update CORS headers"
```

---

### Task 4: Client transport — Replace EventSource with fetch + eventsource-parser

**Files:**
- Modify: `packages/http-client-transport/src/index.ts`
- Modify: `packages/http-client-transport/test/lib.test.ts`

**Context:** Replace EventSource-based SSE with POST-based SSE using `eventsource-parser` callback API. The first stream/channel POST returns SSE with session ID in response header. Subsequent stream/channel POSTs include the session ID.

**Step 1: Rewrite client transport tests**

Replace the contents of `packages/http-client-transport/test/lib.test.ts`:

```ts
import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createTransportStream, ResponseError } from '../src/index.js'

describe('ResponseError', () => {
  test('stores the response object', () => {
    const response = new Response('Not Found', { status: 404, statusText: 'Not Found' })
    const error = new ResponseError(response)
    expect(error.response).toBe(response)
    expect(error.message).toBe('Transport request failed with status 404 (Not Found)')
  })

  test('is an instance of Error', () => {
    const response = new Response('', { status: 500, statusText: 'Internal Server Error' })
    const error = new ResponseError(response)
    expect(error).toBeInstanceOf(Error)
  })
})

// Minimal protocol for testing
const protocol = {
  'test/event': { type: 'event', data: { type: 'string' } },
  'test/request': { type: 'request', result: { type: 'string' } },
  'test/stream': { type: 'stream', result: { type: 'string' } },
  'test/channel': { type: 'channel', data: { type: 'string' }, result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol
type ClientMessage = AnyClientMessageOf<Protocol>

/** Create a mock SSE response with session ID header and optional data events. */
function createSSEResponse(
  sessionID: string,
  events: Array<Record<string, unknown>> = [],
): Response {
  const chunks = [':\n\n']
  for (const event of events) {
    chunks.push(`data: ${JSON.stringify(event)}\n\n`)
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      // Don't close — SSE stream stays open unless events were pre-loaded
      if (events.length > 0) {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'enkaku-session-id': sessionID,
    },
  })
}

describe('createTransportStream()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('sends event messages via POST and handles 204 response', async () => {
    const requests: Array<{ url: string; body: string; headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        url: req.url,
        body: await req.text(),
        headers: Object.fromEntries(req.headers.entries()),
      })
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const eventMsg = {
      payload: { typ: 'event', prc: 'test/event', data: 'hello' },
    } as unknown as ClientMessage
    await writer.write(eventMsg)

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('http://localhost/rpc')
    expect(JSON.parse(requests[0].body)).toEqual(eventMsg)
    expect(requests[0].headers['enkaku-session-id']).toBeUndefined()

    await writer.close()
  })

  test('sends request messages via POST and enqueues JSON response', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'world' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(responsePayload)

    await writer.close()
  })

  test('errors the readable stream when POST returns non-ok response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow(
      'Transport request failed with status 500 (Internal Server Error)',
    )
  })
})

describe('createTransportStream() SSE session handling', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('first stream POST creates SSE session via POST', async () => {
    const requests: Array<{ method: string; headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      const method = req.method
      const headers = Object.fromEntries(req.headers.entries())
      requests.push({ method, headers })

      // First fetch is the SSE-establishing POST
      if (requests.length === 1) {
        return createSSEResponse('session-123')
      }
      // Subsequent fetches are regular POSTs
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r1' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // First fetch should be a POST (not GET)
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('POST')

    await writer.close()
  })

  test('subsequent stream POST includes session ID header', async () => {
    const requests: Array<{ headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({ headers: Object.fromEntries(req.headers.entries()) })

      if (requests.length === 1) {
        return createSSEResponse('session-456')
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()

    // First stream message — establishes SSE
    await writer.write({
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r1' },
    } as unknown as ClientMessage)

    // Second stream message — should include session ID
    await writer.write({
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r2' },
    } as unknown as ClientMessage)

    expect(requests).toHaveLength(2)
    expect(requests[1].headers['enkaku-session-id']).toBe('session-456')

    await writer.close()
  })

  test('channel messages use same SSE session as stream messages', async () => {
    const requests: Array<{ headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({ headers: Object.fromEntries(req.headers.entries()) })

      if (requests.length === 1) {
        return createSSEResponse('session-789')
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()

    // First: channel message — establishes SSE
    await writer.write({
      payload: { typ: 'channel', prc: 'test/channel', rid: 'r1', data: 'init' },
    } as unknown as ClientMessage)

    // Second: stream message — reuses session
    await writer.write({
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r2' },
    } as unknown as ClientMessage)

    expect(requests).toHaveLength(2)
    expect(requests[1].headers['enkaku-session-id']).toBe('session-789')

    await writer.close()
  })
})

describe('createTransportStream() SSE message reception', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('enqueues SSE messages to readable stream', async () => {
    const serverMsg = { payload: { typ: 'result', rid: 'r1', val: 'sse-data' } }

    globalThis.fetch = vi.fn(async () => {
      return createSSEResponse('sse-test', [serverMsg])
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    // Trigger SSE connection by sending a stream message
    const writer = stream.writable.getWriter()
    await writer.write({
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r1' },
    } as unknown as ClientMessage)

    // Wait for SSE processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(serverMsg)

    await writer.close()
  })
})

describe('createTransportStream() SSE disposal', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('aborts SSE fetch on writable close', async () => {
    let abortSignal: AbortSignal | undefined

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      abortSignal = req.signal
      return createSSEResponse('dispose-test')
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    await writer.write({
      payload: { typ: 'stream', prc: 'test/stream', rid: 'r1' },
    } as unknown as ClientMessage)

    expect(abortSignal).toBeDefined()
    expect(abortSignal!.aborted).toBe(false)

    await writer.close()
    expect(abortSignal!.aborted).toBe(true)
  })
})

describe('ClientTransport', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('creates a transport that sends messages via HTTP', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'ok' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const { ClientTransport } = await import('../src/index.js')
    const transport = new ClientTransport<Protocol>({ url: 'http://localhost/rpc' })

    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await transport.write(requestMsg)

    const result = await transport.read()
    expect(result.value).toEqual(responsePayload)

    await transport.dispose()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/http-client-transport && pnpm run test:unit`

Expected: SSE session tests FAIL (code still uses EventSource).

**Step 3: Rewrite client transport implementation**

Replace the contents of `packages/http-client-transport/src/index.ts`:

```ts
/**
 * HTTP transport for Enkaku RPC clients.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/http-client-transport
 * ```
 *
 * @module http-client-transport
 */

import { createParser } from 'eventsource-parser'

import {
  AttributeKeys,
  createTracer,
  formatTraceparent,
  getActiveTraceContext,
  SpanNames,
  SpanStatusCode,
  withSpan,
} from '@enkaku/otel'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ProtocolDefinition,
  TransportMessage,
} from '@enkaku/protocol'
import { createReadable, writeTo } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

const tracer = createTracer('transport.http')

const HEADERS = { accept: 'application/json', 'content-type': 'application/json' }

export class ResponseError extends Error {
  #response: Response

  constructor(response: Response) {
    super(`Transport request failed with status ${response.status} (${response.statusText})`)
    this.#response = response
  }

  get response(): Response {
    return this.#response
  }
}

type SSESessionState =
  | { status: 'idle' }
  | { status: 'connecting'; promise: Promise<string> }
  | { status: 'connected'; sessionID: string }
  | { status: 'error'; error: Error }

export type TransportStreamParams = {
  url: string
}

export type TransportStream<Protocol extends ProtocolDefinition> = ReadableWritablePair<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> & { controller: ReadableStreamDefaultController<AnyServerMessageOf<Protocol>> }

export function createTransportStream<Protocol extends ProtocolDefinition>(
  params: TransportStreamParams,
): TransportStream<Protocol> {
  const [readable, controller] = createReadable<AnyServerMessageOf<Protocol>>()
  let sessionState: SSESessionState = { status: 'idle' }
  let sseAbortController: AbortController | null = null

  function sendMessage(
    msg: AnyClientMessageOf<Protocol> | TransportMessage,
    sessionID?: string,
  ): Promise<Response> {
    const span = tracer.startSpan(SpanNames.TRANSPORT_HTTP_REQUEST, {
      attributes: {
        [AttributeKeys.HTTP_METHOD]: 'POST',
        [AttributeKeys.TRANSPORT_TYPE]: 'http',
        ...(sessionID != null ? { [AttributeKeys.TRANSPORT_SESSION_ID]: sessionID } : {}),
      },
    })
    try {
      const traceCtx = getActiveTraceContext()
      const headers: Record<string, string> = { ...HEADERS }
      if (traceCtx != null) {
        headers.traceparent = formatTraceparent(
          traceCtx.traceID,
          traceCtx.spanID,
          traceCtx.traceFlags,
        )
      }
      if (sessionID != null) {
        headers['enkaku-session-id'] = sessionID
      }
      return fetch(params.url, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers,
      }).then((res) => {
        span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
        if (!res.ok) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
          controller.error(new ResponseError(res))
        } else {
          span.setStatus({ code: SpanStatusCode.OK })
        }
        span.end()
        return res
      }).catch((error) => {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        span.recordException(error instanceof Error ? error : new Error(String(error)))
        span.end()
        throw error
      })
    } catch (error) {
      span.end()
      throw error
    }
  }

  function consumeSSEStream(response: Response): void {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const parser = createParser({
      onEvent: (event) => {
        if (sessionState.status !== 'connected') return
        const message = JSON.parse(event.data) as AnyServerMessageOf<Protocol>
        controller.enqueue(message)
      },
    })

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          parser.feed(decoder.decode(value, { stream: true }))
        }
      } catch (cause) {
        if (sessionState.status === 'connected') {
          const error = new Error('SSE stream failed', { cause })
          sessionState = { status: 'error', error }
          controller.error(error)
        }
      }
    }
    processStream()
  }

  async function connectSSESession(
    msg: AnyClientMessageOf<Protocol>,
  ): Promise<string> {
    return withSpan(
      tracer,
      SpanNames.TRANSPORT_HTTP_SSE_CONNECT,
      { attributes: { [AttributeKeys.TRANSPORT_TYPE]: 'http-sse' } },
      async (span) => {
        sseAbortController = new AbortController()
        const traceCtx = getActiveTraceContext()
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          accept: 'text/event-stream',
        }
        if (traceCtx != null) {
          headers.traceparent = formatTraceparent(
            traceCtx.traceID,
            traceCtx.spanID,
            traceCtx.traceFlags,
          )
        }

        const response = await fetch(params.url, {
          method: 'POST',
          body: JSON.stringify(msg),
          headers,
          signal: sseAbortController.signal,
        })

        if (!response.ok) {
          throw new ResponseError(response)
        }

        const sessionID = response.headers.get('enkaku-session-id')
        if (sessionID == null) {
          throw new Error('Missing enkaku-session-id header in SSE response')
        }

        span.setAttribute(AttributeKeys.TRANSPORT_SESSION_ID, sessionID)
        consumeSSEStream(response)
        return sessionID
      },
    )
  }

  const writable = writeTo<AnyClientMessageOf<Protocol>>(
    async (msg) => {
      try {
        if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
          if (sessionState.status === 'idle') {
            // First stream/channel — establish SSE session via POST
            const promise = connectSSESession(msg)
            sessionState = { status: 'connecting', promise }
            try {
              const sessionID = await promise
              sessionState = { status: 'connected', sessionID }
            } catch (cause) {
              const error = cause instanceof Error ? cause : new Error(String(cause))
              sessionState = { status: 'error', error }
              controller.error(error)
            }
          } else if (sessionState.status === 'connecting') {
            const sessionID = await sessionState.promise
            await sendMessage(msg, sessionID)
          } else if (sessionState.status === 'connected') {
            await sendMessage(msg, sessionState.sessionID)
          } else {
            throw sessionState.error
          }
        } else {
          const res = await sendMessage(msg)
          if (res.ok && res.status !== 204) {
            res.json().then((msg) => controller.enqueue(msg))
          }
        }
      } catch (cause) {
        controller.error(new Error('Transport write failed', { cause }))
      }
    },
    async () => {
      if (sseAbortController != null) {
        sseAbortController.abort()
      }
    },
  )

  return { controller, readable, writable }
}

export type ClientTransportParams = {
  url: string
}

export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: ClientTransportParams) {
    super({ stream: createTransportStream<Protocol>(params) })
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-client-transport && pnpm run test:unit`

Expected: All tests PASS.

**Step 5: Run type checking**

Run: `cd packages/http-client-transport && pnpm run test:types`

Expected: No type errors.

**Step 6: Commit**

```bash
git add packages/http-client-transport/
git commit -m "Client transport: replace EventSource with fetch + eventsource-parser"
```

---

### Task 5: Full verification

**Step 1: Run linting**

Run: `pnpm run lint`

Fix any formatting issues.

**Step 2: Run all tests**

Run: `pnpm run test`

Expected: All type checks and unit tests PASS across all packages.

**Step 3: Commit any lint fixes**

If lint made changes:
```bash
git add -A
git commit -m "Fix lint"
```

**Step 4: Archive the original exploration doc**

Move the original brainstorm doc to archive:
```bash
mv docs/plans/http-transport-sse-redesign.md docs/plans/archive/http-transport-sse-redesign.superseded.md
```

Add `**Status:** superseded` at the top, linking to the new design doc.

```bash
git add docs/plans/
git commit -m "Archive superseded SSE redesign exploration"
```
