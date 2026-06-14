# Channel `send` missing `prc` — silent data loss on validating servers

**Status:** complete · **Date:** 2026-06-14 · **Branch:** `fix/hub-send`

## Goal

`Client.createChannel().send()` built its payload as `{ typ: 'send', rid, val }` — omitting `prc`. Servers built with a `protocol` build a validator; the per-procedure send schema requires `prc`, so every real-client channel `send` failed validation and was **silently dropped** (the validation-failure branch emitted error replies only for `request`/`stream`/`channel`, never `send`). Most impactful: hub `hub/receive` acks were discarded, so kubun mailboxes never drained (unbounded growth + full redelivery on reconnect). Goal: include `prc` so sends validate, and stop dropping invalid sends silently.

## Root cause (history)

Latent since **v0.8 (Dec 2024)**, not a recent hub regression:
- `715c0c3` (Oct 2024): send schema born without `prc` — client agreed.
- `2d83d0c` (Dec 19 2024, "Refactor docs for v0.8"): an over-eager consistency pass added `prc` (const procedure) to the send schema + `required`, but never updated the client builder. The divergence point.
- `b5a3437` (Dec 7 2024): server validator added — only matters when a `protocol` is passed.
- `04db9ac` (#34): added error-replies for the other three types, leaving `send` the lone silent case (made the silence conspicuous; did not cause it).

Unsurfaced because the bug needs a server that is **both** validator-on **and** receiving a real client send. `createHub` (`serve({ protocol: hubProtocol })`) is the first such consumer; existing `channel-send-auth` tests hand-rolled tokens that already included `prc`.

## Key design decisions

- **Conform the client to the schema (add `prc`), not drop `prc` from the schema.** `prc` is redundant for *routing* — the server routes a send purely by `rid` and never reads `prc` — but it is the discriminator the stateless validator needs (the client-message schema is an `anyOf` of per-procedure branches keyed `prc: {const: procedure}`, validated before routing). Adding `prc` keeps validation in one stateless place and aligns send with the four other client payload types. The alternative (stateful send-`val` validation by `rid`, no `prc`) was rejected as more change for a cosmetic win.
- **Ergonomics: reply with an error on an invalid send (Approach A).** A send shares the channel's `rid` and `send()` only awaits the write, so the error reply routes through the client's existing `'error'` path and tears the channel down. Accepted: loud failure beats silent data loss; after the core fix the common case never fails.
- **Out of scope:** per-send ids / making `send()` await an ack (would require a protocol change).

## What was built

- `packages/client/src/client.ts` — send payload now `{ typ: 'send', prc: procedure, rid, val }`.
- `packages/protocol/src/types/{calls,payloads}.ts` — `SendCallPayload<Procedure, Value>` carries `prc`; threaded through `ClientPayloadOf` (concrete `Procedure`) and `SendPayloadOf`/`UnknownCallPayload` (`string`).
- `packages/server/src/server.ts` — `send` added to the validation-failure error-reply branch (EK08).
- Tests: standalone validator-on round-trip; server invalid-send EK08 + `invalidMessage`; hub `store.ack` regression guard (spy + post-ack `fetch` drain assertion); updated wire-shape assertions in `client/test/lib.test.ts`.

## Verification

Full suite green (76/76 packages). `pnpm run -r build:types` clean. Lint clean. Each test verified to fail when its fix is reverted. Per-task spec + quality reviews and a final full-branch review passed (ready to merge).

Backward compat: a new client's `prc` is required by any validating server since Dec 2024 and ignored by validator-off servers; an old client (no `prc`) now gets a loud EK08 instead of a silent drop — a strict improvement.
