# Hub Hardening — Completed

**Status:** complete
**Completed:** 2026-06-11
**Spec:** `docs/agents/plans/next/2026-06-10-audit-remediation-design.md` (shared audit-remediation design; retained for sibling plan platform-fixes)
**Commits:** `220fe08`, `98074b7`, `6fbce53`, `29a4405`, `ca9d4f1`, `fee698c`, `315e9ae` (branch `chore/fable-audit`)

## Goal

Close the hub authorization gaps and lifecycle leaks from the June 2026 audit (Plan 3 of the audit-remediation design): DID impersonation via unverified `payload.iss`, unvalidated group join, non-member group send, key-package exhaustion, unbounded protocol message sizes, receive lockout, registry growth, never-purged mail, and the server's 5-minute timeout + 100-handler cap killing long-lived `hub/receive` channels.

## What was built

Seven tasks, each gated by attack- or failure-shaped regression tests following the existing zero-unhandled-rejection pattern:

- **`identity` mandatory in `createHub`** — the client DID is now derived only from the server-verified `iss` of signed messages; `getClientDID` throws on an unauthenticated message instead of returning `'anonymous'`. `createHub` defaults `accessRules` to `{ 'hub/*': { allow: true } }` (an open relay for any *authenticated* DID — per-procedure authorization lives in the handlers).
- **`hub/group/join` validates the credential** via `@enkaku/group`'s `validateGroupCapability` against the groupID, and checks the capability `aud` matches the client's verified DID. An optional `delegationChain` on the wire supports member capabilities deeper than one delegation hop.
- **`hub/group/send` requires sender membership** — derived from the verified sender DID; an unknown group (no members) is rejected by the same check.
- **`hub/keypackage/fetch` is capped and rate-limited** — per-fetch `count` cap and a per-requester-DID sliding-window rate limit, both configurable through `CreateHubParams.keyPackageFetchLimits`.
- **Protocol schema quotas + runtime validation enabled** — `maxItems`/`maxLength`/bounds on every hub client-message field, and `createHub` now passes `protocol: hubProtocol` to `serve()` so violating messages are dropped (and surfaced via `invalidMessage`) instead of the quotas being dead code.
- **Lifecycle fixes** — `hub/receive` bind/drain failure clears the writer binding (receive-lockout recovery); `registry.unregisterIfIdle` evicts clients with no bound writer *and* no group memberships (bounding registry growth without dropping offline group members from store routing); `createHub` schedules `store.purge()` on a configurable interval, cleared on dispose.
- **`longLivedProcedures` server limit** — named procedures are exempt from `controllerTimeoutMs` and counted in a separate `activeLongLivedHandlers` counter that bypasses `maxConcurrentHandlers` (bounded only by `maxControllers`). `createHub` always adds `hub/receive` to the list, so open mailbox channels survive the 5-minute timeout and never starve the 100-handler budget.

## Key design decisions

- **Trust only the verified `iss`.** Because `serve()` cryptographically verifies signed messages when an `identity` is configured, every handler can trust `payload.iss`. All authorization (group membership, capability `aud`, rate-limit identity) keys off that single verified value — nothing client-supplied in the procedure param feeds an authorization decision.
- **Open relay for authenticated DIDs, authorization in handlers.** The default `hub/*` allow rule is intentional: the hub is a blind relay; the signature gate (not the access rule) is what stops forgery, and per-procedure checks (membership, capability) run after verification.
- **Self-issued capability = group bootstrap.** `validateGroupCapability` accepts a self-issued root capability (iss === sub === aud) for a fresh group — the first self-issuer is the creator. The hub keeps no group-owner registry, so capability validation proves "this credential is valid for this group and audience", not "an external owner admitted you". Deeper membership is bound through the delegation chain. This is the accepted threat model; a hub-side owner registry was deliberately not added.
- **`unregisterIfIdle`, not unconditional unregister.** Group fan-out reads membership from the registry, not the store, so an offline group member must stay registered. Eviction requires *both* no bound writer and zero group memberships — fixing one-shot-client growth without breaking offline group routing.
- **Errored/validation-dropped messages never acquire a slot.** The server pipeline drops schema-invalid, oversized, and auth-failed messages *before* `processHandler`, so no invalid message consumes a controller or long-lived handler slot (and a rate-limited fetch dropped by validation never consumes a rate-limit token).
- **Separate long-lived counter over timeout rewrite.** Exempting `hub/receive` from the timeout and the concurrency cap via a separate counter (bounded by `maxControllers`) was the smallest change satisfying both constraints; a flood of long-lived opens is bounded by `maxControllers` (default 10000), the documented trade-off.

## Verification

Full workspace `pnpm run build` 39/39; `pnpm run test` 75/75 tasks; lint clean (`rtk proxy pnpm run lint`, 495 files). Per-package after the work: server 133, hub-protocol 6, hub-server 58 (including `>100 receive channels` and `hub/receive outlives controllerTimeoutMs`), hub-client 6, integration 42. Each task passed spec + code-quality review; a final holistic composition review approved the whole change set (auth × validation × long-lived-accounting compose correctly; no slot leak on the receive drain-failure path; idle-unregister preserves offline group routing; no stale `joinGroup` callers). Hub teardown test confirms zero unhandled rejections.

## Cross-task corrections (caught in review)

Tasks 1 and 2 each broke `tests/integration/hub-agent-scenarios.test.ts` — the plan's per-task file lists missed it (mandatory `identity` on `createHub` + clients needing `serverID`; then the breaking `HubClient.joinGroup` positional→object signature). Both fixes were folded into their respective commits, with each integration client self-issuing its group credential (consistent with the bootstrap model).

## Breaking changes (downstream consumers: Kubun, Mokei)

1. `createHub` requires `identity`; hub clients must pass `identity` + `serverID` (unsigned clients rejected).
2. `HubClient.joinGroup(groupID, credential?)` → `joinGroup({ groupID, credential, delegationChain? })` with a mandatory, validated capability.
3. `hub/group/send` requires the sender to have joined the group on the hub.
4. Protocol schemas enforce quotas (runtime validation enabled): oversized messages are dropped (client-visible error reply for schema-invalid messages ships with the platform-fixes plan).

## Known limitations (deliberately out of scope)

- **Schema-invalid messages are dropped without a client reply** — a client sending an oversized/malformed message hangs until disposal. The error-reply-on-validation-failure fix is Plan 4 (platform-fixes).
- **No hub-side group-owner registry** — self-issued capabilities bootstrap any fresh group by design (see decisions above).
- **`count` schema `maximum: 10` caps below a larger configured `maxCount`** — the protocol schema rejects `count > 10` before the handler's operator-configurable cap applies; strictly more restrictive, documented rather than changed.

## Follow-on

None blocking. Sibling audit-remediation plan **platform-fixes** (`2026-06-10-platform-fixes.md`) remains in `next/` and includes the schema-invalid error reply noted above. The shared design spec is retained for it.
