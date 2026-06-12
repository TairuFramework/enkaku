# Kubun-audit enkaku boundary fixes

**Status:** complete
**Date:** 2026-06-11
**Origin:** enkaku-side half of four kubun full-repo-audit findings (`next/2026-06-11-kubun-audit-boundary-items.md`). Each kubun plan owns the user-visible outcome and depended on the enkaku change here.

## Goal

Close four enkaku-side boundary gaps surfaced by the kubun audit (generator iterator cleanup, hub group roster persistence, Server silent auth-off) plus four advisories — in one branch, fixes only, no new protocol requests.

## What was built

1. **`consume()` closes its source iterator** (`@enkaku/generator`, HIGH). On abort and on normal completion it now calls `iterator.return?.()` (awaited, error-swallowed, one-shot `closed` guard), running the source generator's `finally` — fixes a per-subscribe listener + unbounded-queue leak in any resource-backed `AsyncGenerator` (kubun's `graph/subscribe`). Implementation also added an early-abort path for signals already aborted at call time.

2. **`Server` refuses silent auth-off** (`@enkaku/server`, MEDIUM, **breaking**). Constructing a server without `identity` now requires an explicit `requireAuth: false` opt-out — enforced at the type level (`ServerAccessOptions` union gained `requireAuth: false` on the no-identity arm) and at runtime (constructor throws otherwise). Closes the footgun that let kubun ship an unauthenticated network-reachable read path. `@enkaku/standalone` and ~26 test construction sites updated.

3. **Hub group roster survives restart; join stops clobbering** (`@enkaku/hub-protocol` + `@enkaku/hub-server`, CRITICAL with kubun, **breaking**). `HubStore.setGroupMembers` (whole-roster replace) replaced by idempotent single-member `addGroupMember` / `removeGroupMember` (+ kept `getGroupMembers`); memory store is Set-backed. `hub/group/join` → `addGroupMember`, `leave` → `removeGroupMember`, and `hub/group/send` resolves recipients from `union(durable store roster, live registry)`. Fixes cross-restart roster loss and the join-clobber that stranded offline members at old MLS epochs.

4. **Advisories.** 4.1 `AccessRules` JSDoc — `payload.sub` is caller-asserted, not verified unless a delegation rule triggers. 4.3 `EventEmitter.emit` JSDoc — awaits + rethrows listener failures, so fire-and-forget `void emit(...)` becomes an unhandled rejection; recommend `.catch`. 4.4 `ValidationError.message` now appends the first issue locator `(<instancePath|'/'> <keyword>)` so transports serializing only `message` keep field detail. 4.5 — see below.

## Key design decisions

- **Single-member roster primitives over batch.** Join adds self, leave removes self — every call site is single-member. `setGroupMembers` was only ever the clobbering RMW; removing it makes whole-roster replacement unrepresentable, so the clobber cannot regress. No batch method (YAGNI).
- **Send resolves via union, not store-alone.** `union(store, registry)` covers both post-restart members (registry empty → store carries roster) and same-lifetime members not yet in a fresh store read. Storage already queues for all recipients and pushes only to online clients, so offline members fetch on reconnect with no extra code.
- **Auth-off must be loud.** Throw + type-union over warn-only — a log warning is exactly how the unauthenticated path shipped originally. Breaking change accepted per the audit decision record (stack-internal consumers).
- **4.5 (transport double-casts) → WONTFIX.** Gated investigation reproduced and compiled every cast site: there is **no type-variance defect in enkaku**. The casts are consumer-side under-typing — `new MessageTransport({...})` / `new Transport({...})` constructed without type arguments collapse the read/write generics to `unknown`, which is then correctly rejected on the covariant read position (kubun `local-todo`, sakui `runtime`); one cast (kubun `plugin-p2p/hub/http-client`) is stale; the enkaku test mock cast is the sanctioned partial-`vi.fn` idiom. A structural `AnyServerTransport` / relaxed `TransportType` bound / `asServerTransport` guard would be a **net regression** (re-admits `unknown`, weakening read-side safety). No enkaku change made.

## Verification

All touched-package unit suites green: generator 14, server 139, schema 32, hub-server 61, event 24, standalone 4 (274 total). Per-task spec + code-quality reviews, a final cross-task review, and an independent merge-gate review all passed. The cross-restart integration test (`hub-server/test/hub.test.ts`) uses real `Client`/`DirectTransports` over a shared store across two hub lifetimes and genuinely fails under the old registry-only resolution.

## Notes

- No changelog files written — repo has no `.changeset/` or per-package `CHANGELOG.md`; breaks signalled via `feat(...)!` conventional-commit markers. If release tooling is added, the two breaking changes (server auth-default, hub-store interface) need migration notes.
- Implemented on `chore/fable-audit` concurrently with an unrelated "ErrorCodes runtime-export" workstream; the two did not conflict in scope. One boundary-fix one-liner (standalone cast removal) landed folded into a concurrent commit due to an amend collision — code is correct, only the commit label is off.

## Follow-ups

Filed to backlog: [2c group-member expiry](../backlog/hub-group-member-expiry.md), [transport DX constructor helpers + consumer cast fixes](../backlog/transport-typed-constructors.md). Still deferred (pre-existing): 4.2 mid-session redeliver (nack / redeliver-now) — a new protocol request, kubun's receive-side retry works around it.
