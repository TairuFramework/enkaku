# HTTP Server Transport Hardening Implementation Plan

**Status:** complete

| Issue | Fix | Commit |
|-------|-----|--------|
| C-08: Session Resource Exhaustion | `maxSessions` (default 1000) + `sessionTimeoutMs` (default 5min) with periodic cleanup | `0ac9c7e` |
| C-09: Inflight Request Exhaustion | `maxInflightRequests` (default 10000) + 503 rejection | `b6a9cff` |
| H-09: No Request Timeout | `requestTimeoutMs` (default 30s) + 504 auto-resolve | `b6a9cff` |
| H-10: Header Injection via Origin Reflection | `isValidOrigin()` -- URL parse + http/https scheme check | `ff766b4` |

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the HTTP server transport against resource exhaustion and header injection attacks (C-08, C-09, H-09, H-10 from the security audit).

**Architecture:** All four issues live in `packages/http-server-transport/src/index.ts`. We add configurable limits for sessions and inflight requests (with timeouts and periodic cleanup), a request timeout for inflight `request`-type messages, and origin validation to prevent header injection. Each fix is additive — we introduce new options on `ServerBridgeOptions`, wire defaults, and add TDD tests.

**Tech Stack:** TypeScript, Vitest, `@enkaku/async` (defer), Web API (Request/Response/Headers)

**Audit references:** `docs/plans/2026-01-28-security-audit.md` — C-08, C-09, H-09, H-10

---

### Task 1: Add session limits and timeout (C-08)

**Context:** `createServerBridge()` in `packages/http-server-transport/src/index.ts` stores sessions in a `Map<string, ActiveSession>` with no size limit and no cleanup except on client abort. An attacker can create unlimited sessions via GET requests without an `id` param (line 152-157).

**Files:**
- Modify: `packages/http-server-transport/src/index.ts:31-34` (add options), `:47` (session Map), `:141-181` (handleGetRequest)
- Test: `packages/http-server-transport/test/session-limits.test.ts`

**Step 1: Write failing tests**

Create `packages/http-server-transport/test/session-limits.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('session limits (C-08)', () => {
  test('rejects session creation when maxSessions is reached', async () => {
    const bridge = createServerBridge({ maxSessions: 2 })

    // Create 2 sessions (the limit)
    const res1 = await bridge.handleRequest(
      new Request('http://localhost/', { method: 'GET' }),
    )
    expect(res1.status).toBe(200)
    const { id: id1 } = await res1.json()
    expect(id1).toBeDefined()

    const res2 = await bridge.handleRequest(
      new Request('http://localhost/', { method: 'GET' }),
    )
    expect(res2.status).toBe(200)

    // Third session should be rejected
    const res3 = await bridge.handleRequest(
      new Request('http://localhost/', { method: 'GET' }),
    )
    expect(res3.status).toBe(503)
    const body = await res3.json()
    expect(body.error).toMatch(/session limit/i)
  })

  test('cleans up expired sessions after sessionTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 2,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'GET' }),
      )
      expect(res1.status).toBe(200)

      // Advance past timeout
      vi.advanceTimersByTime(1500)

      // Session should have been cleaned up; we can create new ones
      const res2 = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'GET' }),
      )
      expect(res2.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  test('session access refreshes its timeout', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'GET' }),
      )
      const { id } = await res1.json()

      // Advance partway (800ms)
      vi.advanceTimersByTime(800)

      // Access the session with SSE connect — refreshes timeout
      const controller = new AbortController()
      const sseRes = await bridge.handleRequest(
        new Request(`http://localhost/?id=${id}`, {
          method: 'GET',
          signal: controller.signal,
        }),
      )
      expect(sseRes.status).toBe(200)

      // Advance another 800ms (total 1600ms from creation, but only 800ms since refresh)
      vi.advanceTimersByTime(800)

      // Should NOT be cleaned up yet (refreshed at 800ms, so expires at 1800ms)
      // Try to create a second — should fail because maxSessions=1 and session is still alive
      const res3 = await bridge.handleRequest(
        new Request('http://localhost/', { method: 'GET' }),
      )
      expect(res3.status).toBe(503)

      controller.abort()
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults to 1000 maxSessions and 300000ms sessionTimeoutMs', async () => {
    // Just verify it doesn't reject immediately — defaults should be generous
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(
      new Request('http://localhost/', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -60`
Expected: FAIL — `maxSessions` option not recognized, no 503 response

**Step 3: Implement session limits**

Modify `packages/http-server-transport/src/index.ts`:

1. Add options to `ServerBridgeOptions`:
```typescript
export type ServerBridgeOptions = {
  allowedOrigin?: string | Array<string>
  onWriteError?: (event: TransportEvents['writeFailed']) => void
  maxSessions?: number
  sessionTimeoutMs?: number
}
```

2. Add to `ServerTransportOptions`:
```typescript
export type ServerTransportOptions = {
  allowedOrigin?: string | Array<string>
  maxSessions?: number
  sessionTimeoutMs?: number
}
```

3. Pass options through in `ServerTransport` constructor.

4. Inside `createServerBridge()`, add tracking and cleanup:

```typescript
const maxSessions = options.maxSessions ?? 1000
const sessionTimeoutMs = options.sessionTimeoutMs ?? 300_000 // 5 minutes

type TrackedSession = ActiveSession & { lastAccess: number }
const sessions: Map<string, TrackedSession> = new Map()

// Periodic cleanup of expired sessions
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > sessionTimeoutMs) {
      if (session.controller != null) {
        try { session.controller.close() } catch {}
      }
      sessions.delete(id)
    }
  }
}, Math.min(sessionTimeoutMs, 60_000))
// Prevent interval from keeping Node.js alive
if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
  cleanupInterval.unref()
}
```

5. In `handleGetRequest`, when creating a new session (no `id` param):

```typescript
if (sessionID == null) {
  if (sessions.size >= maxSessions) {
    return Response.json(
      { error: 'Session limit reached' },
      { headers, status: 503 },
    )
  }
  const id = globalThis.crypto.randomUUID()
  sessions.set(id, { controller: null, lastAccess: Date.now() })
  return Response.json({ id }, { headers })
}
```

6. When connecting to the SSE stream (session has `id`), refresh the timestamp:

```typescript
const existing = sessions.get(sessionID)
if (existing == null) {
  return Response.json({ error: 'Invalid ID' }, { headers, status: 400 })
}
const [body, sseController] = createReadable<string>()
sessions.set(sessionID, { controller: sseController, lastAccess: Date.now() })
```

7. Update the `ActiveSession` type:
```typescript
type ActiveSession = { controller: ReadableStreamDefaultController<string> | null; lastAccess: number }
```

Remove the standalone `TrackedSession` alias and use `ActiveSession` directly.

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -80`
Expected: All session-limits tests PASS; existing tests still PASS

**Step 5: Commit**

```bash
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/session-limits.test.ts
git commit -m "fix(http-server-transport): add session limits and timeout (C-08)"
```

---

### Task 2: Add inflight request limits and cleanup (C-09)

**Context:** Inflight requests are stored in a `Map<string, InflightRequest>` and only deleted when a response arrives (line 60). If a handler never responds, entries leak. There is no size limit on the Map.

**Files:**
- Modify: `packages/http-server-transport/src/index.ts:31-34` (add options), `:48` (inflight Map), `:183-226` (handlePostRequest)
- Test: `packages/http-server-transport/test/inflight-limits.test.ts`

**Step 1: Write failing tests**

Create `packages/http-server-transport/test/inflight-limits.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('inflight request limits (C-09)', () => {
  test('rejects requests when maxInflightRequests is reached', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })

    // First request — will hang because no handler resolves it
    const promise1 = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )

    // Second request should be rejected immediately
    const res2 = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r2', prc: 'test' } }),
    )
    expect(res2.status).toBe(503)
    const body = await res2.json()
    expect(body.error).toMatch(/inflight.*limit/i)

    // Fire-and-forget types should still work
    const res3 = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'event', prc: 'test' } }),
    )
    expect(res3.status).toBe(204)
  })

  test('cleans up expired inflight requests after requestTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxInflightRequests: 1,
        requestTimeoutMs: 1000,
      })

      // Send a request — will hang
      const promise = bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
      )

      // Advance past timeout
      vi.advanceTimersByTime(1500)

      // The timed-out request should resolve with 504
      const res = await promise
      expect(res.status).toBe(504)
      const body = await res.json()
      expect(body.error).toMatch(/timeout/i)

      // Now a new request should be accepted
      const promise2 = bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r2', prc: 'test' } }),
      )
      // Shouldn't immediately reject — it was accepted
      const res3 = await bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r3', prc: 'test' } }),
      )
      expect(res3.status).toBe(503) // limit is 1, r2 is still pending
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults allow generous limits', async () => {
    const bridge = createServerBridge()
    // Should not reject a single request
    const promise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    // Just verify it didn't immediately return a 503
    // (it will hang forever since no handler; that's expected)
    const raceResult = await Promise.race([
      promise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -60`
Expected: FAIL — `maxInflightRequests` not recognized, no 503 for limit, no 504 for timeout

**Step 3: Implement inflight limits and timeout**

Modify `packages/http-server-transport/src/index.ts`:

1. Add options to `ServerBridgeOptions` and `ServerTransportOptions`:
```typescript
maxInflightRequests?: number
requestTimeoutMs?: number
```

2. Inside `createServerBridge()`:

```typescript
const maxInflightRequests = options.maxInflightRequests ?? 10_000
const requestTimeoutMs = options.requestTimeoutMs ?? 30_000 // 30 seconds

const inflightTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
```

3. In `handlePostRequest`, case `'request'`:

```typescript
case 'request': {
  if (inflight.size >= maxInflightRequests) {
    return Response.json(
      { error: 'Inflight request limit reached' },
      { headers, status: 503 },
    )
  }
  const response = defer<Response>()
  inflight.set(message.payload.rid, { type: 'request', headers, ...response })

  // Set timeout for this request
  const timer = setTimeout(() => {
    const entry = inflight.get(message.payload.rid)
    if (entry != null && entry.type === 'request') {
      entry.resolve(
        Response.json({ error: 'Request timeout' }, { headers: entry.headers, status: 504 }),
      )
      inflight.delete(message.payload.rid)
      inflightTimers.delete(message.payload.rid)
    }
  }, requestTimeoutMs)
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref()
  }
  inflightTimers.set(message.payload.rid, timer)

  controller.enqueue(message)
  return response.promise
}
```

4. When a response arrives (in the `writeTo` callback), clear the timer:

```typescript
if (request.type === 'request') {
  const timer = inflightTimers.get(rid)
  if (timer != null) {
    clearTimeout(timer)
    inflightTimers.delete(rid)
  }
  request.resolve(Response.json(msg, { headers: request.headers }))
  inflight.delete(msg.payload.rid)
}
```

5. Pass new options through `ServerTransport` constructor.

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -80`
Expected: All inflight-limits tests PASS; existing tests still PASS

**Step 5: Commit**

```bash
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/inflight-limits.test.ts
git commit -m "fix(http-server-transport): add inflight request limits and timeout (C-09, H-09)"
```

---

### Task 3: Add origin validation to prevent header injection (H-10)

**Context:** In `checkRequestOrigin()` (line 110-118), when `allowedOrigins` includes `'*'`, the raw `origin` header from the request is reflected directly into the `Access-Control-Allow-Origin` response header without validation. An attacker could craft an origin containing special characters or newlines.

**Files:**
- Modify: `packages/http-server-transport/src/index.ts:110-118` (checkRequestOrigin)
- Test: `packages/http-server-transport/test/origin-validation.test.ts`

**Step 1: Write failing tests**

Create `packages/http-server-transport/test/origin-validation.test.ts`:

```typescript
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
    const res = await bridge.handleRequest(
      new Request('http://localhost/', { method: 'OPTIONS' }),
    )
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
    // If someone accidentally puts a bad string in allowedOrigin, it should still validate
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -60`
Expected: FAIL — invalid origins currently return 204, not 403

**Step 3: Implement origin validation**

Modify `checkRequestOrigin()` in `packages/http-server-transport/src/index.ts`:

```typescript
const ALLOWED_ORIGIN_SCHEMES = new Set(['http:', 'https:'])

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return ALLOWED_ORIGIN_SCHEMES.has(url.protocol)
  } catch {
    return false
  }
}

function checkRequestOrigin(request: Request): Response | string {
  const origin = request.headers.get('origin')
  if (allowedOrigins.includes('*')) {
    if (origin == null) {
      return '*'
    }
    if (!isValidOrigin(origin)) {
      return Response.json({ error: 'Origin not allowed' }, { status: 403 })
    }
    return origin
  }
  if (origin == null || !allowedOrigins.includes(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  }
  return origin
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/http-server-transport && pnpm test:unit -- --reporter=verbose 2>&1 | head -80`
Expected: All origin-validation tests PASS; existing CORS tests still PASS

**Step 5: Commit**

```bash
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/origin-validation.test.ts
git commit -m "fix(http-server-transport): validate origin format before reflecting (H-10)"
```

---

### Task 4: Export createServerBridge for testability

**Context:** The test files above call `createServerBridge()` directly, but it's currently only exported as a regular function — we need to verify it's already exported. If it's not exported from the package entry point, tests importing `../src/index.js` will work, but we should confirm the function is a named export.

**Files:**
- Check: `packages/http-server-transport/src/index.ts:38` — `export function createServerBridge`

**Step 1: Verify export**

The function is already `export function createServerBridge` on line 38. Tests import from `../src/index.js` which gives them direct access. No changes needed.

If tests import correctly in Steps 1-3, skip this task.

**Step 2: Run full test suite**

Run: `cd packages/http-server-transport && pnpm test 2>&1 | tail -30`
Expected: All tests pass, type check passes

**Step 3: Commit (if any changes were needed)**

Only commit if changes were made in this task.

---

### Task 5: Update security audit document

**Context:** After all fixes land, update the audit document to reflect the new status.

**Files:**
- Modify: `docs/plans/2026-01-28-security-audit.md`

**Step 1: Update issue statuses**

In `docs/plans/2026-01-28-security-audit.md`, update:

- **C-08** (line ~161): Change `[ ] Not Started` to `[x] Fixed — Branch main`; add **Fix Applied** section describing session limits and timeout
- **C-09** (line ~179): Change `[ ] Not Started` to `[x] Fixed — Branch main`; add **Fix Applied** section describing inflight limits and timeout
- **H-09** (line ~395): Change `[ ] Not Started` to `[x] Fixed — Branch main` (covered by C-09's request timeout)
- **H-10** (line ~408): Change `[ ] Not Started` to `[x] Fixed — Branch main`; add **Fix Applied** section describing origin validation

Update the **Executive Summary** table:
- CRITICAL: Update to reflect C-08 and C-09 as fixed (8 Fixed total)
- HIGH: Update to reflect H-09, H-10 as fixed (13 Fixed total)

Add to the **Resolved via implementation plans** header:
```
- HTTP server transport hardening (C-08, C-09, H-09, H-10) — `docs/plans/2026-01-30-http-transport-hardening.md`
```

Update the **Implementation Roadmap Phase 2** line to reflect the newly fixed items.

**Step 2: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: update security audit with HTTP transport hardening (C-08, C-09, H-09, H-10)"
```

---

### Task 6: Run full workspace tests

**Step 1: Run full test suite**

Run: `pnpm run test 2>&1 | tail -40`
Expected: All packages pass type checks and unit tests

**Step 2: If failures, fix and re-run**

Address any failures before proceeding.

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix: address test failures from HTTP transport hardening"
```

Only commit if there were fixes needed.
