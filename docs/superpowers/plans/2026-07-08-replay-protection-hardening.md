# Replay Protection Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing
**Mode:** tasks

**Goal:** Make Enkaku's authenticated-message replay protection actually meet its threat model by having the client stamp unique `jti`/`iat`, adding clock-skew leeway, closing the cache-expiry margin, and hardening the read loop against a rejecting async replay cache.

**Architecture:** The server-side replay core already exists (`packages/server/src/replay.ts`, commit cbdce41). Three server tweaks (`replay.ts` leeway + expiry margin; `server.ts` async-rejection guard) plus one client change (`client.ts` inject `jti`/`iat` before signing). Client `iat` is seconds; server converts to ms. No client-set `exp`; the server `maxAge` window governs staleness.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, `@kokuin/token` (signing), `@sozai/runtime` (`getRandomID` = `crypto.randomUUID`).

## Global Constraints

- No `interface` — use `type`. No `any` — use `unknown`/specific. No `T[]` — use `Array<T>`. Names: `ID`/`JWT`/`HTTP` not `Id`/`Jwt`/`Http`.
- Token `iat`/`exp` claims are in **seconds**; server multiplies by 1000 (`replay.ts:111`). Client `iat` = `Math.floor(now() / 1000)`.
- Default leeway: `5_000` ms.
- Never edit generated files (`.gen.ts`, `__generated__/`, `lib/`).
- Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`). Unit tests: `pnpm run test:unit`. Per-package test: run vitest from the package dir.
- Commit messages end with the `Co-Authored-By` trailer.

## File Structure

- `packages/server/src/replay.ts` — add `leeway` to `ReplayOptions`/`ResolvedReplay`/`resolveReplay`; apply leeway in `checkReplay` staleness; extend recorded `expiresAt` by leeway. (Task 1)
- `packages/server/test/replay.test.ts` — leeway + margin + distinct-`jti` regression tests. (Task 1)
- `packages/client/src/client.ts` — inject `jti`/`iat` in `getCreateMessage`; reorder constructor so `#runtime` is set before `getCreateMessage`; add `ClientParams.now`. (Task 2)
- `packages/client/test/replay-claims.test.ts` — new; asserts stamped claims. (Task 2)
- `packages/server/src/server.ts` — try/catch guard around the three `await checkReplay` sites (559 in `process`, 651 + 735 in `handleNext`). (Task 3)
- `packages/server/test/replay-server.test.ts` — rejecting-async-cache test. (Task 3)

---

### Task 1: Server leeway + cache-expiry margin

**Files:**
- Modify: `packages/server/src/replay.ts` (`ReplayOptions`, `ResolvedReplay`, `resolveReplay`, `checkReplay`)
- Test: `packages/server/test/replay.test.ts`

**Interfaces:**
- Consumes: existing `checkReplay(message: SignedToken, resolved: ResolvedReplay)`, `resolveReplay(options, requireAuth)`, `MemoryReplayCache`.
- Produces: `ResolvedReplay` gains `leeway: number`; `ReplayOptions` gains optional `leeway?: number` (default `5_000`). Staleness and recorded `expiresAt` both account for `leeway`.

- [ ] **Step 1: Write failing tests**

Add to `packages/server/test/replay.test.ts` (uses existing `resolveOrThrow`, `MemoryReplayCache`, `checkReplay` helpers already imported there):

```ts
describe('clock-skew leeway', () => {
  function signed(payload: Record<string, unknown>): SignedToken {
    return { payload: { iss: 'did:key:zTest', ...payload }, signature: 'sig' } as SignedToken
  }

  test('iat within maxAge + leeway passes', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, now: () => now })
    // iat 12s ago: past maxAge (10s) but within maxAge + leeway (15s)
    const result = await checkReplay(signed({ jti: 'a', iat: (now - 12_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: true })
  })

  test('iat beyond maxAge + leeway is stale', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, now: () => now })
    const result = await checkReplay(signed({ jti: 'b', iat: (now - 16_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: false, reason: 'replay_stale' })
  })

  test('exp within leeway passes', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ leeway: 5_000, now: () => now })
    const result = await checkReplay(signed({ jti: 'c', exp: (now - 3_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: true })
  })

  test('recorded entry lives through the leeway tail (no replay slip)', async () => {
    let now = 100_000
    const cache = new MemoryReplayCache({ now: () => now })
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, cache, now: () => now })
    const msg = signed({ jti: 'd', iat: now / 1000 })
    expect(await checkReplay(msg, resolved)).toEqual({ ok: true })
    now = 100_000 + 12_000 // past maxAge, within maxAge + leeway
    // staleness still accepts it, and the cache must still hold the key -> replay
    expect(await checkReplay(msg, resolved)).toEqual({ ok: false, reason: 'replay_detected' })
  })

  test('distinct jti on byte-identical intent both pass (regression for #1)', async () => {
    const resolved = resolveOrThrow({ now: () => 100_000 })
    const a = signed({ jti: 'unique-1', iat: 100 })
    const b = signed({ jti: 'unique-2', iat: 100 })
    expect(await checkReplay(a, resolved)).toEqual({ ok: true })
    expect(await checkReplay(b, resolved)).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd packages/server && pnpm exec vitest run test/replay.test.ts -t "clock-skew leeway"`
Expected: FAIL — `leeway` not honored (stale/replay expectations wrong).

- [ ] **Step 3: Add `leeway` to the option types and `resolveReplay`**

In `packages/server/src/replay.ts`:

```ts
export type ReplayOptions = {
  enabled?: boolean
  cache?: ReplayCache
  maxAge?: number // milliseconds; fallback window for messages without exp
  leeway?: number // milliseconds; clock-skew tolerance for staleness
  rejectStale?: boolean
  maxEntries?: number
  now?: () => number
}

export type ResolvedReplay = {
  cache: ReplayCache
  maxAge: number
  leeway: number
  rejectStale: boolean
  now: () => number
}

const DEFAULT_MAX_AGE = 60_000
const DEFAULT_LEEWAY = 5_000
```

In `resolveReplay`, add `leeway` to the returned object:

```ts
  return {
    cache: options?.cache ?? new MemoryReplayCache({ maxEntries: options?.maxEntries, now }),
    maxAge: options?.maxAge ?? DEFAULT_MAX_AGE,
    leeway: options?.leeway ?? DEFAULT_LEEWAY,
    rejectStale: options?.rejectStale ?? true,
    now,
  }
```

- [ ] **Step 4: Apply leeway in `checkReplay` staleness and `expiresAt`**

Replace the staleness block and the `expiresAt` line in `checkReplay`:

```ts
  if (resolved.rejectStale) {
    if (expMs != null) {
      if (now > expMs + resolved.leeway) return { ok: false, reason: 'replay_stale' }
    } else if (iatMs != null && now > iatMs + resolved.maxAge + resolved.leeway) {
      return { ok: false, reason: 'replay_stale' }
    }
  }

  const expiresAt = (expMs ?? (iatMs ?? now) + resolved.maxAge) + resolved.leeway
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd packages/server && pnpm exec vitest run test/replay.test.ts`
Expected: PASS (new leeway suite + all pre-existing replay tests still green).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/replay.ts packages/server/test/replay.test.ts
git commit -m "$(cat <<'EOF'
feat(server): clock-skew leeway and cache-expiry margin for replay

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Client `jti`/`iat` injection

**Files:**
- Modify: `packages/client/src/client.ts` (`getCreateMessage`, `ClientParams`, `Client` constructor)
- Test: `packages/client/test/replay-claims.test.ts` (create)

**Interfaces:**
- Consumes: existing `getCreateMessage(identity?, aud?)`, `createUnsignedToken`, `isSigningIdentity`, `this.#runtime.getRandomID`.
- Produces: `getCreateMessage(identity?, aud?, getRandomID?, now?)`; every **signed** client message payload carries `jti: string` (uuid) and `iat: number` (seconds). Unsigned messages unchanged. `ClientParams` gains `now?: () => number` (default `Date.now`).

- [ ] **Step 1: Write the failing test**

Create `packages/client/test/replay-claims.test.ts`. Check what a real signing identity is called in existing client tests first (grep `randomIdentity` / `signToken` under `packages/client/test`); use the same helper. Skeleton:

```ts
import { randomIdentity } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'
// Use the same DirectTransports / protocol setup as other client tests
// (see packages/client/test/*.test.ts for the exact import + harness).

describe('replay claims on signed messages', () => {
  test('stamps a uuid jti and integer iat (seconds) on a signed request', async () => {
    const identity = randomIdentity()
    let seq = 0
    const client = new Client({
      transport: /* the test transport */ undefined as never,
      identity,
      getRandomID: () => `id-${seq++}`,
      now: () => 1_700_000_000_000, // fixed epoch ms
    })
    // Trigger message creation and capture the signed payload written to the transport.
    // Assert the written message payload has:
    //   payload.jti === <one of the getRandomID values>
    //   payload.iat === Math.floor(1_700_000_000_000 / 1000)
    // and that two messages carry distinct jti.
    void client
  })

  test('unsigned client stamps neither jti nor iat', async () => {
    // Construct a Client with no identity; assert written payload has no jti/iat.
  })
})
```

Fill the harness to match an existing client test (e.g. `packages/client/test/safe-write.test.ts` for how it captures written messages). The assertions above are the contract; the transport wiring copies an existing test.

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/client && pnpm exec vitest run test/replay-claims.test.ts`
Expected: FAIL — payload has no `jti`/`iat`.

- [ ] **Step 3: Inject `jti`/`iat` in `getCreateMessage`**

In `packages/client/src/client.ts`, change `getCreateMessage`:

```ts
function getCreateMessage<Protocol extends ProtocolDefinition>(
  identity?: Identity | Promise<Identity>,
  aud?: string,
  getRandomID: () => string = () => globalThis.crypto.randomUUID(),
  now: () => number = Date.now,
): CreateMessage<Protocol> {
  if (identity == null) {
    return createUnsignedToken
  }

  const identityPromise = Promise.resolve(identity)
  const createToken = (payload: Record<string, unknown>, header?: AnyHeader) => {
    return identityPromise.then((id) => {
      if (!isSigningIdentity(id)) {
        throw new Error('Identity does not support signing')
      }
      return id.signToken(
        { jti: getRandomID(), iat: Math.floor(now() / 1000), ...payload },
        { header },
      )
    })
  }

  return (
    aud ? (payload, header) => createToken({ aud, ...payload }, header) : createToken
  ) as CreateMessage<Protocol>
}
```

`jti`/`iat` are listed first so a caller-supplied `payload` field of the same name would win — but no caller sets them, and this keeps the aud-wrapped path covered too.

- [ ] **Step 4: Add `now` to `ClientParams` and reorder the constructor**

Add to `ClientParams`:

```ts
  identity?: Identity | Promise<Identity>
  now?: () => number
```

In the constructor, set `#runtime` **before** `#createMessage`, and pass `getRandomID` + `now` in:

```ts
    this.#runtime = params.runtime ?? createRuntime({ getRandomID: params.getRandomID })
    this.#createMessage = getCreateMessage<Protocol>(
      params.identity,
      params.serverID,
      this.#runtime.getRandomID,
      params.now,
    )
```

(This moves the existing `this.#createMessage = getCreateMessage<Protocol>(params.identity, params.serverID)` line down and the `this.#runtime = ...` line up — they currently sit at client.ts:285-286 in the wrong order for this dependency.)

- [ ] **Step 5: Run test, verify it passes**

Run: `cd packages/client && pnpm exec vitest run test/replay-claims.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full client suite (guard against regressions)**

Run: `cd packages/client && pnpm exec vitest run`
Expected: PASS — existing tests that assert on signed payloads may need updating to tolerate the new `jti`/`iat` fields; if any fail on an exact-payload match, relax them to `expect.objectContaining(...)`.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/client.ts packages/client/test/replay-claims.test.ts
git commit -m "$(cat <<'EOF'
feat(client): stamp jti and iat on signed messages for replay protection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Async replay-cache rejection guard

**Files:**
- Modify: `packages/server/src/server.ts` (three `await checkReplay` sites: ~559 inside `process`, ~651 and ~735 inside `handleNext`)
- Test: `packages/server/test/replay-server.test.ts`

**Interfaces:**
- Consumes: `checkReplay`, `events.emit('transportError', { error })`, `disposer.dispose()` — the exact pattern already used at `server.ts:590-594` for a failed transport read.
- Produces: a rejecting async `ReplayCache` surfaces as a `transportError` event plus transport dispose, instead of an unhandled rejection. Read loop stops cleanly.

- [ ] **Step 1: Write the failing test**

Add to `packages/server/test/replay-server.test.ts` (imports `DirectTransports`, `randomIdentity`, `serve`, `MemoryReplayCache`, `ReplayCache`, `nowSeconds` already present):

```ts
test('a rejecting async replay cache surfaces transportError and disposes', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const cache: ReplayCache = {
    checkAndRecord: () => Promise.reject(new Error('cache backend down')),
  }

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
    jti: 'evt-guard',
    iat: nowSeconds(),
  } as const)

  const transportError = server.events.once('transportError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await transportError
  expect(emitted.error).toBeInstanceOf(Error)
  expect(handler).not.toHaveBeenCalled()
  // Server tears down: its disposed promise resolves without hanging.
  await server.disposed
})
```

Confirm `serve` accepts a `replay` option and that the returned server exposes `events` + `disposed` (grep `replay` and `disposed` in `packages/server/src/index.ts` / `server.ts`); adjust the option key if it differs.

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/server && pnpm exec vitest run test/replay-server.test.ts -t "rejecting async replay cache"`
Expected: FAIL or hang/unhandled-rejection — no `transportError`, `disposed` never resolves.

- [ ] **Step 3: Guard the `process` site (~server.ts:559)**

Wrap the `await checkReplay` in the `process` async function. Replace:

```ts
        if (replay != null) {
          const replayResult = await checkReplay(message as unknown as SignedToken, replay)
          if (!replayResult.ok) {
```

with a try/catch that fails stop on a thrown cache error:

```ts
        if (replay != null) {
          let replayResult: ReplayCheckResult
          try {
            replayResult = await checkReplay(message as unknown as SignedToken, replay)
          } catch (cause) {
            const error = new Error('Replay cache check failed', { cause })
            logger.warn('replay cache check failed', { cause })
            events.emit('transportError', { error })
            await disposer.dispose()
            return
          }
          if (!replayResult.ok) {
```

Import `ReplayCheckResult` from `./replay.js` (extend the existing `import { checkReplay, type ReplayOptions, ... }` line at server.ts:55).

- [ ] **Step 4: Guard the two `handleNext` sites (~651 and ~735)**

Both sit inside the `handleNext` switch (`abort` and `send` cases). For each, replace:

```ts
            if (replay != null) {
              const replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              if (!replayResult.ok) {
                rejectReplay(msg.payload.rid, msg.payload)
                break
              }
            }
```

with:

```ts
            if (replay != null) {
              let replayResult: ReplayCheckResult
              try {
                replayResult = await checkReplay(msg as unknown as SignedToken, replay)
              } catch (cause) {
                const error = new Error('Replay cache check failed', { cause })
                logger.warn('replay cache check failed', { cause })
                events.emit('transportError', { error })
                await disposer.dispose()
                return
              }
              if (!replayResult.ok) {
                rejectReplay(msg.payload.rid, msg.payload)
                break
              }
            }
```

`return` (not `break`) so `handleNext` exits and the trailing `handleNext()` recursion does not re-enter after dispose.

- [ ] **Step 5: Run test, verify it passes**

Run: `cd packages/server && pnpm exec vitest run test/replay-server.test.ts`
Expected: PASS.

- [ ] **Step 6: Full server suite + typecheck**

Run: `cd packages/server && pnpm exec vitest run`
Then from repo root: `rtk proxy pnpm run lint`
Expected: PASS, no lint/type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/replay-server.test.ts
git commit -m "$(cat <<'EOF'
fix(server): surface rejecting async replay cache as transportError

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Client `jti`/`iat` injection (spec §1) → Task 2. ✓
- Clock-skew leeway (spec §2) → Task 1 steps 3-4. ✓
- Cache-expiry margin (spec §3) → Task 1 step 4 (`expiresAt + leeway`) + test step 1 "leeway tail" case. ✓
- Async-cache rejection guard (spec §4) → Task 3. ✓
- Spec testing section: distinct-`jti` regression → Task 1; client claims → Task 2; leeway/stale/margin → Task 1; rejecting async cache across sites → Task 3. ✓

**Placeholder scan:** Task 2's test harness references "the test transport" / "an existing test" rather than inlined transport wiring — deliberate, because the exact `DirectTransports` + protocol setup must be copied from a real neighboring client test rather than guessed; the assertions (the actual contract) are concrete. All server code steps carry complete code.

**Type consistency:** `leeway` is `number` everywhere; `ReplayCheckResult` imported in Task 3 matches the existing export in `replay.ts`; `getCreateMessage` new params (`getRandomID: () => string`, `now: () => number`) match the constructor call in Task 2 step 4; `iat` is seconds in both client (Task 2) and server test payloads (Task 3).
