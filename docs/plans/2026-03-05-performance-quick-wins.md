# Performance Quick Wins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply four low-effort performance improvements: JSON-lines parser optimization (P-01/P-03), base64url single-regex replace (P-02), execution chain O(n) unwinding (P-08), and signal deduplication (P-09).

**Architecture:** These are four independent, mechanical optimizations in three packages (`@enkaku/stream`, `@enkaku/codec`, `@enkaku/execution`). Each has existing tests that verify correctness — no new tests needed, just run existing suites to confirm behavior is preserved.

**Tech Stack:** TypeScript, Vitest

**Security audit reference:** P-01, P-02, P-03, P-08, P-09 from `docs/plans/2026-01-28-security-audit.md`

---

### Task 1: Optimize JSON-lines parser (P-01 + P-03)

**Files:**
- Modify: `packages/stream/src/json-lines.ts:24-63` (processChar and output buffer)
- Test: `packages/stream/test/json-lines.test.ts` (existing — 15 tests)

The current parser uses `output += char` in a hot loop, creating thousands of intermediate strings for large payloads. It also uses `/\S/.test(char)` per character. Fix both by using an array buffer and character code comparison.

**Step 1: Replace string concatenation with array buffer**

In `packages/stream/src/json-lines.ts`, change the `output` variable and all references:

Replace the variable declaration (line 24):
```typescript
  let output: Array<string> = []
```

Replace `processChar` function (lines 29-63):
```typescript
  function processChar(char: string): void {
    if (isInString) {
      if (char === '\\') {
        isEscapingChar = !isEscapingChar
      } else {
        if (char === '"' && !isEscapingChar) {
          isInString = false
        }
        isEscapingChar = false
      }
      output.push(char)
    } else {
      switch (char) {
        case '"':
          isInString = true
          output.push(char)
          break
        case '{':
        case '[':
          nestingDepth++
          output.push(char)
          break
        case '}':
        case ']':
          nestingDepth--
          output.push(char)
          break
        default:
          // Ignore whitespace using charCode comparison instead of regex
          if (char.charCodeAt(0) > 32) {
            output.push(char)
          }
      }
    }
  }
```

Replace `checkOutputSize` function (lines 65-71) — use `output.length` as approximation since each element is a single char:
```typescript
  function checkOutputSize(): void {
    if (maxMessageSize != null && output.length > maxMessageSize) {
      throw new JSONLinesError(
        `Message size ${output.length} exceeds maximum message size of ${maxMessageSize}`,
      )
    }
  }
```

Replace all `output !== ''` checks with `output.length > 0` (lines 87 and 113).

Replace all `decode(output)` calls with `decode(output.join(''))` (lines 90 and 116).

Replace all `onInvalidJSON?.(output, controller)` calls with `onInvalidJSON?.(output.join(''), controller)` (lines 92 and 118).

Replace the output reset on line 94 and the newline-in-string append on line 97:
```typescript
            output = []
          } else if (isInString) {
            output.push('\\n')
```

**Step 2: Run existing tests**

Run: `pnpm run test:unit -- --filter @enkaku/stream`
Expected: All 15 json-lines tests PASS. Behavior is identical, only the internal buffer strategy changed.

**Step 3: Commit**

```bash
git add packages/stream/src/json-lines.ts
git commit -m "perf(stream): use array buffer and charCode in JSON-lines parser (P-01, P-03)"
```

---

### Task 2: Single regex replace in base64url (P-02)

**Files:**
- Modify: `packages/codec/src/index.ts:52-54` (toB64U function)
- Test: `packages/codec/test/lib.test.ts` (existing — round-trip and validation tests)

The current `toB64U` does three sequential `.replace()` calls creating 3 intermediate strings. Replace with a single regex.

**Step 1: Replace triple regex with single alternation**

In `packages/codec/src/index.ts`, replace the `toB64U` function body (line 53):

```typescript
export function toB64U(bytes: Uint8Array) {
  return toB64(bytes).replace(/[=+/]/g, (m) => (m === '+' ? '-' : m === '/' ? '_' : ''))
}
```

**Step 2: Run existing tests**

Run: `pnpm run test:unit -- --filter @enkaku/codec`
Expected: All PASS. The base64 round-trip test and base64url encoding/decoding tests verify correctness.

**Step 3: Commit**

```bash
git add packages/codec/src/index.ts
git commit -m "perf(codec): single regex replace in toB64U (P-02)"
```

---

### Task 3: O(n) chain unwinding (P-08)

**Files:**
- Modify: `packages/execution/src/execution.ts:133-139` (asyncIterator)
- Test: `packages/execution/test/execution.test.ts` (existing — iterator tests with chains of 1, 2, 3)

The current `[Symbol.asyncIterator]` uses `chain.unshift(current)` which is O(n) per call, making the loop O(n²). Fix by using `push()` then `reverse()`.

**Step 1: Replace unshift with push+reverse**

In `packages/execution/src/execution.ts`, replace lines 133-139:

```typescript
  async *[Symbol.asyncIterator]() {
    const chain: Array<Execution<unknown, Error | Interruption>> = []
    let current: Execution<unknown, Error | Interruption> | undefined = this
    while (current) {
      chain.push(current)
      current = current.#previous
    }
    chain.reverse()

    let previous: Result<unknown, Error | Interruption> | undefined
    for (const execution of chain) {
```

**Step 2: Run existing tests**

Run: `pnpm run test:unit -- --filter @enkaku/execution`
Expected: All PASS. The iterator tests with chains of 1, 2, and 3 executions verify ordering is preserved.

**Step 3: Commit**

```bash
git add packages/execution/src/execution.ts
git commit -m "perf(execution): O(n) chain unwinding with push+reverse (P-08)"
```

---

### Task 4: Deduplicate signal combining (P-09)

**Files:**
- Modify: `packages/execution/src/execution.ts:80-87` (signal combining in constructor execute)
- Test: `packages/execution/test/execution.test.ts` (existing — abort, timeout, signal tests)

The current code creates `AbortSignal.any(chainSignals)` for `#chainSignal`, then creates `AbortSignal.any([...chainSignals, ...executableSignals])` for `#signal`. The chain signals are included in both calls, creating redundant listeners.

Fix: build `#chainSignal` as before (needed by `next()` method), but for `#signal` combine `#chainSignal` with `executableSignals` instead of re-including all chain signals.

**Step 1: Deduplicate signal combining**

In `packages/execution/src/execution.ts`, replace lines 80-87:

```typescript
      if (chainSignals.length !== 0) {
        this.#chainSignal =
          chainSignals.length === 1 ? chainSignals[0] : AbortSignal.any(chainSignals)
      }

      const signalSources = this.#chainSignal
        ? [this.#chainSignal, ...executableSignals]
        : executableSignals
      const signal = signalSources.length === 1 ? signalSources[0] : AbortSignal.any(signalSources)
      this.#signal = signal
```

This ensures each underlying signal has at most one listener via `AbortSignal.any()`, instead of being included in two separate `AbortSignal.any()` calls.

**Step 2: Run existing tests**

Run: `pnpm run test:unit -- --filter @enkaku/execution`
Expected: All PASS. The abort, timeout, cancel, and signal propagation tests verify correct behavior.

**Step 3: Commit**

```bash
git add packages/execution/src/execution.ts
git commit -m "perf(execution): deduplicate signal combining (P-09)"
```

---

### Task 5: Full verification

**Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass across all packages.

**Step 2: Run build**

Run: `pnpm run build`
Expected: Clean build, no type errors.

**Step 3: Run linter**

Run: `pnpm run lint`
Expected: No lint errors.

**Step 4: Update audit doc**

In `docs/plans/2026-01-28-security-audit.md`, update P-01, P-02, P-03, P-08, P-09 status from `[ ] Planned` to `[x] Fixed` with branch reference.

**Step 5: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: mark P-01, P-02, P-03, P-08, P-09 as fixed in security audit"
```
