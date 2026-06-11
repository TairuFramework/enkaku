# Platform Fixes — Completed

**Status:** complete
**Completed:** 2026-06-11
**Spec:** `docs/agents/plans/next/2026-06-10-audit-remediation-design.md` (shared audit-remediation design; retained as the historical reference for all four completed sibling plans, the roadmap, and backlog plans)
**Commits:** `8e24755`, `955c69b`, `f9bb0c5`, `5b547fc`, `cdfe6ba` (branch `chore/fable-audit`)

## Goal

Ship the bounded Plan-4 fixes from the June 2026 audit-remediation design — the last of four sibling plans (token-verification → transport-stability → hub-hardening → platform-fixes). Each fix is local to one package: real ChaCha20-Poly1305 for MLS suite 3, server error replies for schema-invalid messages, a typed EK error-code registry in `@enkaku/protocol`, electron-rpc sender-frame validation plus per-sender server reuse, and explicit documentation of the group capability `*` wildcard blast radius.

## What was built

Five tasks, each gated by a bug- or failure-shaped regression test:

- **ChaCha20-Poly1305 AEAD for MLS suite 3** — suite 3 advertised `CHACHA20POLY1305` but always encrypted with AES-GCM under a 16-byte key. `nobleCryptoProvider` now dispatches on `hpkeAlg.aead` (AES128GCM→16-byte+gcm, AES256GCM→32-byte+gcm, CHACHA20POLY1305→32-byte+chacha20poly1305, unknown→throw). The HPKE AEAD-ID mapping was already correct, so only the cipher and key size were wrong.
- **Server EK08 reply for schema-invalid messages** — a schema-invalid request/stream/channel message was dropped after the `invalidMessage` event, leaving the client hanging forever (no default client timeout). `processMessage` now sends an EK08 `HandlerError` reply when the raw payload carries a string `rid` on a reply-capable `typ`; events/aborts/sends and rid-less messages get no reply; the `invalidMessage` event is unchanged. This closes the known limitation carried over from hub-hardening.
- **Typed EK error-code registry** — the EK01–EK08 codes moved from a source comment in `server/src/error.ts` to an `ErrorCodes` constant + `ErrorCode` union exported from `@enkaku/protocol`, re-exported by `@enkaku/server` and `@enkaku/client`. The string values are byte-identical, so every existing literal comparison and wire consumer keeps working.
- **electron-rpc sender allowlist + per-sender server reuse** — a pure, vitest-testable `isAllowedSenderURL` (exact / `*`-prefix / RegExp forms, empty allowlist denies all, no electron import) gates the `ipcMain` create handler through an optional `allowedSenderURLs`; `serveProcess` keeps one live server per `(sender, name)`, disposing the previous server and port on a repeat create request and on sender destroy, instead of growing servers without bound.
- **Group capability `*` wildcard documented** — `validateGroupCapability` keeps its `res === '*'` global-wildcard support (root identities rely on stack-wide capabilities); the blast radius is now spelled out in the JSDoc and at the matching site so it can never be mistaken for an oversight.

## Key design decisions

- **Fix at the dispatch point, not the suite table.** Suite 3's HPKE AEAD-ID was already correct (`0x0003`); only the cipher factory and key size were wrong. Dispatching on `hpkeAlg.aead` keeps the AES paths byte-for-byte unchanged while making ChaCha spec-conformant. Output was never spec-conformant, so no migration was needed (confirmed: no Kubun/Mokei source uses suite 3).
- **Error reply only when someone is waiting.** EK08 is sent solely for `request`/`stream`/`channel` messages that carry a string `rid` — the only cases where a client blocks on a reply. Events, aborts, and sends are fire-and-forget, so they get no reply; the `invalidMessage` observability event fires in all cases regardless. The reply routes through the existing `context.send`/`safeWrite` (never-rejects) path like every other error site.
- **One wire registry, same values.** Error codes are part of the wire protocol, so the registry lives in `@enkaku/protocol` (the lowest shared package) and is re-exported upward. Keeping the exact `'EKnn'` string values means the typed constants are a pure refactor — existing literal assertions across the server/client test suites are the regression guard, not a thing to migrate.
- **Frame-URL allowlist is a filter, not authentication.** `isAllowedSenderURL` restricts which frames receive a transport; it is deliberately pure and electron-free so it is unit-testable (ipcMain is e2e-only). It is documented as *not* an auth mechanism — privileged handlers must still use the server's `identity`/`accessRules`. The `*`-prefix match keeps the trailing separator in the compared prefix, so `https://app.example.com/*` rejects `app.example.com.evil.io`.
- **Bounded server reuse keyed on sender ID.** `serveProcess` holds one server per sender; the destroy handler guards `active.get(senderID)?.server === server` so a reload-then-destroy race cannot evict the replacement server. `dispose()` is idempotent and fire-and-forget here because the port is already closed.
- **Keep the wildcard, document the blast radius.** `res === '*'` is intentionally retained for root identities; the security trade-off is made explicit rather than silently removed, since other parts of the Yulsi stack depend on stack-wide `*` capabilities.

## Verification

Full workspace `pnpm run build` 39/39; `pnpm run test` 76/76 tasks (electron-rpc gained a unit-test task); lint clean (`rtk proxy pnpm run lint`, 501 files). Per-package after the work: group 105 (incl. suite-3 ChaCha tests), server 138 (incl. `invalid-message-reply`), client 43, protocol 14 (incl. `error-codes`), electron-rpc 5 (new vitest suite). Each task passed spec + code-quality review; the doc-only Task 5 was verified by direct diff inspection. A final holistic composition review approved the whole set: the one genuinely coupled interaction (Task 2 introduces the `EK08` literal, Task 3 converts it to `ErrorCodes.INVALID_MESSAGE`) is correctly sequenced with the wire value preserved; no orphan code literals, no duplicate exports, no build-ordering hazard, and the electron dispose-reuse logic is sound against the real `Server.dispose()` contract.

## Cross-task interaction (caught in holistic review)

Tasks 2 and 3 both touch `server/src/server.ts` and `server/src/error.ts`: Task 2 adds the `code: 'EK08'` literal and an EK08 comment-registry line; Task 3 then replaces every `'EKnn'` literal with an `ErrorCodes.*` constant and swaps the entire comment registry for the protocol re-export. The sequencing is intentional and clean — the final tree has a single source of truth in `@enkaku/protocol` with no dangling EK08 comment and no remaining raw error-code literal (the only `EK_*` strings left in server source are the two OTel `EK_ENCRYPTION` span attributes, which are not wire error codes).

## Breaking changes (downstream consumers: Kubun, Mokei)

None at the wire level. New surface only:
- `@enkaku/protocol`, `@enkaku/server`, `@enkaku/client` now export `ErrorCodes` + `ErrorCode` (same string values — existing literal comparisons unaffected).
- `@enkaku/electron-rpc` adds optional `allowedSenderURLs` on `handleProcessPort`/`serveProcess` and exports `isAllowedSenderURL`/`SenderURLAllowlist`/`HandleProcessPortOptions`; existing callers compile unchanged (params are optional).
- MLS suite 3 ciphertext changes to genuine ChaCha20-Poly1305 — only relevant if any consumer had pinned the previous (non-conformant) output, which none do.

## Follow-on

None blocking. This completes the four-plan June 2026 audit-remediation sequence. Independent plans remaining in `next/`: `2026-06-11-kubun-audit-boundary-items.md` and `mls-capability-revocation.md` (neither depends on the audit-remediation design). The shared design spec is retained as the historical reference for all four completed plans, the roadmap, and the backlog.
