# Port hub-tunnel from Kubun

**Status:** complete
**Date:** 2026-05-03
**Branch:** `feat/hub-tunnel`

## Goal

Land `@enkaku/hub-tunnel@0.14.0` in the Enkaku monorepo with sources ported from `kubun/packages/hub-tunnel/`, the wire format aligned to Enkaku message envelopes, and the package ready to publish so any Enkaku consumer can build hub-mediated peer-to-peer transports without pulling in Kubun.

## What was built

- **`@enkaku/hub-tunnel@0.14.0`** scaffolded in `packages/hub-tunnel/` with workspace deps on `@enkaku/async`, `@enkaku/codec`, `@enkaku/hub-protocol`, `@enkaku/protocol`, `@enkaku/schema`, `@enkaku/transport`. `@enkaku/protocol` promoted from devDep to runtime dep so frame schema can validate `body` at runtime
- **Modules ported 1:1**: `encryptor.ts` (interface only, no shipped impls), `errors.ts`, `events.ts`, `encrypted-transport.ts`. Schema `$id` renamed `urn:kubun:…` → `urn:enkaku:…` in `envelope.ts` and `frame.ts`
- **`frame.ts` rewritten** as discriminated union `kind: 'message' | 'session-end'`. `'message'` body validates against `createMessageSchema(permissivePayloadSchema)` — envelope shape enforced, payload-shape validation deferred to consumer protocol. `'session-end'` carries optional `reason`
- **`transport.ts` write path** stamps `kind: 'message'` unconditionally (kind is structural, not derived from `payload.typ`); read path narrowed with explicit `kind !== 'message'` guard so TS can prove `body` access is safe
- **`index.ts` re-exports** drop `hubFrameKinds`/`HubFrameKind`; surface adjusted to new shape
- **Test suite ported** — 20 files, 63 tests passing. `frame.test.ts` rewritten for new schema (round-trip + negatives for missing/extra body, unknown kind, malformed body, non-JSON, `correlationID`, `additionalProperties`, integer-seq). 5 transport-* tests rewritten to assert outer `kind: 'message'` plus inner `body.payload.typ`. 14 others copied with kind literals aligned
- **Integration test** `tests/integration/test/hub-tunnel-echo.test.ts` exercises client/server echo round-trip through `createHubTunnelTransport` over an in-memory hub double with a noop `Encryptor`
- **Docs** — new `docs/agents/hub-tunnel.md` (wire format, encryptor contract, session lifecycle, observability, errors); `docs/agents/architecture.md` lists the package under Hub & Group Communication and adds a Hub-tunneled Transport subsection under RPC Framework Patterns

## Key design decisions

- **Discriminated union over opaque kind enum.** Outer `kind` distinguishes only between hub-tunnel control frames and frames carrying an Enkaku message; the inner `payload.typ` is the single source of truth for application-layer dispatch. Eliminates the duplicated kind ladder (`rpc-req`/`rpc-resp`/`ch-open`/…) the Kubun version maintained alongside Enkaku's own typing
- **No compat shim for old kinds.** Hub-tunnel was unreleased; no peer in the wild sends `rpc-*`/`ch-*`. Strict schema from day one — `FrameDecodeError` on any mismatch
- **Encryptor interface only — no shipped impls.** Real crypto belongs in layers that own key lifecycle (MLS, Noise, etc.). AEAD with associated-data binding (sessionID/seq), replay defense, and key rotation are documented caller responsibilities
- **Permissive inner payload schema.** Frame validation enforces the Enkaku envelope shape (`{header, payload}`, signature presence) but accepts any `payload.typ` — full payload validation is the consumer protocol's job, not the transport's
- **Test fixtures stay in `test/fixtures/`**, not exported from the package. Integration test inlines its own in-memory hub double rather than depending on test-only exports

## Follow-on work

- **Publish `@enkaku/hub-tunnel@0.14.0` to npm** (`pnpm --filter @enkaku/hub-tunnel publish --access public`) after this branch merges. Plan Task 15 — gated by maintainer
- **Kubun-side cutover PR** (separate, in Kubun repo): add catalog entry, replace `@kubun/hub-tunnel: workspace:*` with `@enkaku/hub-tunnel: catalog:` in `@kubun/plugin-p2p` and other consumers, update `vi.spyOn` targets in three sync test files, delete `kubun/packages/hub-tunnel/`. Tracked in `kubun/docs/agents/plans/next/port-hub-tunnel-to-enkaku.md`
