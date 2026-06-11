# Audit Remediation (June 2026) — Completed

**Status:** complete
**Completed:** 2026-06-11
**Origin:** Full-repo audit (usability, stability, security) — four parallel investigations covering token/auth/keystores, transports/core, hub/runtime, and DX/docs. Implemented as four sequential plans on branch `chore/fable-audit`.

This single document consolidates the umbrella design and the four per-plan completion summaries. It supersedes the former `2026-06-10-audit-remediation-design.md` spec and the individual `token-verification-hardening`, `transport-stability`, `hub-hardening`, and `platform-fixes` completion docs.

## Overview

A June 2026 audit surfaced two critical token-verification vulnerabilities, a set of hub authorization gaps, transport-edge stability bugs (explaining the recent socket-transport fix churn), and documentation/release gaps. Consumers are stack-internal only (Kubun, Mokei), so breaking changes were acceptable and docs/release work was tracked but deprioritized.

Brainstorming decisions that shaped the work: hub anonymous mode **removed** (`identity` mandatory in `createHub`); the ChaCha20-Poly1305 MLS suite **fixed properly** rather than removed; replay protection **backlogged** with a design sketch, shipping only the `lowS: true` prerequisite now; structure = **four implementation plans + three backlog sketches**.

Plan 1 shipped first (small, critical). Plans 2–4 all touch `packages/server`, so they were executed sequentially (2 → 3 → 4) to keep the repo green after every commit. Every fix across all four plans was gated by an attack- or failure-shaped regression test following the existing zero-unhandled-rejection pattern, and each task passed two-stage review (spec compliance, then code quality) plus a final per-plan holistic composition review.

**Final verification (whole branch):** `pnpm run build` 39/39; `pnpm run test` 76/76 tasks; lint clean (`rtk proxy pnpm run lint`, 501 files).

---

## Plan 1: Token Verification Hardening

**Commits:** `a74afb7`, `caa289d`, `7b2c735`, `46c8453`, `dead91b`, `f29730c`, `b6ae7c9`. Scope: `packages/token`.

Closed three verification weaknesses in `@enkaku/token`:

- **Signature ↔ payload binding** (`token.ts`). `verifySignedPayload` verified the signature over the caller-supplied `data` string while authorization used the separate `payload` — nothing checked they corresponded, so any artifact signed by a victim could be paired with an attacker-chosen `payload` (`iss` = victim) for impersonation. The object-token path (used by the server for every wire message) was vulnerable; the string-token path was already safe. New `getVerifiableData` helper recomputes the signing input as `b64uFromJSON(header) + '.' + b64uFromJSON(payload)` (canonical JSON); a wire-supplied `data` is accepted only when it decodes to canonically-identical header and payload, else verification throws. A no-`data` token verifies via recompute (same safety as a 3-part JWT string).
- **In-process verified-token brand** (`token.ts`). `verifyTokenInner` returned early with no signature check when `token.verifiedPublicKey != null` — against a validator-less (warn-only) server with no schema stripping, an attacker injected `verifiedPublicKey` in the JSON and bypassed verification entirely. Replaced the data-driven property check with a module-private `WeakSet` brand keyed on object identity; only objects returned by `verifyToken` in-process are trusted, and deserialized JSON can never be a member.
- **ES256 low-S enforcement** (`verifier.ts`). Switched `p256.verify` from `{ lowS: false }` to `{ lowS: true }`, rejecting malleable high-S signatures. Our `@noble/curves` signers already emit low-S, so no interop break. Prerequisite for future jti/signature-keyed replay dedup.

**Key decisions:** canonical-JSON equality as the binding primitive (recompute byte-matches what signers signed; a differently-serialized `data` is accepted only if it canonically decodes to the same values, preserving interop without decoupling); object-identity brand over a data property (unforgeable from the wire, survives in-place payload mutation, no memory leak via weak keys); the verifier algorithm comes from the resolved DID, not `header.alg`, independently closing algorithm-confusion.

**Downstream adjustments:** capability M-04 fixtures reworked to obtain genuinely-branded tokens via `verifyToken` then mutate payload in place (three negative iss/aud/sub cases now reject one layer up at `isSignedToken` schema validation — a verified token cannot carry a non-string iss/aud/sub); the server outer-signature test updated so a `data`-stripped token now verifies via recompute, while the forged-signature negative test still hard-rejects with EK02.

---

## Plan 2: Transport Stability

**Commits:** `c42481b`, `9fccf60`, `8882771`, `d5b06b3`, `1df3ef5`, `f4416d5`, `51637a4`, `9631b00`, `7ac4b7a`, `d919070`, `573e58f`, `c984866`, `d2aeb17`, `fe65f92`, `d341d10`, `b329c7c`, `3f090db`. Scope: socket-transport, stream, http-client-transport, http-server-transport, client, server, async, node-streams-transport, message-transport, integration.

Sixteen localized fail-closed fixes plus one cross-task hardening fix found in final review:

- **socket-transport** — settled-state guard on the `ReadableStream` controller so a `close` after an `error` no longer calls `controller.close()` on an errored controller (process crash); listeners detached on settle; raw `Buffer` passed through to the decoder instead of per-chunk `toString()`.
- **stream/json-lines** — per-instance streaming `TextDecoder` (`{ stream: true }` + flush) so multi-byte UTF-8 split across chunks no longer corrupts, and concurrent streams no longer share decoder state; a default `onInvalidJSON` that surfaces dropped lines instead of silently discarding them.
- **server** — `transport.read()` wrapped so a read rejection settles `handle()`, emits a new `transportError` event, and disposes cleanly; floating channel writer promises caught; settled transports spliced out of `#handling` (with a public `activeTransportsCount` getter).
- **http-server-transport** — stream/channel rids released from the inflight map on terminal payloads and session teardown, so the server no longer wedges into blanket 503s.
- **http-client-transport** — SSE disconnects now error/close the readable and reset session state (in-flight calls reject instead of hanging); a non-ok POST enqueues a per-rid error payload (`EK_HTTP_REQUEST_FAILED`) instead of erroring the shared session; all controller enqueues guarded against an already-errored readable.
- **client** — `#setupTransport` captures the transport and stale-guards its disposed handler so a replaced transport can't abort a healthy client; `request.abort()` handles a rejected `sent` promise.
- **async/Disposer** — `disposed` always settles even when the dispose callback (or a user `onDisposeError`) rejects/throws, surfacing the error via a new optional `onDisposeError` (fallback `console.warn`).
- **node-streams-transport / message-transport** — the floating `pipeTo` is caught and surfaced via `writeFailed`; message-transport dispose closes the readable controller and the port (and detaches `onmessage`).
- **integration** — a new cross-package test destroys both sockets mid-request over real Unix sockets and asserts zero `uncaughtException`/`unhandledRejection`, request rejection, and clean disposal.

**Key decisions:** fail-closed guards over behavioral rewrites (each fix is a guard/catch on a known crash/leak path, keeping the repo green after every commit); an errored readable is the transport-death signal (recovery is the Client layer's transport-replacement path, not in-transport reconnect); per-rid rejection vs. session kill (one failed POST rejects only its rid; `controller.error` is reserved for session-level failures); `disposed` must always settle (Transport/Client/Server all extend Disposer, so a hanging `disposed` cascades into every teardown chain).

**Cross-task hardening (final review):** the OK-response `res.json().then(enqueue, error)` path could throw an unhandled rejection when a concurrent SSE disconnect had already errored the shared readable; both callbacks are now guarded (`3f090db`).

**Known limitations (backlogged):** in-transport SSE reconnect (recovered only via Client-layer transport replacement); MessageTransport dispose-before-materialize still skips port close when the lazy stream never initialized (the correct fix is base `Transport.dispose()` gating, cross-cutting across all transports).

---

## Plan 3: Hub Hardening

**Commits:** `220fe08`, `98074b7`, `6fbce53`, `29a4405`, `ca9d4f1`, `fee698c`, `315e9ae`. Scope: hub-server, hub-protocol, hub-client, plus a server limits change.

Closed hub authorization gaps and lifecycle leaks:

- **`identity` mandatory in `createHub`** — the client DID is now derived only from the server-verified `iss` of signed messages; `getClientDID` throws on an unauthenticated message instead of returning `'anonymous'`. `createHub` defaults `accessRules` to `{ 'hub/*': { allow: true } }` (an open relay for any *authenticated* DID — per-procedure authorization lives in the handlers).
- **`hub/group/join` validates the credential** via `@enkaku/group`'s `validateGroupCapability` against the groupID, and checks the capability `aud` matches the client's verified DID. An optional `delegationChain` on the wire supports member capabilities deeper than one delegation hop.
- **`hub/group/send` requires sender membership** — derived from the verified sender DID; an unknown group (no members) is rejected by the same check.
- **`hub/keypackage/fetch` is capped and rate-limited** — per-fetch `count` cap and a per-requester-DID sliding-window rate limit, both configurable through `CreateHubParams.keyPackageFetchLimits`.
- **Protocol schema quotas + runtime validation enabled** — `maxItems`/`maxLength`/bounds on every hub client-message field, and `createHub` passes `protocol: hubProtocol` to `serve()` so violating messages are dropped (and surfaced via `invalidMessage`).
- **Lifecycle fixes** — `hub/receive` bind/drain failure clears the writer binding (receive-lockout recovery); `registry.unregisterIfIdle` evicts clients with no bound writer *and* no group memberships (bounding registry growth without dropping offline group members from store routing); `createHub` schedules `store.purge()` on a configurable interval, cleared on dispose.
- **`longLivedProcedures` server limit** — named procedures are exempt from `controllerTimeoutMs` and counted in a separate `activeLongLivedHandlers` counter that bypasses `maxConcurrentHandlers` (bounded only by `maxControllers`). `createHub` always adds `hub/receive`, so open mailbox channels survive the 5-minute timeout and never starve the 100-handler budget.

**Key decisions:** trust only the verified `iss` (every authorization decision keys off that single cryptographically-verified value; nothing client-supplied in the procedure param feeds authz); open relay for authenticated DIDs with authorization in handlers (the signature gate, not the access rule, stops forgery); self-issued capability bootstraps a fresh group (the hub keeps no group-owner registry by design — capability validation proves the credential is valid for the group and audience, deeper membership bound through the delegation chain); `unregisterIfIdle` not unconditional unregister (group fan-out reads membership from the registry, so an offline member must stay registered — eviction requires both no bound writer and zero memberships); errored/validation-dropped messages never acquire a slot (the server pipeline drops schema-invalid, oversized, and auth-failed messages before `processHandler`); separate long-lived counter over a timeout rewrite (a flood of long-lived opens is bounded by `maxControllers`, default 10000 — the documented trade-off).

**Breaking changes:** `createHub` requires `identity` (clients must pass `identity` + `serverID`); `HubClient.joinGroup` changed from positional `(groupID, credential?)` to `joinGroup({ groupID, credential, delegationChain? })` with a mandatory, validated capability; `hub/group/send` requires prior group join; protocol schemas enforce quotas (oversized messages dropped). The schema-invalid-without-reply gap was closed by Plan 4's EK08 reply.

---

## Plan 4: Platform Fixes

**Commits:** `8e24755`, `955c69b`, `f9bb0c5`, `5b547fc`, `cdfe6ba`. Scope: group, server, protocol, electron-rpc.

Five bounded, per-package fixes:

- **ChaCha20-Poly1305 AEAD for MLS suite 3** — suite 3 advertised `CHACHA20POLY1305` but always encrypted with AES-GCM under a 16-byte key. `nobleCryptoProvider` now dispatches on `hpkeAlg.aead` (AES128GCM→16-byte+gcm, AES256GCM→32-byte+gcm, CHACHA20POLY1305→32-byte+chacha20poly1305, unknown→throw). The HPKE AEAD-ID mapping was already correct, so only the cipher and key size were wrong. Output was never spec-conformant (confirmed no Kubun/Mokei source uses suite 3), so no migration was needed.
- **Server EK08 reply for schema-invalid messages** — a schema-invalid request/stream/channel message was dropped after the `invalidMessage` event, leaving the client hanging forever (no default client timeout). `processMessage` now sends an EK08 `HandlerError` reply when the raw payload carries a string `rid` on a reply-capable `typ`; events/aborts/sends and rid-less messages get no reply; the `invalidMessage` event is unchanged. This closed the known limitation carried over from Plan 3.
- **Typed EK error-code registry** — EK01–EK08 moved from a source comment in `server/src/error.ts` to an `ErrorCodes` constant + `ErrorCode` union exported from `@enkaku/protocol`, re-exported by `@enkaku/server` and `@enkaku/client`. The string values are byte-identical, so every existing literal comparison and wire consumer keeps working.
- **electron-rpc sender allowlist + per-sender server reuse** — a pure, vitest-testable `isAllowedSenderURL` (exact / `*`-prefix / RegExp forms, empty allowlist denies all, no electron import) gates the `ipcMain` create handler through an optional `allowedSenderURLs`; `serveProcess` keeps one live server per `(sender, name)`, disposing the previous server and port on a repeat create request and on sender destroy, instead of growing servers without bound.
- **Group capability `*` wildcard documented** — `validateGroupCapability` keeps its `res === '*'` global-wildcard support (root identities rely on stack-wide capabilities); the blast radius is now spelled out in the JSDoc and at the matching site.

**Key decisions:** fix at the dispatch point not the suite table (AES paths stay byte-for-byte unchanged); error reply only when someone is waiting (EK08 sent solely for rid-bearing reply-capable messages; the `invalidMessage` observability event still fires in all cases); one wire registry with identical values (codes live in `@enkaku/protocol`, the lowest shared package, re-exported upward — a pure refactor guarded by existing literal assertions); frame-URL allowlist is a filter not authentication (documented as such — privileged handlers still need `identity`/`accessRules`; the `*`-prefix match keeps the trailing separator so `https://app.example.com/*` rejects `app.example.com.evil.io`); bounded server reuse keyed on sender ID (the destroy handler guards `active.get(senderID)?.server === server` so a reload-then-destroy race cannot evict the replacement); keep the wildcard and document the blast radius rather than silently removing it.

**Cross-task interaction:** Plans-4 Tasks 2 and 3 both touch `server.ts`/`error.ts` — Task 2 adds the `EK08` literal, Task 3 converts every `'EKnn'` literal to an `ErrorCodes.*` constant and swaps the comment registry for the protocol re-export. Correctly sequenced; the only `EK_*` strings left in server source are the two OTel `EK_ENCRYPTION` span attributes (not wire error codes).

---

## Backlog sketches produced by the audit

- **`backlog/replay-protection.md`** — the server never dedups `jti` and `exp` is optional, so captured signed requests are replayable within their validity window. `lowS: true` (Plan 1) shipped as the prerequisite so signature bytes or `jti` can safely key a dedup set.
- **`backlog/mls-permission-enforcement.md`** — `GroupPermission` levels are never enforced on MLS operations; sender-side checks are easy, receiving-side commit authorization is the real design problem.
- **`backlog/docs-release-gaps.md`** — stale handwritten docs using removed APIs, README stubs, missing typedoc entryPoints, no changesets/CHANGELOGs/tags/publish workflow (tracking only; consumers are stack-internal).

## Audit findings intentionally not actioned

Hub duplicate delivery (documented behavior; tunnel dedups via `seq`); hub-tunnel forward-jump sequencing (revisit only if the hub ever reorders); OTel `tid`/`sid` header validation; electron-rpc port backpressure; keystore key zeroization; `ts-mls` RC pin (already backlogged); Node 22 CI matrix.

## Follow-on

None blocking. The four-plan audit-remediation sequence is fully landed on `chore/fable-audit`. Independent plans remaining in `next/` (neither depends on this audit): `2026-06-11-kubun-audit-boundary-items.md` and `mls-capability-revocation.md`. The three backlog sketches above remain open.
