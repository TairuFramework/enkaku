# Enkaku-side asks for downstream (kubun + mokei) — error exports, otel baggage, schema strict

**Completed:** 2026-06-12
**Status:** complete (code) — publishing/version bumps owned by maintainer, post-publish verification extracted to `next/`
**Branch:** `chore/mokei-follow-ups`
**Origin plans (consolidated here):**
- `next/2026-06-11-export-error-codes-runtime.md` (kubun sync-server-authentication work)
- `next/2026-06-11-mokei-mcp-draft-asks.md` (mokei MCP-draft G5/G8 groundwork)

Two separate ask-docs, both enkaku-side enablers for parked downstream work, completed together.

## Goal

Close four API-surface/ergonomics gaps that downstream packages (kubun, mokei) hit, so they can drop hardcoded workarounds and consume typed enkaku surface instead.

## What was built

### `@enkaku/server` — `HandlerError` export
`HandlerError` class + `HandlerErrorParams` type now exported from the public entry (`packages/server/src/index.ts`). Consumers can `throw new HandlerError({ code, message })` or subclass it; `executeHandler`'s `from()` returns `HandlerError` instances untouched (`instanceof` short-circuit), so a custom `code`/`message` survives to the client instead of collapsing to the generic `HANDLER_ERROR` / `'Handler execution failed'` envelope. Unblocks kubun's `SyncAccessDeniedError` (wire-distinguishable `KB08`).

### `@enkaku/protocol` — `ErrorCodes` runtime export
No code change needed this session — `lib/error-codes.js` is already built and re-exported from source (`index.ts` → `error-codes.js`, surfaced again via `@enkaku/server`). The original gap was that published `0.16.0` shipped before this was built. **Resolved by a release, not a code change** (see Pending release).

### `@enkaku/otel` — `getActiveBaggage()` + lossless baggage mapping
- New module-private `parseProperties(segments)` extracted from `parseBaggage` (behavior-preserving).
- New public `baggageToEntries(baggage: Baggage): Array<BaggageEntry>` — maps an OpenTelemetry `Baggage` to enkaku entries.
- New public `getActiveBaggage(): Array<BaggageEntry> | undefined` — reads active OTel baggage, delegates to `baggageToEntries`, `undefined` when none/empty. Composes: `formatBaggage(getActiveBaggage() ?? [])`. Unblocks mokei G5 `baggage` key in MCP `_meta` (SEP-414).

### `@enkaku/schema` — `strict` passthrough
`ValidatorOptions` gained `strict?: boolean | 'log'` (AJV's own values), threaded into the AJV constructor. Unblocks mokei G8 — quiets AJV strict-mode warnings leaking to user consoles for valid 2020-12 constructs.

## Key design decisions

- **Lossless baggage mapping (otel).** OTel collapses the entire W3C property tail (`;prop1;prop2`) into one opaque per-entry metadata string; enkaku structures properties. Parsing `metadata.toString()` with the *same* grammar `parseBaggage` uses reverses the collapse exactly → lossless for W3C-conformant baggage. Value encoding aligns: OTel stores values decoded and metadata raw; the shared `parseProperties` `safeDecode`s property values, so `getActiveBaggage() → formatBaggage()` round-trips. Malformed metadata segments are dropped (same tolerance as `parseBaggage`). Mapping factored into a pure, exported `baggageToEntries` so losslessness is unit-tested against a directly-constructed `Baggage` — no `ContextManager` needed (none is registered in tests, so `getActiveBaggage`'s populated-read path is intentionally only covered indirectly).
- **Strict cache re-key (schema).** AJV instances are cached; the cache key was re-keyed from draft-only to `` `${draft}:${strict ?? 'default'}` ``. A draft-only key would let the first caller's `strict` value silently win for all later callers of the same draft — the exact first-call-wins footgun these asks warn against. `strict` is omitted from AJV options when `undefined`, so existing consumers are unaffected.
- **HandlerError pass-through (server).** Relied on the existing `from()` `instanceof HandlerError` short-circuit rather than changing error-wrapping semantics — export-only change, no behavior shift for existing handlers.

## Verification

All work TDD'd, committed, and reviewed (per-task spec + code-quality review, plus a final holistic review). Green: 82 `@enkaku/otel` + 37 `@enkaku/schema` tests, type checks pass for both. Lint clean (`rtk proxy pnpm run lint`). Server export is type-level + compiles.

Commits: `ba52a5e` (server), `e3ac03b`+`cdd8c49` (schema), `ce46efe`+`996c202`+`f4d9736` (otel).

## Pending release (maintainer-owned, out of scope)

The runtime-export gaps (`ErrorCodes`, `HandlerError`) are invisible at the type layer, so they only fully close once a **version-bumped** release ships — a same-version republish would leave existing installs broken with no re-install signal. Maintainer to bump + publish `@enkaku/{protocol,server,otel,schema}`. Post-publish verification extracted to `next/2026-06-12-verify-runtime-exports-after-publish.md`.

## Downstream follow-ups (tracked elsewhere)

- kubun: `SyncAccessDeniedError` can extend `HandlerError<'KB08'>`; tests import `ErrorCodes`/`ErrorCode` instead of hardcoded `'EK02'`.
- mokei: G5 baggage population + G8 strict opt-in (mokei backlog).
