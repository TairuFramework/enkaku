# Audit Remediation Design

**Date:** 2026-06-10
**Origin:** Full-repo audit (usability, stability, security) — four parallel investigations covering token/auth/keystores, transports/core, hub/runtime, and DX/docs.
**Status:** Approved design. Implementation split into four plans (this document is the umbrella spec).

## Context

A June 2026 audit surfaced two critical token-verification vulnerabilities, a set of hub authorization gaps, transport-edge stability bugs (explaining the recent socket-transport fix churn), and documentation/release gaps. Consumers are stack-internal only (Kubun, Mokei), so breaking changes are acceptable and docs/release work is tracked but deprioritized.

**Decisions made during brainstorming:**

- Hub anonymous mode: **removed** — `identity` becomes mandatory in `createHub`.
- ChaCha20-Poly1305 MLS suite: **fixed properly** (not removed).
- Replay protection: **backlogged** with a design sketch; only the `lowS: true` prerequisite ships now.
- Plan structure: **four implementation plans + three backlog sketches** (approach A).

## Plan 1: `token-verification-hardening` (ships first)

Scope: `packages/token` only. Both fixes verified against source before design.

### 1.1 Bind signature to payload for object-form tokens

`verifySignedPayload` (`packages/token/src/token.ts:42-70`) currently verifies the signature over the caller-supplied `token.data` string while authorization uses the separate `token.payload`. Nothing checks they correspond. An attacker holding any artifact signed by a victim (e.g. a delegated capability token) can attach an arbitrary `payload` with `iss` = victim and the victim's original `(data, signature)` — verification succeeds, impersonation achieved. The string-token path is safe (recomputes `data`, `token.ts:178`); the object path — used by the server for every wire message (`server.ts:457,563,637`) — is not.

**Fix:** for object-form signed tokens, recompute `data = b64uFromJSON(header) + '.' + b64uFromJSON(payload)` and verify the signature over the recomputed value. Wire-supplied `data` is ignored for verification.

- Serialization risk: recompute must byte-match what signers signed. Signers must use the same canonical JSON encoding (`@enkaku/codec`). Tests must round-trip tokens from every identity type (node keystore, WebCrypto/browser, HD, multikey) through `JSON.parse(JSON.stringify(...))` and verify successfully.
- Sub-decision deferred to the implementation plan: keep `data` on the wire type (ignored) vs drop it from the type entirely.

### 1.2 Never trust inbound `verifiedPublicKey`

`verifyTokenInner` (`token.ts:138-141`) returns early with no signature check when `token.verifiedPublicKey != null`. When a `Server` runs without a `protocol` (supported warn-only mode → no schema validation to strip unknown fields), an attacker includes `verifiedPublicKey` in the JSON message and bypasses verification entirely.

**Fix:** remove the data-driven short-circuit. Replace with a non-serializable brand — Symbol property or WeakSet registry of token objects verified in-process — so deserialized JSON can never satisfy `isVerifiedToken`. The server keeps its skip-reverify optimization through the brand.

### 1.3 ES256 signature malleability

`packages/token/src/verifier.ts:18-20` verifies with `lowS: false`, accepting malleable high-S signatures. Change to `lowS: true`. Our signers (`@noble/curves`) already emit low-S; no interop break. Prerequisite for future jti/signature-keyed replay dedup.

### Tests (attack-shaped regressions)

- Forged payload with victim's valid `(data, signature)` → rejected.
- Message with injected `verifiedPublicKey` against a validator-less server → rejected.
- High-S malleated signature → rejected.
- Round-trip verification per identity type (serialization canonicality).

## Plan 2: `transport-stability`

Scope: socket-transport, stream, http-client-transport, http-server-transport, client, server, async, message-transport, node-streams-transport.

### High-severity fixes

| Issue | Location | Fix |
|---|---|---|
| Socket error crashes process (`close` after `error` → `controller.close()` on errored controller → uncaughtException) | `socket-transport/src/index.ts:48-52` | Track closed/errored state; guard all controller ops; detach listeners once settled |
| UTF-8 corruption on chunk boundaries (per-chunk `toString()`, shared `TextDecoder` without `{stream:true}`) | `socket-transport/src/index.ts:49`, `stream/src/json-lines.ts:5,76` | Pass raw Buffers from socket; per-stream `TextDecoder` with `{stream:true}` + flush |
| Server read loop dies silently on transport read error; `handle().done` never settles | `server/src/server.ts:521-543` | try/catch around `transport.read()`; on error emit transport-error event and dispose disposer |
| `inflight` map leaks stream/channel rids → eventual 503-everything | `http-server-transport/src/index.ts:87,267,289` | Delete inflight entry on result/error write for that rid; sweep orphans on session end |
| SSE disconnect swallowed (empty catch) → in-flight calls hang forever, stale session | `http-client-transport/src/index.ts:148-160` | On done/catch: error or close the readable, reset `sessionState` to `idle` so next message reconnects |
| Disposer hangs forever if dispose callback rejects | `async/src/disposer.ts:27` | Rejection handler so `disposed` always settles; surface error via event/log |

### Medium-severity fixes (folded in)

- Stale transport-disposed handler after transport replacement (`client.ts:300-320`): capture transport reference, bail if `this.#transport` changed.
- `request.abort()` unhandled rejection when send failed (`client.ts:185-189`): handle `sent` rejection.
- One failed HTTP POST kills shared readable (`http-client-transport:109`): reject only that rid via synthetic error payload; reserve `controller.error` for session-level failures.
- Floating channel writes (`server.ts:669`, channel handler close): catch and route through safe-write.
- `Server#handling` grows unbounded (`server.ts:884`): remove entry when `done` settles.
- node-streams floating `pipeTo` (`node-streams-transport/src/index.ts:30`): capture, attach catch, surface via events.
- message-transport: close port on dispose; close readable so pending reads settle.
- `json-lines` invalid lines silently dropped: default `onInvalidJSON` that surfaces (event/log) instead of swallowing.

### Explicitly out of scope (backlogged design decisions)

Reconnect logic, backpressure redesign, client-side default request timeout.

### Tests

Extend the `tests/integration/server-teardown-no-unhandled.test.ts` zero-unhandled-rejection pattern to each scenario above. New socket-transport tests: socket error mid-stream, multi-byte UTF-8 split across chunks, close-after-error. SSE drop test. Inflight-leak counter test.

## Plan 3: `hub-hardening`

Scope: hub-server, hub-protocol, hub-client, plus a small server change.

- **`identity` required in `createHub`** (`hub-server/src/hub.ts:24-40`). Closes DID impersonation via unverified `payload.iss` (`handlers.ts:12-14`). Breaking; Kubun/Mokei updated afterwards.
- **`hub/group/join` validates `credential`** (`handlers.ts:174-184`) via `@enkaku/group`'s `validateGroupCapability` against the groupID. Currently accepted and dropped.
- **`hub/group/send` checks sender membership** (`handlers.ts:39-51`).
- **`hub/keypackage/fetch`**: cap `count`, per-requester rate limit — stops key-package exhaustion (`handlers.ts:165-172`, consume-on-read with no authz).
- **Protocol schema quotas**: `maxItems`/`maxLength` on `recipients`, `keyPackages`, `groupID`, `payload` in `hub-protocol`.
- **Lifecycle:**
  - try/catch around receive-bind/drain (`handlers.ts:83-146`) calling `registry.clearReceiveWriter` on failure — removes permanent receive lockout.
  - `registry.unregister` on channel abort (currently never called outside tests → unbounded growth).
  - Schedule `store.purge()` in `createHub` with configurable TTL (currently never invoked → offline mail accumulates forever).
- **Server limits for hubs**: expose `limits` through `CreateHubParams`; exempt or activity-refresh long-lived `hub/receive` channels from `controllerTimeoutMs` (default 5 min currently kills them); count long-lived channels separately from the 100-concurrent-handler cap (currently caps connected receivers at ~100 and enables starvation).

Tests: unsigned-`iss` rejection, join without valid credential fails, non-member group send fails, keypackage drain capped, receive-lockout recovery, purge eviction, >100 receivers connect successfully.

## Plan 4: `platform-fixes`

Bounded fixes across group, electron-rpc, server, protocol:

- **ChaCha20-Poly1305 AEAD** (`group/src/crypto.ts:240,342,352,481-485`): suite 3 advertises ChaCha but always encrypts AES-GCM, with key-size ternary giving 16-byte keys. Fix: dispatch on `hpkeAlg.aead`, import `chacha20poly1305` from `@noble/ciphers/chacha`, 32-byte key. Confirm no production groups exist on suite 3 (output was never spec-conformant) so no migration path is needed.
- **electron-rpc sender validation** (`electron-rpc/src/main.ts:36-41`): validate `event.senderFrame.url` against an allowlist param in `handleProcessPort`; cap/reuse servers per (sender, name) instead of unbounded creation; document that privileged handlers should use `identity`/`accessRules`.
- **Server error reply for schema-invalid messages** (`server.ts:154-177`): when validation fails and the message carries a rid, send an error reply (new EK error code) instead of silently dropping — currently the client hangs forever with no default timeout.
- **Group capability wildcard** (`group/src/capability.ts:95-97`): decide whether `res === '*'` keeps granting every group (root-identity convenience) or a `group/` prefix is required. Small decision resolved in the implementation plan.
- **Export error codes** (EK01–EK07 + the new validation code) as typed constants from `@enkaku/protocol`, replacing the source-comment-only registry (`server/src/error.ts:3-12`).

## Backlog sketches (new files in `docs/agents/plans/backlog/`)

- **`replay-protection.md`** — Server never dedups `jti`; `exp` optional → captured signed requests replayable in their validity window. Design space: per-connection jti window vs monotonic nonce, memory bounds, channel `send`/`abort` semantics, whether `exp` becomes required on RPC messages. Notes `lowS: true` already shipped (Plan 1) as prerequisite.
- **`mls-permission-enforcement.md`** — `GroupPermission` levels (admin/member/read) are never enforced on MLS operations: a read-only member can produce Add/Remove commits, and `processMessage` applies received commits without checking committer permission. Sender-side checks are easy; receiving-side commit authorization is the real design problem. Ties into `mls-capability-revocation.md`.
- **`docs-release-gaps.md`** — Tracking only (low priority; consumers are stack-internal): stale handwritten docs using removed APIs (`quick-start.mdx`, `security.mdx`, all example/guide pages — `public: true`, `createDirectTransports`, `randomTokenSigner`, `response` vs `result`); root + package README stubs; 12 packages missing from typedoc entryPoints (hub-*, group, react, otel, log, ledger-identity, hd-keystore, runtime, expo-runtime); no changesets/CHANGELOGs/tags/publish workflow; `createDirectTransports<Protocol>()` helper gap (docs describe an API that should exist); Standard Schema / zod protocol-definition input idea; `@enkaku/generator` naming trap.

## Sequencing

Plan 1 first (small, critical). Plans 2 and 3 independent, parallelizable. Plan 4 last or interleaved. Roadmap updated to list the four plans under Current Focus and the backlog additions.

## Audit findings intentionally not actioned

- Hub duplicate delivery (live + drain until ack) — documented behavior; tunnel dedups via `seq`.
- Hub-tunnel forward-jump sequencing (silent drop on hub reorder) — revisit if hub ever reorders in practice.
- OTel `tid`/`sid` header validation (`otel/src/context.ts:31-47`) — low; could fold into Plan 4 if trivial.
- electron-rpc port backpressure, keystore key zeroization, `ts-mls` RC pin (already in backlog), Node 22 CI matrix.
