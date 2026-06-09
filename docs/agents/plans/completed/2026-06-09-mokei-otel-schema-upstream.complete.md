# Upstream asks for mokei MCP draft-migration: `@enkaku/otel` codecs + `@enkaku/schema` 2020-12

**Status:** complete
**Date:** 2026-06-09
**Packages:** `@enkaku/otel`, `@enkaku/schema`
**Origin:** Two upstream asks filed by mokei MCP draft-migration work (`feat/mcp-spec-update`), items **G5** (W3C trace context propagation) and **G8** (arbitrary JSON Schema 2020-12 for tool schemas). Both were blocking mokei.

Bundled into one completion doc because both shipped together on branch `feat/mokei-requirements` and share the same consumer/driver.

---

## 1. `@enkaku/otel` — `tracestate` and `baggage` codecs (G5)

### Goal
Complete the W3C Trace Context propagation surface. The package had only `traceparent` (`formatTraceparent`/`parseTraceparent`); mokei's G5 maps the full `traceparent`/`tracestate`/`baggage` trio into request `_meta`.

### What was built
- `src/tracestate.ts` — `formatTracestate` / `parseTracestate` / `type TracestateEntry`. W3C Trace Context §3.3: comma-separated `key=value`, charset-validated keys (simple + multi-tenant `tenant@system`) and values, max 32 entries, duplicate keys keep first.
- `src/baggage.ts` — `formatBaggage` / `parseBaggage` / `type BaggageEntry` / `type BaggageProperty`. W3C Baggage: percent-encoded values, optional `;`-delimited properties (valueless and `key=value`), RFC 7230 token keys, no entry cap, duplicate keys keep first.
- Both exported from `src/index.ts`.

### Key design decisions
- **Lenient, never-throwing contract:** parse drops malformed members rather than throwing; format drops invalid members + warns. Mirrors the robustness expected of header codecs on untrusted input.
- **Warning channel:** dropped/truncated members warn via `getEnkakuLogger('otel')` (`@enkaku/log`, already a dependency) — not `console`, not an injected callback. Logtape loggers are no-op until configured, so silent in tests.
- **Baggage property shape:** `Array<{ key; value? }>` — faithful to W3C (represents valueless properties), round-trips cleanly.
- **Percent-encoding via `encodeURIComponent`/`decodeURIComponent`**, wrapped in `safeEncode`/`safeDecode` so lone surrogates / malformed escapes drop the member instead of throwing (preserves the never-throws contract).
- **Duplicate-key semantics:** first *valid* occurrence wins; a malformed earlier member is dropped and does not reserve its key.

### Verification
- `pnpm --filter @enkaku/otel run test`: 75/75 pass, types clean. Lint clean.

---

## 2. `@enkaku/schema` — opt-in JSON Schema 2020-12 (G8)

### Goal
Let `createValidator`/`createStandardValidator` validate JSON Schema 2020-12 schemas (`prefixItems`, `unevaluatedProperties`, `$dynamicRef`, …) on an opt-in basis, without changing the dialect or behavior for the ~30 existing consumers. mokei's G8 loosens MCP tool `inputSchema`/`outputSchema` to arbitrary 2020-12.

### What was built
- `src/validation.ts`: `export type ValidatorOptions = { draft?: '07' | '2020-12' }`; both factory functions gain an optional `options` argument and thread it through. The single module-level AJV instance is replaced by a lazily-constructed, cached instance **per draft** (`'07'` → `Ajv`, `'2020-12'` → `Ajv2020`), with `addFormats` applied to both; `compile` + `removeSchema($id)` run on the resolved instance.
- `src/index.ts`: exports `ValidatorOptions`.

### Key design decisions
- **Opt-in, default draft-07:** a single AJV instance is locked to one dialect, so instances are cached per draft and built lazily. Default stays `'07'`, so existing consumers are byte-for-byte unchanged; mokei passes `{ draft: '2020-12' }`. Rejected: global swap to `Ajv2020` (silently changes dialect for all 30 consumers); rejected: caller-supplied AJV instance (YAGNI).
- **`Ajv2020` import:** `import { Ajv2020 } from 'ajv/dist/2020.js'` (named import, explicit `.js` extension) — required for type resolution under `nodenext`, since ajv 8.x has no `exports` map and the default-export interop is non-constructable here. Cache typed as the `Ajv | Ajv2020` union (both extend the same core). This replaced an initial ambient-`.d.ts` + cast workaround that was removed during review.
- **Typing unchanged:** kept `T = FromSchema<S>`; 2020-12 affects runtime validation, not compile-time inference.

### Verification
- `pnpm --filter @enkaku/schema run test`: 31/31 pass, types clean.
- Consumer regression: `@enkaku/token` 166/166, `@enkaku/server` 124/124, `@enkaku/hub-tunnel` 63/63 — all green on the default draft-07 path.
- Lint clean.

---

## Follow-on work

- **mokei (consumer, separate repo):** unblock and implement G5 and G8 against these APIs — wire `@enkaku/otel`'s trio into the outgoing-request `_meta` builder (`context-client`/`context-rpc`), and validate loosened tool schemas via `createValidator(schema, { draft: '2020-12' })`.
- No deferred work within enkaku; both asks shipped in full against their acceptance criteria.
