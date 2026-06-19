# `fromStream` cancel-on-return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fromStream` cancel the underlying `ReadableStream` on early return, matching native async-iterator semantics, with a `preventCancel` opt-out.

**Architecture:** Add an `options.preventCancel` parameter to `fromStream`. In the generator's `finally` block, `await reader.cancel().catch(() => {})` before `reader.releaseLock()` unless `preventCancel` is set. On normal completion the stream is already closed, so `cancel()` is a no-op.

**Tech Stack:** TypeScript, vitest, `@enkaku/stream` (`createPipe`), native `ReadableStream`.

## Global Constraints

- No `interface` — use `type`. No `any`. No `T[]` — use `Array<T>`. No lowercase abbreviations (`ID`/`HTTP`/`JWT`). Use `pnpm`, never `npm`/`npx`.
- Do not edit generated files (`lib/`, `.gen.ts`). Source lives in `packages/generator/src/`.
- Spec: `docs/superpowers/specs/2026-06-19-fromstream-cancel-on-return-design.md`.

---

### Task 1: Add `preventCancel` option and cancel-on-return to `fromStream`

**Files:**
- Modify: `packages/generator/src/index.ts:140-153`
- Test: `packages/generator/test/lib.test.ts` (`describe('fromStream()')`, ~line 380-411)

**Interfaces:**
- Consumes: native `ReadableStream<T>`, `createPipe` from `@enkaku/stream` (already imported in the test).
- Produces: `fromStream<T>(stream: ReadableStream<T>, options?: { preventCancel?: boolean }): AsyncGenerator<T>`. New default behavior: early return / `.return()` / throw cancels the source. `preventCancel: true` preserves release-only behavior.

- [ ] **Step 1: Write the failing tests**

Add these three tests inside the existing `describe('fromStream()', () => { ... })` block in `packages/generator/test/lib.test.ts`, after the `supports calling return()` test (after line 410). The raw `ReadableStream` constructor is used so the `cancel()` callback can be observed.

```ts
  test('cancels the source stream on early return', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
      },
      cancel() {
        cancelled = true
      },
    })

    const iterator = fromStream(stream)
    expect(await iterator.next()).toEqual({ done: false, value: 1 })
    await iterator.return(undefined)

    expect(cancelled).toBe(true)
    expect(stream.locked).toBe(false)
  })

  test('does not cancel the source on early return when preventCancel is set', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
      },
      cancel() {
        cancelled = true
      },
    })

    const iterator = fromStream(stream, { preventCancel: true })
    expect(await iterator.next()).toEqual({ done: false, value: 1 })
    await iterator.return(undefined)

    expect(cancelled).toBe(false)
    expect(stream.locked).toBe(false)
  })

  test('does not invoke cancel side effects on normal completion', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
        controller.close()
      },
      cancel() {
        cancelled = true
      },
    })

    const values: Array<number> = []
    for await (const value of fromStream(stream)) {
      values.push(value)
    }

    expect(values).toEqual([1, 2])
    expect(cancelled).toBe(false)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/generator run test:unit -- -t 'cancels the source stream on early return'`
Expected: FAIL — `cancelled` is `false` (source never cancelled under current release-only implementation).

The `preventCancel` test also fails to compile/run: the second argument and option are not yet defined.

- [ ] **Step 3: Implement the change**

Replace `fromStream` in `packages/generator/src/index.ts` (lines 140-153) with:

```ts
export async function* fromStream<T>(
  stream: ReadableStream<T>,
  options: { preventCancel?: boolean } = {},
): AsyncGenerator<T> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    if (!options.preventCancel) {
      // Early return / break / throw: cancel the source so its cancel()
      // callback runs and resources are released. cancel() on an
      // already-closed stream is a no-op, so normal completion is unaffected.
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
}
```

- [ ] **Step 4: Run the full `fromStream` suite to verify it passes**

Run: `pnpm --filter @enkaku/generator run test:unit -- -t 'fromStream'`
Expected: PASS — all five tests green (two existing: `creates an AsyncIterator...`, `supports calling return()`; three new).

- [ ] **Step 5: Run type check**

Run: `pnpm --filter @enkaku/generator run test:types`
Expected: PASS — no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/generator/src/index.ts packages/generator/test/lib.test.ts
git commit -m "Cancel reader on fromStream early return"
```

---

### Task 2: Rebuild and regenerate API docs

**Files:**
- Generated: `packages/generator/lib/` (do not hand-edit)
- Generated: `website/docs/api/generator/` (do not hand-edit)

**Interfaces:**
- Consumes: the updated source from Task 1.
- Produces: regenerated `lib/` JS + type declarations and refreshed API reference reflecting the new `options` parameter.

- [ ] **Step 1: Build the package**

Run: `pnpm --filter @enkaku/generator run build`
Expected: builds `lib/index.js`, `lib/index.d.ts` with the new `options` parameter.

- [ ] **Step 2: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors (formatting clean).

- [ ] **Step 3: Regenerate API docs (if the repo has a docs-gen step) and inspect diff**

Run: `git status` and check whether `website/docs/api/generator/index.md` changed. If the repo exposes a docs generation script (check root `package.json`), run it; otherwise the API doc regenerates as part of the normal docs build. Confirm the `fromStream` signature in the generated doc shows the `options` parameter.

- [ ] **Step 4: Commit generated artifacts (only if changed and tracked)**

```bash
git add packages/generator/lib website/docs/api/generator
git commit -m "Rebuild generator with fromStream cancel option"
```

If `lib/` is gitignored (build artifact), skip staging it — only commit doc changes that are tracked.

---

## Self-Review

**Spec coverage:**
- Signature change → Task 1 Step 3. ✓
- Cancel-by-default behavior → Task 1 Step 3 + test. ✓
- `preventCancel` opt-out → Task 1 tests + impl. ✓
- Normal completion no-op → Task 1 normal-completion test. ✓
- Existing tests still pass → Task 1 Step 4 runs full `fromStream` suite. ✓
- Docs regenerated → Task 2. ✓
- Out of scope (mokei revert, `consume`/`fromEmitter`) → untouched. ✓

**Placeholder scan:** None — all code and commands are concrete. Task 2 Step 3 is conditional (docs-gen script may or may not exist) but gives the exact file to check.

**Type consistency:** `fromStream<T>(stream, options?: { preventCancel?: boolean })` used identically in spec, impl, and tests. `iterator.return(undefined)` matches `AsyncGenerator` return signature.
