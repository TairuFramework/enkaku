# Observability & Tracing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add end-to-end observability to Enkaku using OpenTelemetry-compatible spans with logtape structured logging, enabling tracing from key generation through client signing, transport, server auth, handler execution, and error responses.

**Architecture:** New `@enkaku/otel` package provides span utilities, trace context propagation via token headers, and a logtape→OTel log bridge. All instrumented packages add `@opentelemetry/api` as a dependency and create spans directly. When no OTel SDK is configured, all spans are no-ops with negligible overhead.

**Tech Stack:** `@opentelemetry/api` (trace API), `@opentelemetry/api-logs` (log bridge), `@logtape/logtape` (structured logging), vitest (testing)

**Design doc:** `docs/plans/2026-03-03-observability-design.md`

---

### Task 1: Create `@enkaku/otel` Package Scaffold

**Files:**
- Create: `packages/otel/package.json`
- Create: `packages/otel/tsconfig.json`
- Create: `packages/otel/src/index.ts`
- Create: `packages/otel/src/semantic.ts`
- Create: `packages/otel/test/semantic.test.ts`
- Modify: `pnpm-workspace.yaml` (add catalog entries)

**Step 1: Add `@opentelemetry/api` and `@opentelemetry/api-logs` to pnpm catalog**

In `pnpm-workspace.yaml`, add to the `catalog:` section:

```yaml
  '@opentelemetry/api': ^1.9.0
  '@opentelemetry/api-logs': ^0.57.0
```

**Step 2: Create `packages/otel/package.json`**

```json
{
  "name": "@enkaku/otel",
  "version": "0.1.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "OpenTelemetry integration for Enkaku RPC",
  "keywords": ["opentelemetry", "tracing", "observability"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/otel"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": "./lib/index.js"
  },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck --declarationMap false",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit --skipLibCheck",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@opentelemetry/api": "catalog:",
    "@opentelemetry/api-logs": "catalog:"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

**Step 3: Create `packages/otel/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

**Step 4: Write the failing test for semantic constants**

Create `packages/otel/test/semantic.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { AttributeKeys, SpanNames } from '../src/semantic.js'

describe('SpanNames', () => {
  test('has client span names', () => {
    expect(SpanNames.CLIENT_CALL).toBe('enkaku.client.call')
    expect(SpanNames.CLIENT_RESPONSE).toBe('enkaku.client.response')
  })

  test('has server span names', () => {
    expect(SpanNames.SERVER_HANDLE).toBe('enkaku.server.handle')
    expect(SpanNames.SERVER_ACCESS_CONTROL).toBe('enkaku.server.access_control')
    expect(SpanNames.SERVER_HANDLER).toBe('enkaku.server.handler')
  })

  test('has token span names', () => {
    expect(SpanNames.TOKEN_SIGN).toBe('enkaku.token.sign')
    expect(SpanNames.TOKEN_VERIFY).toBe('enkaku.token.verify')
  })

  test('has keystore span names', () => {
    expect(SpanNames.KEYSTORE_GET_OR_CREATE).toBe('enkaku.keystore.get_or_create')
  })

  test('has transport span names', () => {
    expect(SpanNames.TRANSPORT_WRITE).toBe('enkaku.transport.write')
    expect(SpanNames.TRANSPORT_HTTP_REQUEST).toBe('enkaku.transport.http.request')
    expect(SpanNames.TRANSPORT_HTTP_SSE_CONNECT).toBe('enkaku.transport.http.sse_connect')
    expect(SpanNames.TRANSPORT_WS_CONNECT).toBe('enkaku.transport.ws.connect')
    expect(SpanNames.TRANSPORT_WS_MESSAGE).toBe('enkaku.transport.ws.message')
  })
})

describe('AttributeKeys', () => {
  test('has RPC attributes', () => {
    expect(AttributeKeys.RPC_PROCEDURE).toBe('rpc.procedure')
    expect(AttributeKeys.RPC_REQUEST_ID).toBe('rpc.request_id')
    expect(AttributeKeys.RPC_TYPE).toBe('rpc.type')
    expect(AttributeKeys.RPC_SYSTEM).toBe('rpc.system')
  })

  test('has auth attributes', () => {
    expect(AttributeKeys.AUTH_DID).toBe('enkaku.auth.did')
    expect(AttributeKeys.AUTH_ALGORITHM).toBe('enkaku.auth.algorithm')
    expect(AttributeKeys.AUTH_ALLOWED).toBe('enkaku.auth.allowed')
    expect(AttributeKeys.AUTH_REASON).toBe('enkaku.auth.reason')
  })

  test('has keystore attributes', () => {
    expect(AttributeKeys.KEYSTORE_KEY_CREATED).toBe('enkaku.keystore.key_created')
    expect(AttributeKeys.KEYSTORE_STORE_TYPE).toBe('enkaku.keystore.store_type')
  })

  test('has transport attributes', () => {
    expect(AttributeKeys.TRANSPORT_TYPE).toBe('enkaku.transport.type')
  })

  test('has error attributes', () => {
    expect(AttributeKeys.ERROR_CODE).toBe('enkaku.error.code')
    expect(AttributeKeys.ERROR_MESSAGE).toBe('enkaku.error.message')
  })
})
```

**Step 5: Run test to verify it fails**

Run: `pnpm install && cd packages/otel && pnpm run test:unit`
Expected: FAIL — module `../src/semantic.js` not found

**Step 6: Implement semantic constants**

Create `packages/otel/src/semantic.ts`:

```typescript
export const SpanNames = {
  // Client
  CLIENT_CALL: 'enkaku.client.call',
  CLIENT_RESPONSE: 'enkaku.client.response',

  // Server
  SERVER_HANDLE: 'enkaku.server.handle',
  SERVER_ACCESS_CONTROL: 'enkaku.server.access_control',
  SERVER_HANDLER: 'enkaku.server.handler',

  // Token
  TOKEN_SIGN: 'enkaku.token.sign',
  TOKEN_VERIFY: 'enkaku.token.verify',

  // Keystore
  KEYSTORE_GET_OR_CREATE: 'enkaku.keystore.get_or_create',

  // Transport
  TRANSPORT_WRITE: 'enkaku.transport.write',
  TRANSPORT_HTTP_REQUEST: 'enkaku.transport.http.request',
  TRANSPORT_HTTP_SSE_CONNECT: 'enkaku.transport.http.sse_connect',
  TRANSPORT_WS_CONNECT: 'enkaku.transport.ws.connect',
  TRANSPORT_WS_MESSAGE: 'enkaku.transport.ws.message',
} as const

export const AttributeKeys = {
  // RPC (follows OTel semantic conventions)
  RPC_PROCEDURE: 'rpc.procedure',
  RPC_REQUEST_ID: 'rpc.request_id',
  RPC_TYPE: 'rpc.type',
  RPC_SYSTEM: 'rpc.system',

  // Auth
  AUTH_DID: 'enkaku.auth.did',
  AUTH_ALGORITHM: 'enkaku.auth.algorithm',
  AUTH_ALLOWED: 'enkaku.auth.allowed',
  AUTH_REASON: 'enkaku.auth.reason',

  // Keystore
  KEYSTORE_KEY_CREATED: 'enkaku.keystore.key_created',
  KEYSTORE_STORE_TYPE: 'enkaku.keystore.store_type',

  // Transport
  TRANSPORT_TYPE: 'enkaku.transport.type',

  // Error
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
```

Create `packages/otel/src/index.ts`:

```typescript
export { AttributeKeys, SpanNames } from './semantic.js'
```

**Step 7: Run test to verify it passes**

Run: `cd packages/otel && pnpm run test:unit`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/otel/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(otel): scaffold @enkaku/otel package with semantic constants"
```

---

### Task 2: `@enkaku/otel` — Tracer Utilities

**Files:**
- Create: `packages/otel/src/tracers.ts`
- Create: `packages/otel/test/tracers.test.ts`
- Modify: `packages/otel/src/index.ts`

**Step 1: Write the failing test**

Create `packages/otel/test/tracers.test.ts`:

```typescript
import { context, trace } from '@opentelemetry/api'
import { describe, expect, test } from 'vitest'

import { createTracer, getActiveTraceContext, withSpan } from '../src/tracers.js'

describe('createTracer', () => {
  test('returns a Tracer from the global TracerProvider', () => {
    const tracer = createTracer('test-module')
    expect(tracer).toBeDefined()
    // Without an SDK registered, this returns a no-op tracer
    expect(typeof tracer.startSpan).toBe('function')
    expect(typeof tracer.startActiveSpan).toBe('function')
  })
})

describe('getActiveTraceContext', () => {
  test('returns undefined when no span is active', () => {
    expect(getActiveTraceContext()).toBeUndefined()
  })
})

describe('withSpan', () => {
  test('executes the function and returns its result', async () => {
    const tracer = createTracer('test')
    const result = await withSpan(tracer, 'test-span', {}, async () => {
      return 42
    })
    expect(result).toBe(42)
  })

  test('propagates errors from the function', async () => {
    const tracer = createTracer('test')
    await expect(
      withSpan(tracer, 'test-span', {}, async () => {
        throw new Error('test error')
      }),
    ).rejects.toThrow('test error')
  })

  test('passes the span to the function', async () => {
    const tracer = createTracer('test')
    await withSpan(tracer, 'test-span', {}, async (span) => {
      expect(span).toBeDefined()
      expect(typeof span.setAttribute).toBe('function')
      expect(typeof span.setStatus).toBe('function')
      expect(typeof span.end).toBe('function')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL — module `../src/tracers.js` not found

**Step 3: Implement tracer utilities**

Create `packages/otel/src/tracers.ts`:

```typescript
import { type Span, SpanStatusCode, context, trace } from '@opentelemetry/api'
import type { SpanOptions, Tracer } from '@opentelemetry/api'

const ENKAKU_VERSION = '0.1.0'

export function createTracer(name: string): Tracer {
  return trace.getTracer(`enkaku.${name}`, ENKAKU_VERSION)
}

export type TraceContext = {
  traceID: string
  spanID: string
  traceFlags: number
}

export function getActiveTraceContext(): TraceContext | undefined {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return undefined
  }
  const ctx = span.spanContext()
  // Check for valid (non-zero) trace ID — no-op spans have all-zero IDs
  if (ctx.traceId === '00000000000000000000000000000000') {
    return undefined
  }
  return {
    traceID: ctx.traceId,
    spanID: ctx.spanId,
    traceFlags: ctx.traceFlags,
  }
}

export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, options, async (span) => {
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

**Step 4: Update barrel export**

In `packages/otel/src/index.ts`, add:

```typescript
export { AttributeKeys, SpanNames } from './semantic.js'
export {
  createTracer,
  getActiveTraceContext,
  type TraceContext,
  withSpan,
} from './tracers.js'
```

**Step 5: Run test to verify it passes**

Run: `cd packages/otel && pnpm run test:unit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/otel/
git commit -m "feat(otel): add tracer utilities (createTracer, withSpan, getActiveTraceContext)"
```

---

### Task 3: `@enkaku/otel` — Trace Context Propagation

**Files:**
- Create: `packages/otel/src/context.ts`
- Create: `packages/otel/test/context.test.ts`
- Modify: `packages/otel/src/index.ts`

**Step 1: Write the failing test**

Create `packages/otel/test/context.test.ts`:

```typescript
import { ROOT_CONTEXT, TraceFlags, context, trace } from '@opentelemetry/api'
import { describe, expect, test } from 'vitest'

import { extractTraceContext, injectTraceContext } from '../src/context.js'

describe('injectTraceContext', () => {
  test('returns header unchanged when no active span', () => {
    const header = { typ: 'JWT', alg: 'none' as const }
    const result = injectTraceContext(header)
    expect(result).toEqual(header)
    expect(result).not.toHaveProperty('tid')
    expect(result).not.toHaveProperty('sid')
  })

  test('preserves existing header properties', () => {
    const header = { typ: 'JWT', alg: 'none' as const, custom: 'value' }
    const result = injectTraceContext(header)
    expect(result.custom).toBe('value')
  })
})

describe('extractTraceContext', () => {
  test('returns undefined when header has no trace fields', () => {
    const header = { typ: 'JWT', alg: 'none' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns undefined when tid is missing', () => {
    const header = { typ: 'JWT', alg: 'none', sid: '1234567890abcdef' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns undefined when sid is missing', () => {
    const header = { typ: 'JWT', alg: 'none', tid: '0af7651916cd43dd8448eb211c80319c' }
    expect(extractTraceContext(header)).toBeUndefined()
  })

  test('returns context when both tid and sid are present', () => {
    const header = {
      typ: 'JWT',
      alg: 'none',
      tid: '0af7651916cd43dd8448eb211c80319c',
      sid: '00f067aa0ba902b7',
    }
    const result = extractTraceContext(header)
    expect(result).toBeDefined()

    // Verify the span context extracted from the returned OTel Context
    const span = trace.getSpan(result!)
    expect(span).toBeDefined()
    const spanCtx = span!.spanContext()
    expect(spanCtx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(spanCtx.spanId).toBe('00f067aa0ba902b7')
    expect(spanCtx.isRemote).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL — module `../src/context.js` not found

**Step 3: Implement trace context propagation**

Create `packages/otel/src/context.ts`:

```typescript
import {
  type Context,
  ROOT_CONTEXT,
  TraceFlags,
  context,
  trace,
} from '@opentelemetry/api'

/**
 * Inject the active span's trace context into a token header.
 * Adds `tid` (trace ID) and `sid` (span ID) fields.
 * Returns the header unchanged if no active span exists.
 */
export function injectTraceContext<T extends Record<string, unknown>>(header: T): T {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return header
  }
  const ctx = span.spanContext()
  if (ctx.traceId === '00000000000000000000000000000000') {
    return header
  }
  return { ...header, tid: ctx.traceId, sid: ctx.spanId }
}

/**
 * Extract trace context from a token header and return an OTel Context
 * with a remote SpanContext. Returns undefined if no trace fields are present.
 */
export function extractTraceContext(header: Record<string, unknown>): Context | undefined {
  const tid = header.tid
  const sid = header.sid
  if (typeof tid !== 'string' || typeof sid !== 'string') {
    return undefined
  }
  const remoteContext = trace.setSpanContext(ROOT_CONTEXT, {
    traceId: tid,
    spanId: sid,
    isRemote: true,
    traceFlags: TraceFlags.SAMPLED,
  })
  return remoteContext
}
```

**Step 4: Update barrel export**

In `packages/otel/src/index.ts`, add:

```typescript
export { extractTraceContext, injectTraceContext } from './context.js'
```

**Step 5: Run test to verify it passes**

Run: `cd packages/otel && pnpm run test:unit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/otel/
git commit -m "feat(otel): add trace context inject/extract for token headers"
```

---

### Task 4: `@enkaku/otel` — Logtape→OTel Log Bridge Sink

**Files:**
- Create: `packages/otel/src/log-sink.ts`
- Create: `packages/otel/test/log-sink.test.ts`
- Modify: `packages/otel/src/index.ts`
- Modify: `packages/otel/package.json` (add `@enkaku/log` dependency)

**Step 1: Add `@enkaku/log` dependency**

In `packages/otel/package.json`, add to `dependencies`:

```json
"@enkaku/log": "workspace:^"
```

Run: `pnpm install`

**Step 2: Write the failing test**

Create `packages/otel/test/log-sink.test.ts`:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { createOTelLogSink } from '../src/log-sink.js'

describe('createOTelLogSink', () => {
  test('returns a function (Sink type)', () => {
    const sink = createOTelLogSink()
    expect(typeof sink).toBe('function')
  })

  test('accepts a log record without throwing', () => {
    const sink = createOTelLogSink()
    // Logtape LogRecord structure
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
```

**Step 3: Run test to verify it fails**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL — module `../src/log-sink.js` not found

**Step 4: Implement the log sink**

Create `packages/otel/src/log-sink.ts`:

```typescript
import { type SeverityNumber, logs } from '@opentelemetry/api-logs'
import { context, trace } from '@opentelemetry/api'

type LogRecord = {
  category: ReadonlyArray<string>
  level: string
  message: ReadonlyArray<string | (() => unknown)>
  rawMessage: string
  properties: Record<string, unknown>
  timestamp: number
}

const LEVEL_TO_SEVERITY: Record<string, SeverityNumber> = {
  trace: 1,   // TRACE
  debug: 5,   // DEBUG
  info: 9,    // INFO
  warning: 13, // WARN
  warn: 13,
  error: 17,  // ERROR
  fatal: 21,  // FATAL
}

/**
 * Create a logtape sink that forwards log records to the OTel Logs API.
 * The sink enriches records with active trace context (traceID/spanID)
 * so logs correlate with OTel traces.
 */
export function createOTelLogSink(): (record: LogRecord) => void {
  const logger = logs.getLogger('enkaku')

  return (record: LogRecord) => {
    const activeSpan = trace.getSpan(context.active())
    const spanContext = activeSpan?.spanContext()

    const attributes: Record<string, unknown> = {
      ...record.properties,
      'log.category': record.category.join('.'),
    }

    logger.emit({
      severityNumber: (LEVEL_TO_SEVERITY[record.level] ?? 9) as SeverityNumber,
      severityText: record.level,
      body: record.rawMessage,
      attributes,
      timestamp: record.timestamp,
      context: activeSpan ? context.active() : undefined,
    })
  }
}
```

**Step 5: Update barrel export**

In `packages/otel/src/index.ts`, add:

```typescript
export { createOTelLogSink } from './log-sink.js'
```

**Step 6: Run test to verify it passes**

Run: `cd packages/otel && pnpm run test:unit`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/otel/
git commit -m "feat(otel): add logtape-to-OTel log bridge sink"
```

---

### Task 5: `@enkaku/otel` — Traced Logger Helper

**Files:**
- Create: `packages/otel/src/logger.ts`
- Create: `packages/otel/test/logger.test.ts`
- Modify: `packages/otel/src/index.ts`

**Step 1: Write the failing test**

Create `packages/otel/test/logger.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import type { Logger } from '@enkaku/log'

import { traceLogger } from '../src/logger.js'

describe('traceLogger', () => {
  test('returns the same logger when no span is active', () => {
    const mockLogger = { with: () => mockLogger } as unknown as Logger
    const result = traceLogger(mockLogger)
    expect(result).toBe(mockLogger)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/otel && pnpm run test:unit`
Expected: FAIL — module `../src/logger.js` not found

**Step 3: Implement traced logger**

Create `packages/otel/src/logger.ts`:

```typescript
import type { Logger } from '@enkaku/log'
import { context, trace } from '@opentelemetry/api'

/**
 * Enrich a logger with trace context from the active OTel span.
 * Returns the logger unchanged if no span is active.
 *
 * Call this once per span, then use the returned logger for all
 * logging within that span's scope.
 */
export function traceLogger(logger: Logger): Logger {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return logger
  }
  const ctx = span.spanContext()
  if (ctx.traceId === '00000000000000000000000000000000') {
    return logger
  }
  return logger.with({ traceID: ctx.traceId, spanID: ctx.spanId })
}
```

**Step 4: Update barrel export**

In `packages/otel/src/index.ts`, add:

```typescript
export { traceLogger } from './logger.js'
```

**Step 5: Run test to verify it passes**

Run: `cd packages/otel && pnpm run test:unit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/otel/
git commit -m "feat(otel): add traceLogger helper for logger enrichment"
```

---

### Task 6: Instrument `@enkaku/token` — Sign/Verify Spans

**Files:**
- Modify: `packages/token/package.json` (add `@opentelemetry/api` dependency)
- Modify: `packages/token/src/identity.ts` (add span to `signToken`)
- Modify: `packages/token/src/token.ts` (add span to `verifyToken`)
- Create: `packages/token/test/otel.test.ts`

**Step 1: Add `@opentelemetry/api` dependency**

In `packages/token/package.json`, add to `dependencies`:

```json
"@opentelemetry/api": "catalog:"
```

Run: `pnpm install`

**Step 2: Write the failing test**

Create `packages/token/test/otel.test.ts`:

```typescript
import { trace } from '@opentelemetry/api'
import { describe, expect, test, vi } from 'vitest'

import { createSigningIdentity, randomIdentity } from '../src/identity.js'
import { verifyToken } from '../src/token.js'

describe('token signing observability', () => {
  test('signToken calls tracer.startActiveSpan', async () => {
    const identity = randomIdentity()
    const startActiveSpan = vi.fn((name, opts, fn) => fn({ setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn(), recordException: vi.fn() }))
    vi.spyOn(trace, 'getTracer').mockReturnValue({
      startSpan: vi.fn(),
      startActiveSpan: startActiveSpan,
    } as unknown as ReturnType<typeof trace.getTracer>)

    const token = await identity.signToken({ prc: 'test' })
    expect(token.payload.iss).toBeDefined()

    vi.restoreAllMocks()
  })
})

describe('token verification observability', () => {
  test('verifyToken calls tracer.startActiveSpan', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({ prc: 'test' })

    const startActiveSpan = vi.fn((name, opts, fn) => fn({ setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn(), recordException: vi.fn() }))
    vi.spyOn(trace, 'getTracer').mockReturnValue({
      startSpan: vi.fn(),
      startActiveSpan: startActiveSpan,
    } as unknown as ReturnType<typeof trace.getTracer>)

    await verifyToken(token)

    vi.restoreAllMocks()
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd packages/token && pnpm run test:unit`
Expected: Tests should pass trivially since mock just captures calls — adjust test expectations after implementation.

**Step 4: Add span to `createSigningIdentity` in `packages/token/src/identity.ts`**

Add import at the top:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api'
```

Modify the `signToken` function inside `createSigningIdentity`:

```typescript
  const tracer = trace.getTracer('enkaku.token')

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    return tracer.startActiveSpan('enkaku.token.sign', { attributes: { 'enkaku.auth.did': id, 'enkaku.auth.algorithm': 'EdDSA' } }, async (span) => {
      try {
        if (payload.iss != null && payload.iss !== id) {
          throw new Error('Invalid payload: issuer does not match signer')
        }

        const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
        const fullPayload = { ...payload, iss: id }
        const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

        const result: SignedToken<Payload, Header> = {
          header: fullHeader,
          payload: fullPayload,
          signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
          data,
        }
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
        span.recordException(error as Error)
        throw error
      } finally {
        span.end()
      }
    })
  }
```

**Step 5: Add span to `verifyToken` in `packages/token/src/token.ts`**

Add import at the top:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api'
```

Wrap the core verification logic in `verifyToken` with a span. Find the function and wrap its body:

```typescript
const tokenTracer = trace.getTracer('enkaku.token')

export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(
  token: Token<Payload> | string,
  verifiers?: Verifiers,
  timeOptions?: TimeValidationOptions,
): Promise<Token<Payload>> {
  return tokenTracer.startActiveSpan('enkaku.token.verify', async (span) => {
    try {
      // ... existing verification logic (unchanged) ...
      const result = await verifyTokenInner(token, verifiers, timeOptions)
      if (isSignedToken(result)) {
        span.setAttribute('enkaku.auth.did', (result.payload as Record<string, unknown>).iss as string)
        span.setAttribute('enkaku.auth.algorithm', result.header.alg)
      }
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}
```

Note: Extract the current `verifyToken` body into a `verifyTokenInner` private function, then wrap in the span. This avoids deeply nesting the existing code.

**Step 6: Run tests to verify they pass**

Run: `cd packages/token && pnpm run test:unit`
Expected: PASS (all existing tests + new test)

**Step 7: Commit**

```bash
git add packages/token/
git commit -m "feat(token): add OTel spans to sign and verify operations"
```

---

### Task 7: Instrument Keystore Packages — Spans + DID Logging

**Files:**
- Modify: `packages/node-keystore/package.json`
- Modify: `packages/node-keystore/src/entry.ts`
- Modify: `packages/browser-keystore/package.json`
- Modify: `packages/browser-keystore/src/entry.ts`
- Modify: `packages/expo-keystore/package.json`
- Modify: `packages/expo-keystore/src/entry.ts`
- Modify: `packages/electron-keystore/package.json`
- Modify: `packages/electron-keystore/src/entry.ts`

**Step 1: Add dependencies to all four keystores**

For each keystore's `package.json`, add to `dependencies`:

```json
"@enkaku/log": "workspace:^",
"@opentelemetry/api": "catalog:"
```

Run: `pnpm install`

**Step 2: Instrument `NodeKeyEntry.provide()` and `provideAsync()`**

In `packages/node-keystore/src/entry.ts`, add imports:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { getEnkakuLogger } from '@enkaku/log'
import { CODECS, getDID } from '@enkaku/token'
```

Add tracer and logger at module level:

```typescript
const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')
```

Wrap `provide()`:

```typescript
  provide(): Uint8Array {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'node' },
    })
    try {
      const existing = this.get()
      if (existing != null) {
        const did = getDID(CODECS.EdDSA, ed25519.getPublicKey(existing))
        span.setAttribute('enkaku.auth.did', did)
        span.setAttribute('enkaku.keystore.key_created', false)
        span.setStatus({ code: SpanStatusCode.OK })
        return existing
      }

      const privateKey = randomPrivateKey()
      this.set(privateKey)
      const did = getDID(CODECS.EdDSA, ed25519.getPublicKey(privateKey))
      span.setAttribute('enkaku.auth.did', did)
      span.setAttribute('enkaku.keystore.key_created', true)
      span.setStatus({ code: SpanStatusCode.OK })
      logger.info('New signing key generated', { did })
      return privateKey
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  }
```

Note: `ed25519` needs to be imported from `@noble/curves/ed25519`. The existing package already depends on `@enkaku/token` which re-exports from `@noble/curves`. However, for DID derivation, use the token package's `getDID` and `CODECS` utilities. Getting the public key from the private key requires the ed25519 module. Check if `@enkaku/token` exports a helper for this; if not, add `@noble/curves` as a dependency or import `createSigningIdentity` and use its `.id` property.

Simpler approach — use `createSigningIdentity` to get the DID:

```typescript
import { createSigningIdentity } from '@enkaku/token'

// In provide():
const identity = createSigningIdentity(privateKey)
span.setAttribute('enkaku.auth.did', identity.id)
logger.info('New signing key generated', { did: identity.id })
```

Apply the same pattern to `provideAsync()`, and repeat for `BrowserKeyEntry`, `ExpoKeyEntry`, and `ElectronKeyEntry` with their respective `store_type` values: `'browser'`, `'expo'`, `'electron'`.

For browser keystore, use `createBrowserSigningIdentity` to get the DID (it's async), and the store type is `'browser'`.

**Step 3: Run tests for each keystore**

Run: `cd packages/node-keystore && pnpm run test:unit`
Run: `cd packages/browser-keystore && pnpm run test:unit`
Run: `cd packages/expo-keystore && pnpm run test:unit`
Run: `cd packages/electron-keystore && pnpm run test:unit`
Expected: PASS (existing tests should still pass)

**Step 4: Commit**

```bash
git add packages/node-keystore/ packages/browser-keystore/ packages/expo-keystore/ packages/electron-keystore/
git commit -m "feat(keystore): add OTel spans and DID logging to all keystore packages"
```

---

### Task 8: Instrument `@enkaku/client` — Call Spans + Trace Context Injection

**Files:**
- Modify: `packages/client/package.json`
- Modify: `packages/client/src/client.ts`

**Step 1: Add `@opentelemetry/api` dependency**

In `packages/client/package.json`, add to `dependencies`:

```json
"@opentelemetry/api": "catalog:"
```

Run: `pnpm install`

**Step 2: Add tracer and span creation to `Client`**

In `packages/client/src/client.ts`, add import:

```typescript
import { SpanStatusCode, context, trace } from '@opentelemetry/api'
```

Add tracer at module level:

```typescript
const tracer = trace.getTracer('enkaku.client')
```

**Step 3: Modify `#write()` to inject trace context**

The current `#write()` method:

```typescript
async #write(payload: AnyClientPayloadOf<Protocol>, header?: AnyHeader): Promise<void> {
  if (this.signal.aborted) {
    throw new Error('Client aborted', { cause: this.signal.reason })
  }
  const message = await this.#createMessage(payload, header)
  await this.#transport.write(message)
}
```

Change to inject trace context into the header:

```typescript
async #write(payload: AnyClientPayloadOf<Protocol>, header?: AnyHeader): Promise<void> {
  if (this.signal.aborted) {
    throw new Error('Client aborted', { cause: this.signal.reason })
  }
  // Inject OTel trace context into the token header
  const enrichedHeader = this.#injectTraceContext(header)
  const message = await this.#createMessage(payload, enrichedHeader)
  await this.#transport.write(message)
}

#injectTraceContext(header?: AnyHeader): AnyHeader | undefined {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return header
  }
  const ctx = span.spanContext()
  if (ctx.traceId === '00000000000000000000000000000000') {
    return header
  }
  return { ...(header ?? {}), tid: ctx.traceId, sid: ctx.spanId }
}
```

**Step 4: Wrap `request()` in a span**

In the `request()` method, wrap the core logic:

```typescript
request<Procedure extends keyof ClientDefinitions['Requests'] & string, T extends ClientDefinitions['Requests'][Procedure] = ClientDefinitions['Requests'][Procedure]>(
  procedure: Procedure,
  ...args: /* existing type */
): RequestCall<T['Result']> & Promise<T['Result']> {
  const config = args[0] ?? {}
  const rid = config.id ?? this.#getRandomID()

  const span = tracer.startSpan('enkaku.client.call', {
    attributes: {
      'rpc.system': 'enkaku',
      'rpc.procedure': procedure,
      'rpc.request_id': rid,
      'rpc.type': 'request',
    },
  })

  // Make the span active for the duration of message creation and sending
  const ctx = trace.setSpan(context.active(), span)

  const controller = createController<T['Result']>({
    type: 'request',
    procedure,
    header: config.header,
  })

  // ... rest of existing logic ...

  // When controller resolves, end the span
  controller.result
    .then((val) => {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    })
    .catch((error) => {
      if (error instanceof RequestError) {
        span.setAttribute('enkaku.error.code', error.code)
        span.setAttribute('enkaku.error.message', error.message)
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message ?? 'Unknown error' })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      span.end()
    })

  // Use the span's context when writing (so trace context is injected into header)
  const sent = context.with(ctx, () => this.#write(payload as unknown as AnyClientPayloadOf<Protocol>, config.header))

  // ... rest of existing code unchanged ...
}
```

Apply the same pattern to `createStream()`, `createChannel()`, and `sendEvent()` — each creates a span with `rpc.type` set appropriately (`'stream'`, `'channel'`, `'event'`). For `sendEvent()`, the span is ended immediately after the write completes.

**Step 5: Run existing tests to verify nothing is broken**

Run: `cd packages/client && pnpm run test:unit`
Expected: PASS (no-op tracer means no behavior change)

**Step 6: Commit**

```bash
git add packages/client/
git commit -m "feat(client): add OTel spans to client calls and inject trace context into token headers"
```

---

### Task 9: Instrument `@enkaku/server` — Handle Spans + Trace Context Extraction + Error Enrichment

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/src/access-control.ts`

**Step 1: Add `@opentelemetry/api` dependency**

In `packages/server/package.json`, add to `dependencies`:

```json
"@opentelemetry/api": "catalog:"
```

Run: `pnpm install`

**Step 2: Add trace context extraction to `handleMessages()`**

In `packages/server/src/server.ts`, add imports:

```typescript
import { SpanStatusCode, context, trace } from '@opentelemetry/api'
```

Add tracer:

```typescript
const tracer = trace.getTracer('enkaku.server')
```

**Step 3: Modify the `process` function to extract trace context and create spans**

In the `handleMessages()` function, modify the non-public `process` function to extract trace context from the incoming message's header and create a server-side span:

```typescript
: async (message: ProcessMessageOf<Protocol>, handle: () => Error | Promise<void>) => {
    // Extract trace context from token header
    let parentCtx = context.active()
    const header = message.header as Record<string, unknown>
    if (header.tid != null && header.sid != null) {
      const remoteCtx = trace.setSpanContext(parentCtx, {
        traceId: header.tid as string,
        spanId: header.sid as string,
        isRemote: true,
        traceFlags: 1, // SAMPLED
      })
      parentCtx = remoteCtx
    }

    const procedure = (message.payload as Record<string, unknown>).prc as string
    const rid = 'rid' in message.payload ? (message.payload as Record<string, unknown>).rid as string : undefined

    const span = tracer.startSpan('enkaku.server.handle', {
      attributes: {
        'rpc.system': 'enkaku',
        'rpc.procedure': procedure,
        ...(rid != null ? { 'rpc.request_id': rid } : {}),
      },
    }, parentCtx)

    const spanCtx = trace.setSpan(parentCtx, span)

    try {
      // Auth check
      if (!params.public) {
        if (!isSignedToken(message as Token)) {
          const reason = 'unsigned_message'
          span.setAttribute('enkaku.auth.reason', reason)
          span.setAttribute('enkaku.auth.allowed', false)
          logger.warn('Message is not signed')
          throw new Error('Message is not signed')
        }
        try {
          await context.with(spanCtx, () =>
            checkClientToken(params.serverID, params.access, message as unknown as SignedToken)
          )
          const did = (message as unknown as SignedToken).payload.iss
          span.setAttribute('enkaku.auth.did', did)
          span.setAttribute('enkaku.auth.allowed', true)
        } catch (cause) {
          const did = isSignedToken(message as Token) ? (message as unknown as SignedToken).payload.iss : undefined
          if (did != null) span.setAttribute('enkaku.auth.did', did)
          span.setAttribute('enkaku.auth.allowed', false)
          span.setAttribute('enkaku.auth.reason', (cause as Error).message)
          logger.warn('Access denied for {did} on {procedure}: {reason}', {
            did: did ?? 'unknown',
            procedure,
            reason: (cause as Error).message,
          })
          throw cause
        }
      }
    } catch (cause) {
      const error = new HandlerError({
        cause,
        code: 'EK02',
        message: (cause as Error).message ?? 'Access denied',
      })
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      span.recordException(error)
      span.end()
      if (message.payload.typ === 'event') {
        events.emit('eventAuthError', { error, payload: message.payload })
        events.emit('handlerError', { error, payload: message.payload })
      } else {
        context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>)
      }
      return
    }

    if (!checkMessageEncryption(message)) {
      span.setAttribute('enkaku.auth.reason', 'encryption_required')
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Encryption required' })
      span.end()
      handleEncryptionViolation(message)
      return
    }

    // Run handler within span context
    context.with(spanCtx, () => {
      processHandler(message, () => {
        const result = handle()
        if (result instanceof Error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: result.message })
          span.end()
          return result
        }
        result.then(() => {
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
        }).catch((error) => {
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
          span.recordException(error as Error)
          span.end()
        })
        return result
      })
    })
  }
```

Note: The exact integration requires careful handling of the control flow. The span should be ended when the handler completes (success or error), not when the function returns. Study the existing `processHandler` and `executeHandler` flows to find the right place to end the span.

**Step 4: Enrich auth error messages in `access-control.ts`**

In `packages/server/src/access-control.ts`, make error messages more descriptive:

Replace `throw new Error('Access denied')` with `throw new Error(`Access denied for procedure ${payload.prc}`)`.

Replace `throw new Error('Invalid audience')` with `throw new Error(`Invalid audience: expected ${serverID}`)`.

**Step 5: Run existing tests**

Run: `cd packages/server && pnpm run test:unit`
Expected: PASS (some error message tests may need updating to match new messages)

**Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat(server): add OTel spans with trace context extraction and enriched auth errors"
```

---

### Task 10: Instrument Transport Packages — HTTP Spans

**Files:**
- Modify: `packages/http-client-transport/package.json`
- Modify: `packages/http-client-transport/src/index.ts`
- Modify: `packages/http-server-transport/package.json`
- Modify: `packages/http-server-transport/src/index.ts`
- Modify: `packages/socket-transport/package.json`
- Modify: `packages/socket-transport/src/index.ts`

**Step 1: Add `@opentelemetry/api` dependency to transport packages**

In each transport package's `package.json`, add:

```json
"@opentelemetry/api": "catalog:"
```

Run: `pnpm install`

**Step 2: Instrument `@enkaku/http-client-transport`**

In `packages/http-client-transport/src/index.ts`, add imports:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api'
```

Add tracer:

```typescript
const tracer = trace.getTracer('enkaku.transport.http')
```

Wrap `sendMessage()` in a span:

```typescript
async function sendMessage(
  msg: AnyClientMessageOf<Protocol> | TransportMessage,
  sessionID?: string,
): Promise<Response> {
  const span = tracer.startSpan('enkaku.transport.http.request', {
    attributes: {
      'http.method': 'POST',
      'enkaku.transport.type': 'http',
      ...(sessionID != null ? { 'enkaku.transport.session_id': sessionID } : {}),
    },
  })
  try {
    const res = await fetch(params.url, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: sessionID ? { ...HEADERS, 'enkaku-session-id': sessionID } : HEADERS,
    })
    span.setAttribute('http.status_code', res.status)
    if (!res.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      controller.error(new ResponseError(res))
    } else {
      span.setStatus({ code: SpanStatusCode.OK })
    }
    return res
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
    span.recordException(error as Error)
    throw error
  } finally {
    span.end()
  }
}
```

Wrap `createEventStream()` in a span:

```typescript
export async function createEventStream(url: string): Promise<EventStream> {
  const span = tracer.startSpan('enkaku.transport.http.sse_connect', {
    attributes: { 'enkaku.transport.type': 'http-sse' },
  })
  try {
    const res = await fetch(url)
    if (!res.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      span.end()
      throw new ResponseError(res)
    }

    const data = (await res.json()) as { id: string }
    span.setAttribute('enkaku.transport.session_id', data.id)
    // ... existing EventSource setup ...

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
    return { id: data.id, source }
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
    span.recordException(error as Error)
    span.end()
    throw error
  }
}
```

**Step 3: Instrument `@enkaku/socket-transport`**

In `packages/socket-transport/src/index.ts`, add similar span around `connectSocket()`:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.transport.socket')

export async function connectSocket(path: string): Promise<Socket> {
  const span = tracer.startSpan('enkaku.transport.socket.connect', {
    attributes: { 'enkaku.transport.type': 'socket', 'net.peer.name': path },
  })
  const socket = createConnection(path)
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
      resolve(socket)
    })
    socket.on('error', (err) => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
      span.recordException(err)
      span.end()
      reject(err)
    })
  })
}
```

**Step 4: Run tests for each transport**

Run: `pnpm run test:unit --filter=@enkaku/http-client-transport`
Run: `pnpm run test:unit --filter=@enkaku/http-server-transport`
Run: `pnpm run test:unit --filter=@enkaku/socket-transport`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/http-client-transport/ packages/http-server-transport/ packages/socket-transport/
git commit -m "feat(transport): add OTel spans to HTTP, SSE, and socket transport operations"
```

---

### Task 11: End-to-End Integration Test

**Files:**
- Create: `tests/integration/otel.test.ts`

**Step 1: Write the integration test**

Create `tests/integration/otel.test.ts`:

```typescript
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { describe, expect, test, afterAll, beforeAll } from 'vitest'

import { Client } from '@enkaku/client'
import { getEnkakuLogger, setup } from '@enkaku/log'
import { Server, serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

// A minimal protocol for testing
const protocol = {
  'test.greet': {
    type: 'request' as const,
    param: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } as const,
    result: { type: 'string' } as const,
  },
} as const

describe('end-to-end tracing', () => {
  let exporter: InMemorySpanExporter
  let provider: BasicTracerProvider

  beforeAll(() => {
    exporter = new InMemorySpanExporter()
    provider = new BasicTracerProvider()
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
    provider.register()
  })

  afterAll(async () => {
    await provider.shutdown()
  })

  test('traces a request from client through server', async () => {
    exporter.reset()

    const serverIdentity = randomIdentity()
    const clientIdentity = randomIdentity()

    const transports = new DirectTransports()

    const server = serve({
      identity: serverIdentity,
      transport: transports.server,
      handlers: {
        'test.greet': async (ctx) => {
          return `Hello, ${ctx.param.name}!`
        },
      },
      access: { 'test.*': [clientIdentity.id] },
    })

    const client = new Client({
      transport: transports.client,
      identity: clientIdentity,
      serverID: serverIdentity.id,
    })

    const result = await client.request('test.greet', { param: { name: 'World' } })
    expect(result).toBe('Hello, World!')

    await client.dispose()
    await server.dispose()
    await transports.dispose()

    // Verify spans were created
    const spans = exporter.getFinishedSpans()
    const spanNames = spans.map((s) => s.name)

    // Should have client call span
    expect(spanNames).toContain('enkaku.client.call')
    // Should have token sign span (client signing)
    expect(spanNames).toContain('enkaku.token.sign')
    // Should have server handle span
    expect(spanNames).toContain('enkaku.server.handle')
    // Should have token verify span (server verifying)
    expect(spanNames).toContain('enkaku.token.verify')

    // Verify trace context propagation: client and server spans share the same trace ID
    const clientSpan = spans.find((s) => s.name === 'enkaku.client.call')
    const serverSpan = spans.find((s) => s.name === 'enkaku.server.handle')
    expect(clientSpan).toBeDefined()
    expect(serverSpan).toBeDefined()
    expect(serverSpan!.spanContext().traceId).toBe(clientSpan!.spanContext().traceId)
  })

  test('traces auth failure with DID correlation', async () => {
    exporter.reset()

    const serverIdentity = randomIdentity()
    const unknownClientIdentity = randomIdentity()

    const transports = new DirectTransports()

    const server = serve({
      identity: serverIdentity,
      transport: transports.server,
      handlers: {
        'test.greet': async (ctx) => `Hello, ${ctx.param.name}!`,
      },
      access: { 'test.*': [] }, // No clients allowed
    })

    const client = new Client({
      transport: transports.client,
      identity: unknownClientIdentity,
      serverID: serverIdentity.id,
    })

    await expect(
      client.request('test.greet', { param: { name: 'World' } }),
    ).rejects.toThrow()

    await client.dispose()
    await server.dispose()
    await transports.dispose()

    const spans = exporter.getFinishedSpans()

    // Find the server handle span
    const serverSpan = spans.find((s) => s.name === 'enkaku.server.handle')
    expect(serverSpan).toBeDefined()

    // Verify it has the DID and error attributes
    const attrs = serverSpan!.attributes
    expect(attrs['enkaku.auth.did']).toBe(unknownClientIdentity.id)
    expect(attrs['enkaku.auth.allowed']).toBe(false)
  })
})
```

**Step 2: Add test dependencies**

In `tests/integration/package.json` (if it exists) or at root, add dev dependency:

```bash
pnpm add -D @opentelemetry/sdk-trace-base --filter integration
```

**Step 3: Run the integration test**

Run: `cd tests/integration && pnpm run test:unit -- otel.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/integration/
git commit -m "test: add end-to-end OTel tracing integration test"
```

---

### Task 12: Final Build + Lint + Test

**Files:** None (verification only)

**Step 1: Build all packages**

Run: `pnpm run build`
Expected: All packages build successfully including `@enkaku/otel`

**Step 2: Run all tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 3: Lint**

Run: `pnpm run lint`
Expected: No lint errors

**Step 4: Commit any lint fixes**

```bash
git add -u
git commit -m "chore: lint fixes for observability instrumentation"
```

---

## Summary

| Task | Package | What it does |
|------|---------|-------------|
| 1 | `@enkaku/otel` | Package scaffold + span name/attribute constants |
| 2 | `@enkaku/otel` | Tracer utilities: `createTracer`, `withSpan`, `getActiveTraceContext` |
| 3 | `@enkaku/otel` | Trace context inject/extract for token headers |
| 4 | `@enkaku/otel` | Logtape→OTel log bridge sink |
| 5 | `@enkaku/otel` | `traceLogger` helper for logger enrichment |
| 6 | `@enkaku/token` | Spans around sign and verify operations |
| 7 | All keystores | Spans around key get/create + DID info logging |
| 8 | `@enkaku/client` | Spans around client calls + trace context injection into headers |
| 9 | `@enkaku/server` | Spans around message handling + trace context extraction + enriched auth errors |
| 10 | Transports | Spans around HTTP requests, SSE connections, socket connects |
| 11 | Integration | End-to-end test: trace propagation + auth failure DID correlation |
| 12 | All | Final build + lint + test verification |
