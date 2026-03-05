# Security Audit Final Items

**Status:** Complete
**Date:** 2026-03-05
**Branch:** `chore/audit-changes`
**Security audit reference:** H-17, C-04, P-01, P-02, P-03, P-08, P-09 from `docs/plans/2026-01-28-security-audit.md`

---

## Access Control API Refactor (H-17)

Replaced the `public` boolean + `access` record on `ServerParams`, `HandleOptions`, and internal types with a unified `accessControl` parameter.

### Changes

- **`accessControl`** accepts `false` (public/no auth), `true` (server-only, default when identity is provided), or a `ProcedureAccessRecord` (granular rules)
- Eliminates the contradictory state where `public: true` silently ignored access records
- Server constructor now throws when `identity` is omitted without explicit `accessControl: false`
- Warnings replaced with hard errors for invalid configurations

### Breaking change

`public` and `access` params removed from `ServerParams`, `HandleOptions`, and `ServeParams`. Consumers must use `accessControl` instead.

### Files modified

- `packages/server/src/server.ts` — types and constructor/handle() logic
- `packages/standalone/src/index.ts` — updated to new API
- `packages/electron-rpc/src/main.ts` — removed hardcoded public default
- All server test files — migrated to `accessControl`
- Integration tests, deno test, http-server-transport tests — migrated

---

## Capability Verification Hook (C-04)

Added an optional `verifyToken` hook to the capability verification flow, enabling consumers to implement custom checks such as token revocation.

### Changes

- Added `verifyToken` callback to `DelegationChainOptions` in `@enkaku/capability`
- Hook receives both the parsed `CapabilityToken` and raw token string; throw to reject
- Threaded through `checkDelegationChain`, `checkCapability`, `checkProcedureAccess`, and `checkClientToken`
- Exposed on `ServerParams.verifyToken` so the server passes it to capability checks automatically
- Non-breaking, additive change

### Files modified

- `packages/capability/src/index.ts` — `DelegationChainOptions` type, `checkDelegationChain`, `checkCapability`
- `packages/capability/test/lib.test.ts` — 7 new tests
- `packages/server/src/access-control.ts` — threading through `checkProcedureAccess` and `checkClientToken`
- `packages/server/src/server.ts` — `AccessControlParams`, `ServerParams`, `HandleOptions`, constructor, handle()
- `packages/server/test/access-control.test.ts` — 2 new tests
- `packages/server/test/verify-token-hook.test.ts` — 2 new integration tests

---

## Performance Quick Wins (P-01, P-02, P-03, P-08, P-09)

Four independent, mechanical optimizations across three packages.

### P-01 + P-03: JSON-lines parser optimization
- **Package:** `@enkaku/stream`
- Replaced `output += char` string concatenation with `Array<string>` buffer + `join('')`
- Replaced `/\S/.test(char)` regex with `charCodeAt(0) > 32` comparison

### P-02: Base64URL single regex
- **Package:** `@enkaku/codec`
- Replaced three sequential `.replace()` calls with single `/[=+/]/g` regex

### P-08: O(n) chain unwinding
- **Package:** `@enkaku/execution`
- Replaced `chain.unshift(current)` (O(n) per call → O(n²) total) with `push()` + `reverse()`

### P-09: Signal deduplication
- **Package:** `@enkaku/execution`
- Reused computed `#chainSignal` in `#signal` construction instead of re-including all chain signals in a second `AbortSignal.any()` call
