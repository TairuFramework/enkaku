# Mokei MCP-draft asks: otel active-baggage + schema strict passthrough

**Date:** 2026-06-11
**Origin:** mokei MCP-draft Phase 0 groundwork G5/G8 (mokei `docs/agents/plans/completed/2026-06-10-mcp-draft-g5-g8.complete.md` + `backlog/2026-06-09-mcp-draft-deferred-groundwork.md`). Follow-up to the asks already shipped in `@enkaku/{schema,otel}@0.16.1` (this commit). Both items below are the enkaku-side enabler for mokei work currently parked in mokei's backlog.

## 1. `@enkaku/otel` — active-baggage accessor — MEDIUM

**Gap:** `@enkaku/otel@0.16.1` ships `formatBaggage`/`parseBaggage` codecs but no accessor for the *active* baggage, so a consumer has nothing to format from. `getActiveTraceContext()` surfaces trace/span/flags only; there is no baggage equivalent.

**Impact (mokei):** G5 propagates W3C trace context into MCP request `_meta` (SEP-414) and currently emits `traceparent` + `tracestate` only. The `baggage` key cannot be populated — mokei has no first-party way to read active OTel baggage without reaching past `@enkaku/otel` into `@opentelemetry/api` directly, which defeats the wrapper.

**Ask:** add `getActiveBaggage(): Baggage | undefined` (or a `Record<string, string>` of entries) mirroring `getActiveTraceContext()` — returns `undefined` when no SDK/baggage is active. Pairs with the existing `formatBaggage` so a caller can do `formatBaggage(getActiveBaggage())`.

**Done when:** `@enkaku/otel` exports an active-baggage accessor; unit test confirms it returns the entries set on the active context and `undefined` when none is registered.

## 2. `@enkaku/schema` — `strict` passthrough on `ValidatorOptions` — LOW

**Gap:** `createValidator`/`createStandardValidator` with `{ draft: '2020-12' }` construct `Ajv2020` in AJV default strict mode. Strict mode logs warnings to stderr for *valid* 2020-12 constructs (e.g. a `prefixItems` 2-tuple without `minItems`/`maxItems`). No option to quiet or downgrade them.

**Impact (mokei):** G8 lets MCP tool/prompt schemas opt into 2020-12 via `$schema`. Legitimate 2020-12 schemas now leak Ajv strict warnings to user consoles — the validator works, but the UX undercuts the "smooth opt-in".

**Ask:** extend `ValidatorOptions` with a `strict?: boolean | 'log'` (AJV's own `strict` values) passed through to the AJV constructor. Default unchanged (current strict behavior) so existing consumers are unaffected; mokei would pass `strict: 'log'` or `false`.

**Done when:** `ValidatorOptions` accepts `strict`; a 2020-12 `prefixItems` schema validates without emitting a strict-mode warning when `strict: false` is set, and still warns by default.
