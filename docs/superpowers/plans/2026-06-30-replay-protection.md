# Replay Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing

**Goal:** Deduplicate authenticated server messages so a captured signed message cannot be replayed within its validity window.

**Architecture:** A new `packages/server/src/replay.ts` module defines a pluggable `ReplayCache` interface, an in-memory default (`MemoryReplayCache`), a `ReplayOptions` config type, a `resolveReplay` factory, and a pure `checkReplay` gate. The `Server` resolves one server-wide cache in its constructor and runs `checkReplay` after `verifyToken` at the three signed-message entry points in `server.ts` (the `process` auth path, the `abort` case, the `send` case). Dedup key is `iss:jti` when `jti` is present, else `iss:signature`; both are inside the signed payload, so they cannot be tampered with. Eviction is bounded by token `exp` or a `maxAge` fallback.

**Tech Stack:** TypeScript, `@enkaku/server`, `@enkaku/protocol`, `@kokuin/token`, Vitest, pnpm.

## Global Constraints

- Use `type` not `interface`.
- No lowercase abbreviations in names: `ID`, `HTTP`, `JWT` (not `Id`/`Http`/`Jwt`).
- Use `Array<T>` not `T[]`.
- No `any` — use `unknown`, `Record<string, unknown>`, or a specific type.
- Use `pnpm`/`pnpx`, never `npm`/`npx`.
- Never edit generated files (`.gen.ts`, `__generated__/`, `lib/`).
- Wire error codes are stable: never renumber/reuse a code; append new ones.
- Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`).
- Token `exp`/`iat`/`nbf` claims are in **seconds** (JWT convention). Internal time math is in **milliseconds** — convert claims with `* 1000`.
- `SignedToken.signature` is a `string` at this layer.
- Tests live in `packages/server/test/`, run with `pnpm --filter @enkaku/server test:unit`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/server/src/replay.ts` | New. `ReplayCache`, `MemoryReplayCache`, `ReplayOptions`, `ResolvedReplay`, `resolveReplay`, `ReplayCheckResult`, `checkReplay`. |
| `packages/protocol/src/error-codes.ts` | Append `REPLAY_DETECTED: 'EK09'`. |
| `packages/server/src/server.ts` | Add `replay?: ReplayOptions` param; resolve a server-wide cache in the constructor; thread it through `handle` → `handleMessages`; call `checkReplay` at the 3 entry points. |
| `packages/server/src/index.ts` | Export `ReplayCache`, `MemoryReplayCache`, `ReplayOptions`. |
| `packages/server/test/replay.test.ts` | New. Unit tests for `MemoryReplayCache`, `checkReplay`, `resolveReplay`. |
| `packages/server/test/replay-server.test.ts` | New. Integration tests through a real `Server`. |

---

## Task 1: `MemoryReplayCache` and `ReplayCache` interface

**Files:**
- Create: `packages/server/src/replay.ts`
- Test: `packages/server/test/replay.test.ts`

**Interfaces:**
- Produces:
  - `type ReplayCache = { checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean> }`
  - `class MemoryReplayCache` with constructor `MemoryReplayCacheParams = { maxEntries?: number; now?: () => number }`, implementing `ReplayCache` synchronously.
  - `expiresAt` and the injected `now()` are epoch-milliseconds.

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/replay.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { MemoryReplayCache } from '../src/replay.js'

describe('MemoryReplayCache', () => {
  test('records a fresh key once and rejects a duplicate', () => {
    const cache = new MemoryReplayCache({ now: () => 1_000 })
    expect(cache.checkAndRecord('k1', 10_000)).toBe(true)
    expect(cache.checkAndRecord('k1', 10_000)).toBe(false)
  })

  test('treats an expired entry as fresh again', () => {
    let now = 1_000
    const cache = new MemoryReplayCache({ now: () => now })
    expect(cache.checkAndRecord('k1', 5_000)).toBe(true)
    now = 5_001 // past expiresAt
    expect(cache.checkAndRecord('k1', 9_000)).toBe(true)
  })

  test('enforces maxEntries by evicting oldest', () => {
    const cache = new MemoryReplayCache({ maxEntries: 2, now: () => 1_000 })
    expect(cache.checkAndRecord('a', 100_000)).toBe(true)
    expect(cache.checkAndRecord('b', 100_000)).toBe(true)
    expect(cache.checkAndRecord('c', 100_000)).toBe(true) // evicts 'a'
    expect(cache.checkAndRecord('a', 100_000)).toBe(true) // 'a' gone -> fresh
    expect(cache.checkAndRecord('b', 100_000)).toBe(false) // 'b' still present
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay.test.ts`
Expected: FAIL — cannot resolve `../src/replay.js`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/server/src/replay.ts`:

```ts
export type ReplayCache = {
  /**
   * Atomically check whether `key` was already recorded, and record it.
   * Returns `true` if fresh (first sight), `false` if a replay.
   * `expiresAt` is the epoch-millisecond time after which the entry may be evicted.
   */
  checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean>
}

export type MemoryReplayCacheParams = {
  maxEntries?: number
  now?: () => number
}

const DEFAULT_MAX_ENTRIES = 10_000

export class MemoryReplayCache implements ReplayCache {
  #entries = new Map<string, number>() // key -> expiresAt (epoch ms)
  #maxEntries: number
  #now: () => number

  constructor(params: MemoryReplayCacheParams = {}) {
    this.#maxEntries = params.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.#now = params.now ?? Date.now
  }

  checkAndRecord(key: string, expiresAt: number): boolean {
    const now = this.#now()
    const existing = this.#entries.get(key)
    if (existing != null && existing > now) {
      return false
    }
    // Delete-then-set keeps Map insertion order newest-last (LRU ordering).
    this.#entries.delete(key)
    this.#entries.set(key, expiresAt)
    this.#evict(now)
    return true
  }

  #evict(now: number): void {
    if (this.#entries.size <= this.#maxEntries) return
    // First drop expired entries.
    for (const [key, exp] of this.#entries) {
      if (exp <= now) this.#entries.delete(key)
      if (this.#entries.size <= this.#maxEntries) return
    }
    // Still over cap: evict oldest insertion-order entries.
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string
      this.#entries.delete(oldest)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/replay.ts packages/server/test/replay.test.ts
git commit -m "feat(server): add MemoryReplayCache for replay protection"
```

---

## Task 2: `checkReplay` gate, `ReplayOptions`, `resolveReplay`, and `EK09`

**Files:**
- Modify: `packages/protocol/src/error-codes.ts`
- Modify: `packages/server/src/replay.ts`
- Test: `packages/server/test/replay.test.ts`

**Interfaces:**
- Consumes: `ReplayCache`, `MemoryReplayCache` (Task 1); `SignedToken`, `normalizeDID` from `@kokuin/token`; `ErrorCodes.REPLAY_DETECTED` from `@enkaku/protocol`.
- Produces:
  - `type ReplayOptions = { enabled?: boolean; cache?: ReplayCache; maxAge?: number; rejectStale?: boolean; maxEntries?: number; now?: () => number }`
  - `type ResolvedReplay = { cache: ReplayCache; maxAge: number; rejectStale: boolean; now: () => number }`
  - `function resolveReplay(options: ReplayOptions | undefined, requireAuth: boolean): ResolvedReplay | null`
  - `type ReplayCheckResult = { ok: true } | { ok: false; reason: 'replay_detected' | 'replay_stale' }`
  - `function checkReplay(message: SignedToken, resolved: ResolvedReplay): Promise<ReplayCheckResult>`

- [ ] **Step 1: Add the `EK09` error code**

Edit `packages/protocol/src/error-codes.ts` — append inside the `ErrorCodes` object after `INVALID_MESSAGE`:

```ts
  /** EK08: Invalid protocol message (schema validation failed). */
  INVALID_MESSAGE: 'EK08',
  /** EK09: Replay detected (duplicate or stale authenticated message). */
  REPLAY_DETECTED: 'EK09',
} as const
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/server/test/replay.test.ts`:

```ts
import { ErrorCodes } from '@enkaku/protocol'
import type { SignedToken } from '@kokuin/token'

import { checkReplay, resolveReplay } from '../src/replay.js'

function makeMessage(payload: {
  iss?: string
  jti?: string
  exp?: number
  iat?: number
  signature?: string
}): SignedToken {
  return {
    data: 'x',
    header: {} as SignedToken['header'],
    payload: {
      iss: payload.iss ?? 'did:key:alice',
      jti: payload.jti,
      exp: payload.exp,
      iat: payload.iat,
    } as SignedToken['payload'],
    signature: payload.signature ?? 'sig-default',
  }
}

describe('resolveReplay', () => {
  test('returns null when auth is not required', () => {
    expect(resolveReplay(undefined, false)).toBeNull()
  })

  test('returns null when explicitly disabled', () => {
    expect(resolveReplay({ enabled: false }, true)).toBeNull()
  })

  test('fills defaults when enabled', () => {
    const resolved = resolveReplay(undefined, true)
    expect(resolved).not.toBeNull()
    expect(resolved?.maxAge).toBe(60_000)
    expect(resolved?.rejectStale).toBe(true)
    expect(resolved?.cache).toBeDefined()
  })
})

describe('checkReplay', () => {
  const base = { now: () => 1_000_000, exp: 2_000 } // exp seconds -> 2_000_000 ms > now

  test('accepts a fresh message and rejects its replay', async () => {
    const resolved = resolveReplay({ now: base.now }, true)!
    const message = makeMessage({ jti: 'j1', exp: base.exp })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_detected',
    })
  })

  test('keys on signature when jti is absent', async () => {
    const resolved = resolveReplay({ now: base.now }, true)!
    const a = makeMessage({ exp: base.exp, signature: 'sig-A' })
    const b = makeMessage({ exp: base.exp, signature: 'sig-B' })
    expect(await checkReplay(a, resolved)).toEqual({ ok: true })
    expect(await checkReplay(a, resolved)).toEqual({ ok: false, reason: 'replay_detected' })
    expect(await checkReplay(b, resolved)).toEqual({ ok: true })
  })

  test('rejects a message whose exp is in the past', async () => {
    const resolved = resolveReplay({ now: () => 5_000_000 }, true)!
    const message = makeMessage({ jti: 'j2', exp: 2_000 }) // 2_000_000 ms < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('rejects a message older than maxAge when it has no exp', async () => {
    const resolved = resolveReplay({ now: () => 1_000_000, maxAge: 60_000 }, true)!
    const message = makeMessage({ jti: 'j3', iat: 900 }) // 900_000 ms; +60s = 960_000 < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('accepts a stale message when rejectStale is false', async () => {
    const resolved = resolveReplay({ now: () => 1_000_000, rejectStale: false }, true)!
    const message = makeMessage({ jti: 'j4', iat: 900 })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
  })

  test('accepts again once the cache entry has expired', async () => {
    let now = 1_000_000
    const resolved = resolveReplay({ now: () => now }, true)!
    const message = makeMessage({ jti: 'j5', exp: 1_500 }) // expiresAt 1_500_000 ms
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    now = 1_600_000 // past expiresAt; also past exp, but rejectStale default would block — disable
    const resolvedNoStale = resolveReplay({ now: () => now, rejectStale: false, cache: resolved.cache }, true)!
    expect(await checkReplay(message, resolvedNoStale)).toEqual({ ok: true })
  })

  test('REPLAY_DETECTED error code is EK09', () => {
    expect(ErrorCodes.REPLAY_DETECTED).toBe('EK09')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay.test.ts`
Expected: FAIL — `checkReplay` / `resolveReplay` are not exported from `replay.js`.

- [ ] **Step 4: Implement `ReplayOptions`, `resolveReplay`, `checkReplay`**

Append to `packages/server/src/replay.ts`:

```ts
import { normalizeDID, type SignedToken } from '@kokuin/token'

export type ReplayOptions = {
  enabled?: boolean
  cache?: ReplayCache
  maxAge?: number // milliseconds; fallback window for messages without exp
  rejectStale?: boolean
  maxEntries?: number
  now?: () => number
}

export type ResolvedReplay = {
  cache: ReplayCache
  maxAge: number
  rejectStale: boolean
  now: () => number
}

const DEFAULT_MAX_AGE = 60_000

export function resolveReplay(
  options: ReplayOptions | undefined,
  requireAuth: boolean,
): ResolvedReplay | null {
  if (!requireAuth) return null
  if (options?.enabled === false) return null
  const now = options?.now ?? Date.now
  return {
    cache: options?.cache ?? new MemoryReplayCache({ maxEntries: options?.maxEntries, now }),
    maxAge: options?.maxAge ?? DEFAULT_MAX_AGE,
    rejectStale: options?.rejectStale ?? true,
    now,
  }
}

export type ReplayCheckResult =
  | { ok: true }
  | { ok: false; reason: 'replay_detected' | 'replay_stale' }

export async function checkReplay(
  message: SignedToken,
  resolved: ResolvedReplay,
): Promise<ReplayCheckResult> {
  const payload = message.payload as {
    iss: string
    jti?: string
    exp?: number
    iat?: number
  }
  const now = resolved.now()
  // Token exp/iat claims are seconds; convert to milliseconds for comparison.
  const expMs = payload.exp != null ? payload.exp * 1000 : undefined
  const iatMs = payload.iat != null ? payload.iat * 1000 : undefined

  if (resolved.rejectStale) {
    if (expMs != null) {
      if (now > expMs) return { ok: false, reason: 'replay_stale' }
    } else if (iatMs != null && now > iatMs + resolved.maxAge) {
      return { ok: false, reason: 'replay_stale' }
    }
  }

  const expiresAt = expMs ?? (iatMs ?? now) + resolved.maxAge
  const key = `${normalizeDID(payload.iss)}:${payload.jti ?? message.signature}`
  const fresh = await resolved.cache.checkAndRecord(key, expiresAt)
  return fresh ? { ok: true } : { ok: false, reason: 'replay_detected' }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay.test.ts`
Expected: PASS (all unit tests).

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src/error-codes.ts packages/server/src/replay.ts packages/server/test/replay.test.ts
git commit -m "feat(server): add checkReplay gate and EK09 replay error code"
```

---

## Task 3: Wire replay protection into the `Server`

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/test/replay-server.test.ts`

**Interfaces:**
- Consumes: `resolveReplay`, `checkReplay`, `ResolvedReplay`, `ReplayOptions`, `ReplayCache`, `MemoryReplayCache` (Tasks 1–2); existing `HandlerError`, `ErrorCodes`, `emitHandlerError`, `EnkakuAttributeKeys`, `SignedToken`.
- Produces: `Server`/`serve` accept `replay?: ReplayOptions`; default on when `requireAuth`, server-wide cache.

- [ ] **Step 1: Write the failing integration tests**

Create `packages/server/test/replay-server.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { MemoryReplayCache, type ProcedureHandlers, Server, serve } from '../src/index.js'

const protocol = {
  notify: { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

test('rejects a replayed signed event with EK09', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-1',
    exp: nowSeconds() + 300,
  } as const)

  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  const errorEvent = server.events.once('handlerError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK09' }),
      category: 'auth',
    }),
  )

  await server.dispose()
  await transports.dispose()
})

test('rejects a replay across two connections to the same server', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const t1 = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
  const t2 = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()

  const server = new Server<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transports: [t1.server, t2.server],
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-cross',
    exp: nowSeconds() + 300,
  } as const)

  await t1.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  const errorEvent = server.events.once('handlerError')
  await t2.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'EK09' }) }))

  await server.dispose()
  await t1.dispose()
  await t2.dispose()
})

test('rejects a stale message (no exp, old iat) when rejectStale is on', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
    replay: { maxAge: 1_000 },
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-stale',
    iat: nowSeconds() - 300, // 300s old, far beyond 1s maxAge; no exp
  } as const)

  const errorEvent = server.events.once('handlerError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'EK09' }) }))
  expect(handler).not.toHaveBeenCalled()

  await server.dispose()
  await transports.dispose()
})

test('replay: { enabled: false } disables protection', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const errorHandler = vi.fn()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
    replay: { enabled: false },
  })
  server.events.on('handlerError', errorHandler)

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-off',
    exp: nowSeconds() + 300,
  } as const)

  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  await server.dispose()
  await transports.dispose()

  expect(handler).toHaveBeenCalledTimes(2)
  expect(errorHandler).not.toHaveBeenCalled()
})

test('uses a custom cache when provided', async () => {
  const signer = randomIdentity()
  const handlers = { notify: vi.fn() } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const cache = new MemoryReplayCache()
  const spy = vi.spyOn(cache, 'checkAndRecord')

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
    replay: { cache },
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-custom',
    exp: nowSeconds() + 300,
  } as const)
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  await server.dispose()
  await transports.dispose()

  expect(spy).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay-server.test.ts`
Expected: FAIL — `replay` is not an accepted param / no EK09 emitted (duplicates currently pass).

- [ ] **Step 3: Add the `replay` param type and resolve it in the constructor**

In `packages/server/src/server.ts`:

a) Extend the imports from `./replay.js` (add near the other local imports, after the `./limits.js` import):

```ts
import { checkReplay, type ResolvedReplay, resolveReplay, type ReplayOptions } from './replay.js'
```

b) Add `replay?: ReplayOptions` to `ServerBaseParams`:

```ts
export type ServerBaseParams<Protocol extends ProtocolDefinition> = {
  cache?: DIDCache
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  runtime?: Runtime
  handlers: ProcedureHandlers<Protocol>
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  replay?: ReplayOptions
  resolver?: DIDResolver
  tracer?: Tracer
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
  verifyToken?: VerifyTokenHook
}
```

c) Add `replay?: ResolvedReplay | null` to `HandleMessagesParams`:

```ts
export type HandleMessagesParams<Protocol extends ProtocolDefinition> = AccessControlParams & {
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  limiter: ResourceLimiter
  logger: Logger
  replay?: ResolvedReplay | null
  signal: AbortSignal
  tracer: Tracer
  transport: ServerTransportOf<Protocol>
  validator?: Validator<AnyClientMessageOf<Protocol>>
}
```

d) Add a private field on the `Server` class (next to `#validator`):

```ts
  #replay: ResolvedReplay | null
```

e) Resolve it in the constructor, after `this.#accessControl` is fully assigned (immediately before `this.#limiter = createResourceLimiter(params.limits)`):

```ts
    this.#replay = resolveReplay(params.replay, this.#accessControl.requireAuth)

    this.#limiter = createResourceLimiter(params.limits)
```

f) Pass it into `handleMessages` inside `handle()` (add to the object passed to `handleMessages`):

```ts
    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      limiter: this.#limiter,
      logger,
      replay: this.#replay,
      signal: this.#abortController.signal,
      tracer: this.#tracer,
      transport,
      validator: this.#validator,
      ...accessControl,
    })
```

- [ ] **Step 4: Destructure `replay` and gate the three entry points**

In `handleMessages`, add `replay` to the destructure at the top of the function:

```ts
  const { events, handlers, limiter, logger, replay, signal, transport, validator } = params
```

**(4a) The `process` auth path** — in the authenticated `process` function, after the `checkClientToken` try/catch succeeds and before the `checkMessageEncryption(message)` block. Insert immediately after the line `span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, true)` and its closing `}` of the try block (i.e. right after the `try { ... } catch { ... }` block, before `if (!checkMessageEncryption(message)) {`):

```ts
        if (replay != null) {
          const replayResult = await checkReplay(message as unknown as SignedToken, replay)
          if (!replayResult.ok) {
            span.setAttribute(EnkakuAttributeKeys.AUTH_REASON, replayResult.reason)
            span.setAttribute(EnkakuAttributeKeys.AUTH_ALLOWED, false)
            const error = new HandlerError({
              code: ErrorCodes.REPLAY_DETECTED,
              message: 'Replay detected',
            })
            span.setAttribute(EnkakuAttributeKeys.ERROR_CODE, error.code)
            span.setAttribute(EnkakuAttributeKeys.ERROR_MESSAGE, error.message)
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
            span.recordException(error)
            span.end()
            if (message.payload.typ !== 'event') {
              context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>, {
                rid: message.payload.rid,
              })
            }
            emitHandlerError(events, 'auth', error, message.payload)
            return
          }
        }
```

**(4b) The `abort` case** — inside `case 'abort':`, after the `verifyToken` try/catch succeeds and before the `abortIssuer` issuer-match check. Insert right after the closing `}` of the `verifyToken` catch block:

```ts
            if (replay != null) {
              const replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              if (!replayResult.ok) {
                const error = new HandlerError({
                  code: ErrorCodes.REPLAY_DETECTED,
                  message: 'Replay detected',
                })
                context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                  rid: msg.payload.rid,
                })
                emitHandlerError(events, 'auth', error, msg.payload)
                break
              }
            }
```

**(4c) The `send` case** — inside `case 'send':`, after the `verifyToken` try/catch succeeds and before the `sendIssuer` issuer-match check. Insert right after the closing `}` of the `verifyToken` catch block:

```ts
            if (replay != null) {
              const replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              if (!replayResult.ok) {
                const error = new HandlerError({
                  code: ErrorCodes.REPLAY_DETECTED,
                  message: 'Replay detected',
                })
                context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
                  rid: msg.payload.rid,
                })
                emitHandlerError(events, 'auth', error, msg.payload)
                break
              }
            }
```

Note: `SignedToken` is already imported from `@kokuin/token` in `server.ts`.

- [ ] **Step 5: Export the public replay types from the package index**

Edit `packages/server/src/index.ts` — add after the `./limits.js` export block:

```ts
export {
  MemoryReplayCache,
  type ReplayCache,
  type ReplayOptions,
} from './replay.js'
```

- [ ] **Step 6: Run the new integration tests**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay-server.test.ts`
Expected: PASS (all 5 integration tests).

- [ ] **Step 7: Run the full server unit suite to check for regressions**

Run: `pnpm --filter @enkaku/server test:unit`
Expected: PASS (existing suites unaffected — replay defaults on, but existing auth tests reuse unique messages / fresh servers; any that replay an identical signed message must be checked. If one fails because it deliberately resends, fix that test to pass `replay: { enabled: false }`).

- [ ] **Step 8: Typecheck and lint**

Run: `pnpm --filter @enkaku/server test:types && rtk proxy pnpm run lint`
Expected: PASS / clean.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/index.ts packages/server/test/replay-server.test.ts
git commit -m "feat(server): enforce replay protection at signed-message entry points"
```

---

## Task 4: Channel `send` and `abort` replay coverage + docs

**Files:**
- Test: `packages/server/test/replay-server.test.ts`
- Modify (if present): `packages/server/README.md` or server doc comment

**Interfaces:**
- Consumes: everything from Task 3.

- [ ] **Step 1: Add channel send + abort replay tests**

Append to `packages/server/test/replay-server.test.ts`. Use a channel protocol and replay a `send` and an `abort` message. Model the channel/auth setup on `packages/server/test/channel-send-auth.test.ts` (read it for the exact `signToken` shape of `send`/`abort` messages and channel-open handshake). The assertion is the same shape as the event test: replaying an identical signed `send` (or `abort`) emits `handlerError` with `error.code === 'EK09'` and `category: 'auth'`.

```ts
// Pattern (fill channel setup from channel-send-auth.test.ts):
// 1. Open a channel (request/channel message) to create the controller.
// 2. signToken a `send` message with a jti + exp.
// 3. Write it once (accepted), write the identical token again.
// 4. Expect handlerError EK09 on the second write.
// Repeat with an `abort` message.
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @enkaku/server exec vitest run test/replay-server.test.ts`
Expected: PASS (event + cross-connection + stale + disabled + custom-cache + send + abort).

- [ ] **Step 3: Document the `replay` option**

Add a short section to the server package docs (the `@module server` doc comment in `packages/server/src/index.ts`, or `packages/server/README.md` if it documents options) describing `replay?: ReplayOptions`: on by default when authenticated, server-wide in-memory dedup, `enabled: false` to disable, `cache` to plug a persistent/shared backend, `maxAge`/`rejectStale`/`maxEntries` knobs. State that token `exp`/`iat` are in seconds and `maxAge` is in milliseconds.

- [ ] **Step 4: Lint and commit**

```bash
rtk proxy pnpm run lint
git add packages/server/test/replay-server.test.ts packages/server/src/index.ts packages/server/README.md
git commit -m "test(server): cover channel send/abort replay; document replay option"
```

---

## Self-Review

**Spec coverage:**
- Pluggable `ReplayCache` + in-memory default → Task 1. ✓
- `checkReplay` logic (stale reject, expiresAt, `jti ?? signature` key, seconds→ms) → Task 2. ✓
- `ReplayOptions` with `enabled`/`cache`/`maxAge`/`rejectStale`/`maxEntries` → Task 2 + Task 3. ✓
- `EK09 REPLAY_DETECTED` wire code → Task 2. ✓
- On-by-default when `requireAuth`, server-wide store, three entry points, error/OTel handling → Task 3. ✓
- Channel `send`/`abort` coverage + docs → Task 4. ✓
- Non-goals (`nbf`, persistence, mandatory `jti`/`exp`) respected: no schema changes, no `nbf` handling. ✓

**Placeholder scan:** Task 4 Step 1 intentionally references `channel-send-auth.test.ts` for the channel handshake shape rather than duplicating ~100 lines of unrelated setup; the assertion contract is fully specified. All code steps contain complete code.

**Type consistency:** `checkAndRecord(key, expiresAt)`, `resolveReplay(options, requireAuth)`, `checkReplay(message, resolved)`, `ResolvedReplay`, `ReplayOptions`, `ReplayCheckResult`, `MemoryReplayCacheParams` used identically across tasks. `ErrorCodes.REPLAY_DETECTED === 'EK09'` consistent. `now()`/`expiresAt` are ms throughout; token claims converted at the one boundary in `checkReplay`.
