# OpenTelemetry Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all direct `@opentelemetry/api` usage across Enkaku with `@enkaku/otel` helpers, add tracer injection, new instrumentation, and W3C traceparent support.

**Architecture:** Expand `@enkaku/otel` to re-export OTel types and provide `withSpan`, `withSyncSpan`, context helpers. Refactor 10 consuming packages to import only from `@enkaku/otel`. Add tracer injection to Client, Server, and transport constructors. Add W3C traceparent to HTTP transports.

**Tech Stack:** TypeScript, @opentelemetry/api, vitest, pnpm monorepo with SWC

**Design doc:** `docs/plans/2026-03-05-otel-integration-design.md`

---

### Task 1: Expand @enkaku/otel — Re-exports and New Helpers

**Files:**
- Modify: `packages/otel/src/tracers.ts`
- Modify: `packages/otel/src/context.ts`
- Modify: `packages/otel/src/index.ts`
- Test: `packages/otel/test/tracers.test.ts`
- Test: `packages/otel/test/context.test.ts`

**Step 1: Write failing tests for new helpers**

Add to `packages/otel/test/tracers.test.ts`:

```typescript
import { createTracer, getActiveSpan, getActiveTraceContext, withSpan, withSyncSpan } from '../src/tracers.js'

describe('getActiveSpan', () => {
  test('returns undefined when no span is active', () => {
    expect(getActiveSpan()).toBeUndefined()
  })
})

describe('withSyncSpan', () => {
  test('executes the function and returns its result', () => {
    const tracer = createTracer('test')
    const result = withSyncSpan(tracer, 'test-span', {}, () => {
      return 42
    })
    expect(result).toBe(42)
  })

  test('propagates errors from the function', () => {
    const tracer = createTracer('test')
    expect(() =>
      withSyncSpan(tracer, 'test-span', {}, () => {
        throw new Error('test error')
      }),
    ).toThrow('test error')
  })

  test('passes the span to the function', () => {
    const tracer = createTracer('test')
    withSyncSpan(tracer, 'test-span', {}, (span) => {
      expect(span).toBeDefined()
      expect(typeof span.setAttribute).toBe('function')
    })
  })
})
```

Add to `packages/otel/test/context.test.ts`:

```typescript
import { extractTraceContext, injectTraceContext, withActiveContext, setSpanOnContext } from '../src/context.js'

describe('withActiveContext', () => {
  test('executes function and returns its result', () => {
    const result = withActiveContext(undefined, () => 42)
    expect(result).toBe(42)
  })
})

describe('setSpanOnContext', () => {
  test('returns a Context object', () => {
    const tracer = createTracer('test')
    const span = tracer.startSpan('test')
    const ctx = setSpanOnContext(undefined, span)
    expect(ctx).toBeDefined()
    span.end()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL — `getActiveSpan`, `withSyncSpan`, `withActiveContext`, `setSpanOnContext` not exported

**Step 3: Implement new helpers in tracers.ts**

Add to `packages/otel/src/tracers.ts`:

```typescript
export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active()) ?? undefined
}

export function withSyncSpan<T>(
  tracer: Tracer,
  name: string,
  options: SpanOptions,
  fn: (span: Span) => T,
  parentContext?: Context,
): T {
  const ctx = parentContext ?? context.active()
  const span = tracer.startSpan(name, options, ctx)
  const spanCtx = trace.setSpan(ctx, span)
  try {
    const result = context.with(spanCtx, () => fn(span))
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}
```

Also update `withSpan` to accept optional `parentContext`:

```typescript
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>,
  parentContext?: Context,
): Promise<T> {
  const ctx = parentContext ?? context.active()
  return tracer.startActiveSpan(name, options, ctx, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}
```

**Step 4: Implement context helpers**

Add to `packages/otel/src/context.ts`:

```typescript
export function withActiveContext<T>(parentContext: Context | undefined, fn: () => T): T {
  const ctx = parentContext ?? context.active()
  return context.with(ctx, fn)
}

export function setSpanOnContext(parentContext: Context | undefined, span: Span): Context {
  const ctx = parentContext ?? context.active()
  return trace.setSpan(ctx, span)
}
```

Add `type Span` import from `@opentelemetry/api` to context.ts.

**Step 5: Update re-exports in index.ts**

Update `packages/otel/src/index.ts` to also export:

```typescript
export { extractTraceContext, injectTraceContext, setSpanOnContext, withActiveContext } from './context.js'
export {
  createTracer,
  getActiveSpan,
  getActiveTraceContext,
  type TraceContext,
  withSpan,
  withSyncSpan,
} from './tracers.js'
```

Also add re-exports of OTel types:

```typescript
export { type Context, type Span, type SpanOptions, SpanStatusCode, type Tracer, TraceFlags } from '@opentelemetry/api'
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/otel && pnpm run test`
Expected: All PASS

**Step 7: Commit**

```bash
git add packages/otel/src packages/otel/test
git commit -m "feat(otel): add re-exports, withSyncSpan, context helpers, parentContext support"
```

---

### Task 2: Expand @enkaku/otel — New Semantic Constants

**Files:**
- Modify: `packages/otel/src/semantic.ts`
- Modify: `packages/otel/test/semantic.test.ts`

**Step 1: Write failing tests for new constants**

Add to `packages/otel/test/semantic.test.ts`:

```typescript
test('has socket transport span name', () => {
  expect(SpanNames.TRANSPORT_SOCKET_CONNECT).toBe('enkaku.transport.socket.connect')
})

test('has transport session ID attribute', () => {
  expect(AttributeKeys.TRANSPORT_SESSION_ID).toBe('enkaku.transport.session_id')
})

test('has HTTP method attribute', () => {
  expect(AttributeKeys.HTTP_METHOD).toBe('http.method')
})

test('has HTTP status code attribute', () => {
  expect(AttributeKeys.HTTP_STATUS_CODE).toBe('http.status_code')
})

test('has net peer name attribute', () => {
  expect(AttributeKeys.NET_PEER_NAME).toBe('net.peer.name')
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL

**Step 3: Add new constants**

In `packages/otel/src/semantic.ts`, add to `SpanNames`:

```typescript
TRANSPORT_SOCKET_CONNECT: 'enkaku.transport.socket.connect',
```

Add to `AttributeKeys`:

```typescript
// Transport (additional)
TRANSPORT_SESSION_ID: 'enkaku.transport.session_id',

// HTTP (standard OTel)
HTTP_METHOD: 'http.method',
HTTP_STATUS_CODE: 'http.status_code',

// Network
NET_PEER_NAME: 'net.peer.name',
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/otel && pnpm run test`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/otel/src/semantic.ts packages/otel/test/semantic.test.ts
git commit -m "feat(otel): add socket span name and missing attribute key constants"
```

---

### Task 3: Refactor token package

**Files:**
- Modify: `packages/token/src/token.ts`
- Modify: `packages/token/src/identity.ts`
- Modify: `packages/token/package.json` (remove `@opentelemetry/api` dependency)

**Step 1: Refactor `packages/token/src/token.ts`**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tokenTracer = trace.getTracer('enkaku.token')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'

const tokenTracer = createTracer('token')
```

Replace `verifyToken` body:
```typescript
export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(
  token: Token<Payload> | string,
  verifiers?: Verifiers,
  timeOptions?: TimeValidationOptions,
): Promise<Token<Payload>> {
  return withSpan(tokenTracer, SpanNames.TOKEN_VERIFY, {}, async (span) => {
    const result = await verifyTokenInner(token, verifiers, timeOptions)
    if (isSignedToken(result)) {
      span.setAttribute(
        AttributeKeys.AUTH_DID,
        (result.payload as Record<string, unknown>).iss as string,
      )
      span.setAttribute(AttributeKeys.AUTH_ALGORITHM, result.header.alg)
    }
    return result
  })
}
```

Note: `withSpan` handles OK/ERROR status and exception recording automatically, so we remove all that manual boilerplate.

**Step 2: Refactor `packages/token/src/identity.ts`**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.token')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'

const tracer = createTracer('token')
```

Replace `signToken` in `createSigningIdentity`:
```typescript
async function signToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
  return withSpan(
    tracer,
    SpanNames.TOKEN_SIGN,
    { attributes: { [AttributeKeys.AUTH_DID]: id, [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA' } },
    async () => {
      if (payload.iss != null && payload.iss !== id) {
        throw new Error('Invalid payload: issuer does not match signer')
      }

      const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
      const fullPayload = { ...payload, iss: id }
      const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

      return {
        header: fullHeader,
        payload: fullPayload,
        signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
        data,
      }
    },
  )
}
```

**Step 3: Remove @opentelemetry/api from token/package.json**

Remove `"@opentelemetry/api": "catalog:"` from dependencies.

**Step 4: Run tests**

Run: `cd packages/token && pnpm run test`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/token/src packages/token/package.json
git commit -m "refactor(token): use @enkaku/otel helpers, remove direct @opentelemetry/api dependency"
```

---

### Task 4: Refactor all keystores

**Files:**
- Modify: `packages/node-keystore/src/identity.ts`
- Modify: `packages/node-keystore/package.json`
- Modify: `packages/browser-keystore/src/identity.ts`
- Modify: `packages/browser-keystore/package.json`
- Modify: `packages/expo-keystore/src/identity.ts`
- Modify: `packages/expo-keystore/package.json`
- Modify: `packages/electron-keystore/src/identity.ts`
- Modify: `packages/electron-keystore/package.json`

All keystores follow the same pattern. For each keystore:

**Pattern — replace imports:**
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.keystore.<platform>')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, SpanNames, withSyncSpan, withSpan } from '@enkaku/otel'

const tracer = createTracer('keystore.<platform>')
```

**Pattern — replace sync `provideFullIdentity`:**

Example for node-keystore (`packages/node-keystore/src/identity.ts`):
```typescript
export function provideFullIdentity(store: NodeKeyStore | string, keyID: string): FullIdentity {
  return withSyncSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'node' } },
    (span) => {
      const entry = getStore(store).entry(keyID)
      const existing = entry.get()
      if (existing != null) {
        const identity = createFullIdentity(existing)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = entry.provide()
      const identity = createFullIdentity(key)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}
```

**Pattern — replace async `provideFullIdentityAsync`:**

```typescript
export async function provideFullIdentityAsync(
  store: NodeKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  return withSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'node' } },
    async (span) => {
      const entry = getStore(store).entry(keyID)
      const existing = await entry.getAsync()
      if (existing != null) {
        const identity = createFullIdentity(existing)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = await entry.provideAsync()
      const identity = createFullIdentity(key)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}
```

Apply this pattern to all 4 keystores with their specific store type strings: `'node'`, `'browser'`, `'expo'`, `'electron'`.

Note: Browser keystore only has async `provideSigningIdentity`, so use `withSpan` only.

**Step 1: Apply refactoring to all 4 keystore identity files**
**Step 2: Remove `@opentelemetry/api` from all 4 keystore package.json files**
**Step 3: Run full build to verify type checking**

Run: `pnpm run build`
Expected: All PASS (keystores may not have unit tests for identity)

**Step 4: Commit**

```bash
git add packages/node-keystore packages/browser-keystore packages/expo-keystore packages/electron-keystore
git commit -m "refactor(keystores): use @enkaku/otel helpers, remove direct @opentelemetry/api dependency"
```

---

### Task 5: Refactor socket-transport

**Files:**
- Modify: `packages/socket-transport/src/index.ts`
- Modify: `packages/socket-transport/package.json`

**Step 1: Refactor socket-transport**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.socket')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'

const tracer = createTracer('transport.socket')
```

Replace `connectSocket`:
```typescript
export async function connectSocket(path: string): Promise<Socket> {
  return withSpan(
    tracer,
    SpanNames.TRANSPORT_SOCKET_CONNECT,
    { attributes: { [AttributeKeys.TRANSPORT_TYPE]: 'socket', [AttributeKeys.NET_PEER_NAME]: path } },
    async () => {
      const socket = createConnection(path)
      return new Promise<Socket>((resolve, reject) => {
        socket.on('connect', () => resolve(socket))
        socket.on('error', (err) => reject(err))
      })
    },
  )
}
```

**Step 2: Remove `@opentelemetry/api` from package.json**
**Step 3: Run tests**

Run: `cd packages/socket-transport && pnpm run test`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/socket-transport
git commit -m "refactor(socket-transport): use @enkaku/otel helpers, fix span name to TRANSPORT_SOCKET_CONNECT"
```

---

### Task 6: Refactor http-client-transport

**Files:**
- Modify: `packages/http-client-transport/src/index.ts`
- Modify: `packages/http-client-transport/package.json`

**Step 1: Refactor http-client-transport**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.http')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, type Span, SpanNames, SpanStatusCode, withSpan } from '@enkaku/otel'

const tracer = createTracer('transport.http')
```

Note: This package needs `SpanStatusCode` and `Span` type re-exported from otel because `createEventStream` has a complex span lifecycle with `spanEnded` tracking. We can simplify it with `withSpan`:

Replace `createEventStream`:
```typescript
export async function createEventStream(url: string): Promise<EventStream> {
  return withSpan(
    tracer,
    SpanNames.TRANSPORT_HTTP_SSE_CONNECT,
    { attributes: { [AttributeKeys.TRANSPORT_TYPE]: 'http-sse' } },
    async (span) => {
      const res = await fetch(url)
      if (!res.ok) {
        throw new ResponseError(res)
      }

      const data = (await res.json()) as { id: string }
      span.setAttribute(AttributeKeys.TRANSPORT_SESSION_ID, data.id)
      const sourceURL = new URL(url)
      sourceURL.searchParams.set('id', data.id)
      const source = new EventSource(sourceURL)

      await new Promise<void>((resolve, reject) => {
        source.addEventListener('open', () => resolve(), { once: true })
        source.addEventListener(
          'error',
          (event) => reject(new Error('EventSource connection failed', { cause: event })),
          { once: true },
        )
      })

      return { id: data.id, source }
    },
  )
}
```

Replace `sendMessage` inner function:
```typescript
async function sendMessage(
  msg: AnyClientMessageOf<Protocol> | TransportMessage,
  sessionID?: string,
): Promise<Response> {
  return withSpan(
    tracer,
    SpanNames.TRANSPORT_HTTP_REQUEST,
    {
      attributes: {
        [AttributeKeys.HTTP_METHOD]: 'POST',
        [AttributeKeys.TRANSPORT_TYPE]: 'http',
        ...(sessionID != null ? { [AttributeKeys.TRANSPORT_SESSION_ID]: sessionID } : {}),
      },
    },
    async (span) => {
      const res = await fetch(params.url, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
      })
      span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
      if (!res.ok) {
        controller.error(new ResponseError(res))
        // Don't throw — just set error status. The original code didn't throw here.
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      }
      return res
    },
  )
}
```

Wait — the original `sendMessage` sets ERROR status but doesn't throw on !res.ok. The `withSpan` helper auto-sets OK. We need to handle this: either set status inside the callback or let withSpan handle it. Since we need custom status logic (ERROR but no throw), we should set the status manually inside the callback and have withSpan's auto-OK be overridden.

Actually, `withSpan` sets OK only if no error is thrown. For the `!res.ok` case the function returns normally, so withSpan would set OK. We need to manually set ERROR status in the callback for this case. The approach: let the callback handle status explicitly, and the auto-OK from withSpan will be a no-op since the span already has a status set.

Actually checking OTel behavior: `setStatus` can be called multiple times, with the last one winning. So `withSpan` setting OK after our ERROR would overwrite it. We need a different approach.

**Better approach:** For cases where the callback needs custom status logic, just use the span directly without relying on withSpan's auto-status. We can add a `manualStatus` option or just import `Span` and handle it.

**Simplest approach:** Keep `sendMessage` using manual span management for this specific case, importing `SpanStatusCode` from `@enkaku/otel` (not `@opentelemetry/api`). Only use `withSpan` where the auto-status pattern fits cleanly.

Revised `sendMessage`:
```typescript
async function sendMessage(
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
    const res = await fetch(params.url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
    })
    span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
    if (!res.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      controller.error(new ResponseError(res))
    } else {
      span.setStatus({ code: SpanStatusCode.OK })
    }
    return res
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}
```

This still imports `SpanStatusCode` from `@enkaku/otel` (re-exported), so the encapsulation goal is met.

**Step 2: Remove `@opentelemetry/api` from package.json**
**Step 3: Run tests**

Run: `cd packages/http-client-transport && pnpm run test`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/http-client-transport
git commit -m "refactor(http-client-transport): use @enkaku/otel helpers, remove direct @opentelemetry/api"
```

---

### Task 7: Refactor http-server-transport

**Files:**
- Modify: `packages/http-server-transport/src/index.ts`
- Modify: `packages/http-server-transport/package.json`

**Step 1: Refactor http-server-transport**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.http')
```

With:
```typescript
// AFTER
import { AttributeKeys, createTracer, SpanNames, SpanStatusCode } from '@enkaku/otel'

const tracer = createTracer('transport.http')
```

The `handleRequest` function in the server bridge has the same custom-status pattern (ERROR for 4xx but no throw), so keep manual span management but use `createTracer` and `AttributeKeys.HTTP_METHOD` / `AttributeKeys.HTTP_STATUS_CODE`:

```typescript
async function handleRequest(request: Request): Promise<Response> {
  const span = tracer.startSpan(SpanNames.TRANSPORT_HTTP_REQUEST, {
    attributes: {
      [AttributeKeys.HTTP_METHOD]: request.method,
      [AttributeKeys.TRANSPORT_TYPE]: 'http-server',
    },
  })
  try {
    // ... existing switch/case logic unchanged ...
    span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, response.status)
    if (response.status >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` })
    } else {
      span.setStatus({ code: SpanStatusCode.OK })
    }
    return response
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}
```

**Step 2: Remove `@opentelemetry/api` from package.json**
**Step 3: Run tests**

Run: `cd packages/http-server-transport && pnpm run test`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/http-server-transport
git commit -m "refactor(http-server-transport): use @enkaku/otel helpers, remove direct @opentelemetry/api"
```

---

### Task 8: Refactor server package

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/package.json`

This is the most complex refactoring. The server has custom span lifecycle management with `createHandleSpan` + `wrapHandle` pattern.

**Step 1: Refactor server.ts**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { context as otelContext, SpanStatusCode, trace } from '@opentelemetry/api'
```

With:
```typescript
// AFTER
import {
  AttributeKeys,
  createTracer,
  extractTraceContext,
  type Span,
  SpanNames,
  SpanStatusCode,
  setSpanOnContext,
  withActiveContext,
} from '@enkaku/otel'
```

Replace module-level tracer:
```typescript
// BEFORE
const tracer = trace.getTracer('enkaku.server')
// AFTER
const tracer = createTracer('server')
```

Replace `extractTraceContext` function (delete inline implementation, use imported one):

The imported `extractTraceContext` from `@enkaku/otel` takes a `Record<string, unknown>` header and returns `Context | undefined`. The server's current version returns the active context when no trace fields are present. We need to adapt:

```typescript
function getParentContext(message: ProcessMessageOf<Protocol>) {
  const header = message.header as Record<string, unknown>
  return extractTraceContext(header) // returns Context | undefined
}
```

Replace `createHandleSpan`:
```typescript
function createHandleSpan(message: ProcessMessageOf<Protocol>) {
  const parentCtx = getParentContext(message)
  const procedure = (message.payload as Record<string, unknown>).prc as string | undefined
  const rid =
    'rid' in message.payload
      ? ((message.payload as Record<string, unknown>).rid as string)
      : undefined

  return tracer.startSpan(
    SpanNames.SERVER_HANDLE,
    {
      attributes: {
        [AttributeKeys.RPC_SYSTEM]: 'enkaku',
        ...(procedure != null ? { [AttributeKeys.RPC_PROCEDURE]: procedure } : {}),
        ...(rid != null ? { [AttributeKeys.RPC_REQUEST_ID]: rid } : {}),
      },
    },
    parentCtx, // undefined means use active context (same as before for no-trace case)
  )
}
```

Wait — the current `extractTraceContext` in server.ts falls back to `otelContext.active()` when no trace fields are present, and `tracer.startSpan(..., parentCtx)` uses that. The imported `extractTraceContext` from otel returns `undefined` when no fields. But `tracer.startSpan(name, options, undefined)` will use the active context automatically. So this works correctly — no behavior change.

Replace `wrapHandle`:
```typescript
function wrapHandle(
  span: Span,
  handle: () => Error | Promise<void>,
): () => Error | Promise<void> {
  return () => {
    const spanCtx = setSpanOnContext(undefined, span)
    const result = withActiveContext(spanCtx, handle)
    if (result instanceof Error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: result.message })
      span.recordException(result)
      span.end()
      return result
    }
    result
      .then(() => {
        span.setStatus({ code: SpanStatusCode.OK })
        span.end()
      })
      .catch((err: Error) => {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
        span.recordException(err)
        span.end()
      })
    return result
  }
}
```

Note: `setSpanOnContext(undefined, span)` is equivalent to `trace.setSpan(otelContext.active(), span)`. And `withActiveContext(spanCtx, handle)` is equivalent to `otelContext.with(spanCtx, handle)`.

The rest of the `process` function (public and authenticated paths) stays the same — it just uses `span.setAttribute(...)` directly, which is fine since `span` is the same `Span` type.

**Step 2: Remove `@opentelemetry/api` from package.json**
**Step 3: Build and run tests**

Run: `pnpm run build && cd packages/server && pnpm run test`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/server
git commit -m "refactor(server): use @enkaku/otel helpers, remove direct @opentelemetry/api dependency"
```

---

### Task 9: Refactor client package

**Files:**
- Modify: `packages/client/src/client.ts`
- Modify: `packages/client/package.json`

The client has unique patterns: module-level tracer, inline `#injectTraceContext`, and Promise-based span ending (span lives beyond the initial function call).

**Step 1: Refactor client.ts**

Replace imports:
```typescript
// BEFORE
import { AttributeKeys, SpanNames, ZERO_TRACE_ID } from '@enkaku/otel'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.client')
```

With:
```typescript
// AFTER
import {
  AttributeKeys,
  createTracer,
  injectTraceContext as otelInjectTraceContext,
  setSpanOnContext,
  type Span,
  SpanNames,
  SpanStatusCode,
  withActiveContext,
} from '@enkaku/otel'

const defaultTracer = createTracer('client')
```

Remove the `#injectTraceContext` method and update `#write` to use the imported `injectTraceContext`:

The imported `injectTraceContext` from otel takes `header: T extends Record<string, unknown>` and returns `T`. But the client's `#write` method passes `header?: AnyHeader` which can be undefined. We need to handle that:

```typescript
async #write(payload: AnyClientPayloadOf<Protocol>, header?: AnyHeader): Promise<void> {
  if (this.signal.aborted) {
    throw new Error('Client aborted', { cause: this.signal.reason })
  }
  const enrichedHeader = header != null ? otelInjectTraceContext(header) : otelInjectTraceContext({})
  const finalHeader = Object.keys(enrichedHeader).length > 0 ? enrichedHeader : undefined
  const message = await this.#createMessage(payload, finalHeader)
  await this.#transport.write(message)
}
```

Wait, looking more carefully: the original `#injectTraceContext` returns `undefined` when header is undefined and no span is active, and returns `{ ...header, tid, sid }` when span is active. The imported version requires a `Record<string, unknown>` — it can't handle `undefined`. Let's simplify:

```typescript
async #write(payload: AnyClientPayloadOf<Protocol>, header?: AnyHeader): Promise<void> {
  if (this.signal.aborted) {
    throw new Error('Client aborted', { cause: this.signal.reason })
  }
  const baseHeader = header ?? {}
  const enrichedHeader = otelInjectTraceContext(baseHeader)
  // Only pass header if it has properties (preserves original behavior of passing undefined for empty headers)
  const finalHeader = Object.keys(enrichedHeader).length > 0 ? enrichedHeader : undefined
  const message = await this.#createMessage(payload, finalHeader)
  await this.#transport.write(message)
}
```

Delete the `#injectTraceContext` method entirely (lines 379-389).

For the span lifecycle in `sendEvent`, `request`, `createStream`, `createChannel`:

**`sendEvent`** — simple async, can use `withSpan`:
```typescript
async sendEvent<...>(procedure, ...args): Promise<void> {
  const config = args[0] ?? {}
  return withSpan(
    this.#tracer,
    SpanNames.CLIENT_CALL,
    {
      attributes: {
        [AttributeKeys.RPC_SYSTEM]: 'enkaku',
        [AttributeKeys.RPC_PROCEDURE]: procedure,
        [AttributeKeys.RPC_TYPE]: 'event',
      },
    },
    async () => {
      const data = config.data
      const payload = data
        ? { typ: 'event', prc: procedure, data }
        : { typ: 'event', prc: procedure }
      if (data == null) {
        this.#logger.trace('send event {procedure} without data', { procedure })
      } else {
        this.#logger.trace('send event {procedure} with data: {data}', { procedure, data })
      }
      await this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header)
    },
  )
}
```

Wait — `sendEvent` uses `context.with(spanCtx, ...)` to ensure the span is active during the write so that `#injectTraceContext` picks it up. With `withSpan` (which uses `startActiveSpan`), the span is already active during the callback. And `#write` now calls the imported `otelInjectTraceContext` which picks up the active span automatically. So `withSpan` naturally handles this.

**`request`, `createStream`, `createChannel`** — these are synchronous methods that return immediately but the span lives until the controller's result promise resolves. `withSpan` can't wrap this because the function returns before the span should end.

For these, keep manual span management but use helpers from otel:

```typescript
request<...>(procedure, ...args): RequestCall<T['Result']> & Promise<T['Result']> {
  const config = args[0] ?? {}
  const rid = config.id ?? this.#getRandomID()

  const span = this.#tracer.startSpan(SpanNames.CLIENT_CALL, {
    attributes: {
      [AttributeKeys.RPC_SYSTEM]: 'enkaku',
      [AttributeKeys.RPC_PROCEDURE]: procedure,
      [AttributeKeys.RPC_REQUEST_ID]: rid,
      [AttributeKeys.RPC_TYPE]: 'request',
    },
  })

  const controller = createController<T['Result']>({
    type: 'request',
    procedure,
    header: config.header,
  })

  const providedSignal = config.signal
  if (providedSignal?.aborted) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Aborted before send' })
    span.end()
    this.#logger.debug('reject aborted request {procedure} with ID {rid}', { procedure, rid })
    return createRequest({
      id: rid,
      controller,
      signal: providedSignal,
      sent: Promise.reject(providedSignal),
    })
  }

  this.#controllers[rid] = controller
  const prm = config.param
  const payload = prm
    ? { typ: 'request', rid, prc: procedure, prm }
    : { typ: 'request', rid, prc: procedure }
  if (prm == null) {
    this.#logger.trace('send request {procedure} with ID {rid}', { procedure, rid })
  } else {
    this.#logger.trace('send request {procedure} with ID {rid} and param: {param}', {
      procedure,
      rid,
      param: prm,
    })
  }

  const spanCtx = setSpanOnContext(undefined, span)
  const sent = withActiveContext(spanCtx, () =>
    this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header),
  )

  controller.result.then(
    () => {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    },
    (error) => {
      if (error instanceof RequestError) {
        span.setAttribute(AttributeKeys.ERROR_CODE, error.code)
        span.setAttribute(AttributeKeys.ERROR_MESSAGE, error.message)
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      span.end()
    },
  )

  const signal = this.#handleSignal(rid, controller, providedSignal)
  return createRequest({ id: rid, controller, signal, sent })
}
```

Same pattern applies to `createStream` and `createChannel` — replace `trace.setSpan(context.active(), span)` with `setSpanOnContext(undefined, span)` and `context.with(spanCtx, ...)` with `withActiveContext(spanCtx, ...)`.

**Add tracer injection to constructor:**

Add to `ClientParams`:
```typescript
export type ClientParams<Protocol extends ProtocolDefinition> = {
  // ... existing fields ...
  tracer?: Tracer
}
```

Add `#tracer` field and constructor initialization:
```typescript
#tracer: Tracer

constructor(params: ClientParams<Protocol>) {
  // ... existing code ...
  this.#tracer = params.tracer ?? defaultTracer
}
```

Import `type Tracer` from `@enkaku/otel`.

Replace all `tracer.` calls with `this.#tracer.` in instance methods.

**Step 2: Remove `@opentelemetry/api` from package.json**
**Step 3: Build and run tests**

Run: `pnpm run build && cd packages/client && pnpm run test`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/client
git commit -m "refactor(client): use @enkaku/otel helpers, add tracer injection, remove @opentelemetry/api"
```

---

### Task 10: Add tracer injection to Server

**Files:**
- Modify: `packages/server/src/server.ts`

**Step 1: Add tracer to ServerParams and pass it to handleMessages**

Add to `ServerParams`:
```typescript
export type ServerParams<Protocol extends ProtocolDefinition> = {
  // ... existing fields ...
  tracer?: Tracer
}
```

Add to `HandleMessagesParams`:
```typescript
export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  // ... existing fields ...
  tracer: Tracer
}
```

In `Server` constructor, store the tracer:
```typescript
#tracer: Tracer

constructor(params: ServerParams<Protocol>) {
  // ... existing code ...
  this.#tracer = params.tracer ?? tracer
}
```

Pass it through to `handleMessages`:
```typescript
const done = handleMessages<Protocol>({
  // ... existing fields ...
  tracer: this.#tracer,
  ...accessControl,
})
```

In `handleMessages`, use `params.tracer` instead of module-level `tracer`:

```typescript
function createHandleSpan(message: ProcessMessageOf<Protocol>) {
  // ... same as before but use params.tracer instead of tracer ...
  return params.tracer.startSpan(...)
}
```

Import `type Tracer` from `@enkaku/otel`.

**Step 2: Run tests**

Run: `cd packages/server && pnpm run test`
Expected: All PASS

**Step 3: Commit**

```bash
git add packages/server
git commit -m "feat(server): add tracer injection via ServerParams"
```

---

### Task 11: Add W3C traceparent to HTTP transports

**Files:**
- Create: `packages/otel/src/traceparent.ts`
- Modify: `packages/otel/src/index.ts`
- Test: `packages/otel/test/traceparent.test.ts`
- Modify: `packages/http-client-transport/src/index.ts`
- Modify: `packages/http-server-transport/src/index.ts`

**Step 1: Write failing tests for traceparent**

Create `packages/otel/test/traceparent.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { formatTraceparent, parseTraceparent } from '../src/traceparent.js'

describe('formatTraceparent', () => {
  test('formats a traceparent header', () => {
    const result = formatTraceparent('0af7651916cd43dd8448eb211c80319c', '00f067aa0ba902b7', 1)
    expect(result).toBe('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01')
  })

  test('formats with zero flags', () => {
    const result = formatTraceparent('0af7651916cd43dd8448eb211c80319c', '00f067aa0ba902b7', 0)
    expect(result).toBe('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00')
  })
})

describe('parseTraceparent', () => {
  test('parses a valid traceparent header', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01')
    expect(result).toEqual({
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    })
  })

  test('returns undefined for invalid format', () => {
    expect(parseTraceparent('invalid')).toBeUndefined()
    expect(parseTraceparent('')).toBeUndefined()
    expect(parseTraceparent('00-short-00f067aa0ba902b7-01')).toBeUndefined()
  })

  test('returns undefined for unsupported version', () => {
    expect(
      parseTraceparent('ff-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01'),
    ).toBeUndefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL

**Step 3: Implement traceparent module**

Create `packages/otel/src/traceparent.ts`:

```typescript
export type TraceparentData = {
  traceId: string
  spanId: string
  traceFlags: number
}

const TRACEPARENT_REGEX = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/

/**
 * Format a W3C traceparent header value.
 */
export function formatTraceparent(traceId: string, spanId: string, traceFlags: number): string {
  return `00-${traceId}-${spanId}-${traceFlags.toString(16).padStart(2, '0')}`
}

/**
 * Parse a W3C traceparent header value. Returns undefined if invalid.
 */
export function parseTraceparent(header: string): TraceparentData | undefined {
  const match = TRACEPARENT_REGEX.exec(header)
  if (match == null) {
    return undefined
  }
  const [, version, traceId, spanId, flags] = match
  // Only support version 00
  if (version !== '00') {
    return undefined
  }
  return {
    traceId,
    spanId,
    traceFlags: Number.parseInt(flags, 16),
  }
}
```

**Step 4: Update index.ts**

Add to `packages/otel/src/index.ts`:
```typescript
export { formatTraceparent, parseTraceparent, type TraceparentData } from './traceparent.js'
```

**Step 5: Run tests**

Run: `cd packages/otel && pnpm run test`
Expected: All PASS

**Step 6: Integrate into HTTP client transport**

In `packages/http-client-transport/src/index.ts`, import:
```typescript
import { formatTraceparent, getActiveTraceContext } from '@enkaku/otel'
```

In `sendMessage`, add traceparent header to outgoing fetch requests:
```typescript
async function sendMessage(...): Promise<Response> {
  const span = tracer.startSpan(...)
  try {
    const traceCtx = getActiveTraceContext()
    const traceparentHeader = traceCtx != null
      ? { traceparent: formatTraceparent(traceCtx.traceID, traceCtx.spanID, traceCtx.traceFlags) }
      : {}
    const res = await fetch(params.url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: {
        ...HEADERS,
        ...traceparentHeader,
        ...(sessionID ? { 'enkaku-session-id': sessionID } : {}),
      },
    })
    // ... rest unchanged
  }
}
```

**Step 7: Integrate into HTTP server transport**

In `packages/http-server-transport/src/index.ts`, import:
```typescript
import { parseTraceparent } from '@enkaku/otel'
```

In the `handleRequest` function, extract traceparent from incoming request:
```typescript
async function handleRequest(request: Request): Promise<Response> {
  const traceparentHeader = request.headers.get('traceparent')
  const traceparentData = traceparentHeader != null ? parseTraceparent(traceparentHeader) : undefined
  const spanAttributes: Record<string, string> = {
    [AttributeKeys.HTTP_METHOD]: request.method,
    [AttributeKeys.TRANSPORT_TYPE]: 'http-server',
  }

  // Create span with traceparent as parent context if available
  let parentCtx: Context | undefined
  if (traceparentData != null) {
    parentCtx = extractTraceContext({
      tid: traceparentData.traceId,
      sid: traceparentData.spanId,
    })
  }

  const span = tracer.startSpan(SpanNames.TRANSPORT_HTTP_REQUEST, { attributes: spanAttributes }, parentCtx)
  // ... rest of function
}
```

Import `extractTraceContext` and `type Context` from `@enkaku/otel`.

**Step 8: Run all tests**

Run: `pnpm run build && pnpm run test`
Expected: All PASS

**Step 9: Commit**

```bash
git add packages/otel packages/http-client-transport packages/http-server-transport
git commit -m "feat: add W3C traceparent support for HTTP transports"
```

---

### Task 12: Verify full build and tests

**Step 1: Full build**

Run: `pnpm run build`
Expected: All packages build successfully

**Step 2: Full test suite**

Run: `pnpm run test`
Expected: All tests pass

**Step 3: Verify no remaining @opentelemetry/api imports in consuming packages**

Run: `grep -r "from '@opentelemetry" packages/*/src/ --include="*.ts" | grep -v "packages/otel/"`
Expected: No results

**Step 4: Verify no remaining @opentelemetry/api in package.json deps (except otel)**

Run: `grep -r "@opentelemetry/api" packages/*/package.json | grep -v "packages/otel/"`
Expected: No results

**Step 5: Commit if any cleanup was needed**

---

### Task 13: Lint and final commit

**Step 1: Run linter**

Run: `pnpm run lint`
Expected: All pass, or auto-fixed

**Step 2: Final verification**

Run: `pnpm run test`
Expected: All PASS

**Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "chore: lint fixes for otel integration"
```
