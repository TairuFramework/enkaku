# MLS External Rejoin (Stale Device Recovery)

**Status:** complete
**Completed:** 2026-04-20
**Branch:** `mls-external-rejoin`

## Goal

Add RFC 9420 external-commit support to `@enkaku/group`, scoped to the stale-device self-rejoin case: an existing member whose local MLS state has fallen behind on epochs rejoins the group fresh using only the group's published public state plus its previously-stored credential. Unblocks kubun's `mls-external-join-stale-recovery` backlog item.

## Key Design Decisions

- **Framed `MLSMessage(GroupInfo)` on the wire (RFC 9420 §6.1)**, not raw `GroupInfo`. Self-describing blob (`ProtocolVersion + WireFormat + GroupInfo`) crosses the trust/transport boundary correctly; other MLS libraries can consume it. Size overhead is negligible.
- **Ratchet tree always embedded.** `includeRatchetTree: false` option dropped — consumer for the fresh-tree-missing path doesn't exist, and supporting it would require a separate `tree?` param on the joiner side. YAGNI; can be added later when a concrete use case appears.
- **Bytes-only public API.** Both `exportGroupInfo` and `joinGroupExternal` accept/return `Uint8Array`. Codec (`mlsMessageEncoder`/`Decoder`) stays internal — consumers never touch `ts-mls` types. Adding a `tree?` param or an `extensions` param can be layered on without breaking the wire.
- **`resync: true` as a literal type, not `boolean`.** `JoinGroupExternalParams.resync: true` makes the "non-resync external join out of scope" promise unbreakable at compile time. Non-resync external join will need its own API.
- **Credential reuse, no re-validation.** Stale rejoin reuses the caller's previously accepted `MemberCredential` from `processWelcome`. The capability chain is not re-checked during `joinGroupExternal`. Re-validation can be added later if a storage-tampering threat is in scope; for now, trust what the caller stored. Members still validate the commit sender's identity via normal MLS processing.
- **No deep `ts-mls` imports.** Spec originally proposed deep-importing `ts-mls/dist/src/message.js`; implementation used the main barrel (`encode`, `decode`, `mlsMessageEncoder`, `mlsMessageDecoder`, `wireformats`, `protocolVersions`, `defaultExtensionTypes`) instead — all reachable from the published entry point. Upgrade risk dropped accordingly.
- **Codec upgrade-guard test is semantic, not just syntactic.** Asserts `external_pub` + `ratchet_tree` extension presence (via `defaultExtensionTypes` constants) in addition to byte-stable round-trip. A silent ts-mls change that drops either extension from `GroupInfo` fails the test.
- **Removal is not revocation (documented prominently).** MLS has no cryptographic member revocation — a device that retains its `MemberCredential` and can reach a fresh `GroupInfo` can rejoin even after removal. README ships the warning, two mitigations (group rotation, transport-layer deny-serve), and a pointer to the follow-up spec.

## What Was Built

- **`@enkaku/group` — `exportGroupInfo`** — Wraps `createGroupInfoWithExternalPubAndRatchetTree`, frames as `MLSMessage(GroupInfo)`, encodes to `Uint8Array`. Any current member can call; stateless w.r.t. epoch advancement.
- **`@enkaku/group` — `joinGroupExternal`** — Decodes framed `GroupInfo` bytes, generates a fresh key package for the rejoining identity, calls `ts-mls.joinGroupExternal({ resync: true })`, frames the returned `PublicMessage` into `MLSMessage(PublicMessage)` bytes, and wraps state in a new `GroupHandle` using the caller's cached credential. Guards: empty `capabilityChain` → error with the same message as `processWelcome`; wrong wireformat → error naming what was received.
- **Public exports** — `exportGroupInfo`, `joinGroupExternal`, `ExportGroupInfoParams`, `ExportGroupInfoResult`, `JoinGroupExternalParams`, `JoinGroupExternalResult` from `@enkaku/group`.
- **Tests (5 new, all in `packages/group/test/external-rejoin.test.ts`)** — codec round-trip with extension presence assertions, two-member stale rejoin round-trip including `resync` leaf-count check, empty-chain rejection, three-member convergence (non-joiner members also process the rejoin commit correctly), and public-API export surface.
- **`packages/group/README.md`** — New file. Package overview, capabilities list, external-rejoin section with code snippet showing the decode-before-processMessage pattern consumers need, trust model, transport responsibilities, not-yet-supported list, and the removal-is-not-revocation security warning.

## Scope Notes

Design-review phase resolved seven tradeoff questions before planning began; those resolutions are captured in the spec (`docs/superpowers/specs/2026-04-20-mls-external-rejoin-design.md`) and informed the plan decisions above. Two rounds of code review post-implementation: an initial round flagged three Important issues (unnecessary cast, weak codec-test, ambiguous README wording); all three fixed in `cdbfd27`. Final pre-merge review: approved.

## Outcomes

- 10 commits on `mls-external-rejoin`; 63/63 tests pass in `@enkaku/group`; workspace build + lint clean.
- Kubun's `mls-external-join-stale-recovery` path is unblocked — consumer calls `exportGroupInfo` on the server side, ships the blob over the hub, and the stale device calls `joinGroupExternal`.

## Follow-ups (out of scope, future work)

- **Capability-layer member revocation** — Extracted to `docs/agents/plans/backlog/mls-capability-revocation.md`. Needed before "fresh external join with new DID" can ship, and closes the removal-is-not-revocation gap documented in the README.
- **Fresh external join by a new DID** — Requires the revocation story above plus a `MemberCredential` acquisition flow for non-members.
- **`proposeAddExternal` wrapper** — Member-initiated proposal to add an external party. Different flow, different API.
- **Non-resync external join** — Type-enforced out for now. Add an API variant when a consumer needs it.
- **`tree?` param on `joinGroupExternal`** — Only if a use case for not embedding the ratchet tree in `GroupInfo` materialises.
- **`authenticatedData` round-trip test** — Field is passthrough to ts-mls; add when a real caller uses it.
- **Byte-accepting `GroupHandle.processMessage`** — Today consumers must `decode(mlsMessageDecoder, commitMessage)` before passing to `processMessage`. A byte overload would eliminate the decode-at-every-call-site pattern. Ergonomics, not correctness.
