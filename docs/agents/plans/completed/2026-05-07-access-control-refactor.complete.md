# Access Control Refactor

**Status:** complete
**Date:** 2026-05-07
**Branch:** `feat/access-control`

## Goal

Replace Enkaku's overloaded `accessControl` server option with a tightly-typed `accessRules` surface and add a DID-predicate allow variant carrying full message context, so Hub-style admission policies can be expressed without server orchestration hooks.

## What was built

- **`ServerParams` discriminated union** — identity presence drives the auth mode. No identity ⇒ standalone (`accessRules` forbidden by the type). Identity present ⇒ authenticated, with `accessRules` defaulting to `{}` (server-only).
- **`HandleOptions.accessRules`** — renamed from `accessControl`. Keeps the `false` escape hatch for per-transport public ingress on a signed server.
- **Single per-rule config form** — `AccessRule = { allow: true | Array<string> | AllowPredicate; encryption?: EncryptionPolicy }`. Shorthand boolean/array values gone; deny means "omit the pattern".
- **`AllowPredicate` variant** — `(ctx: AllowContext) => boolean | Promise<boolean>`. Context exposes `pattern`, `procedure`, `payload`, `serverID`, and a bound `verifyDelegation()` helper.
- **`checkProcedureAccess` rework** — Array branch unchanged bit-for-bit; predicate branch added; `verifyDelegation` shared closure across both.
- **Consumer migration** — `@enkaku/standalone`, `@enkaku/hub-server`, `@enkaku/electron-rpc`, and all integration/test files moved off `accessControl` to `accessRules`. No compatibility shim. `ServerAccessOptions` shared type extracted so `standalone`/`server`/`serve` reuse one discriminated-union shape.
- **Test coverage** — 11-case `access-control-predicate.test.ts` (context fields, sync/async, `verifyDelegation` valid/missing, array equivalence, iteration order, throw/reject behaviour) plus end-to-end `tests/integration/access-control-predicate.test.ts`.

## Key design decisions

- **Identity-driven auth mode, not a boolean flag.** Real usage exercises only standalone-no-identity and authenticated-with-identity. The "identity + `accessControl: false`" combination was unused in practice and removed; signed-but-public ingress is now an explicit `accessRules: { '*': { allow: true } }`.
- **Single `{ allow, encryption? }` per-entry shape.** Three accept forms (`true | Array<string> | AllowPredicate`) all wrap uniformly. Encryption stays orthogonal at a fixed field path. No `{ allow: false }` — denial is omission.
- **Predicate carries `verifyDelegation()` rather than orchestrating sub-delegation server-side.** Lets host-supplied predicates express any current admission policy (DID-list with delegation, role gates, async ACL lookups) and replicate the array form exactly. Keeps capability-chain semantics unchanged.
- **Iteration semantics documented.** Admission walks rules in insertion order; first match that admits wins. Encryption resolution walks all matches and picks the first non-null `encryption`. Two passes, two semantics, now stated explicitly.
- **Predicate context is intentionally narrow.** No full `SignedToken`, no `role` slot — rejected for now. Reopen if a use case appears.

## Follow-on work

- **Kubun migration.** `kubun/packages/plugin-rpc`, `plugin-http`, `plugin-p2p`, and the hub package all consume the old shape and need a parallel rename. Plugin option `accessControl?: false | true | Record<...>` becomes `accessRules?: false | AccessRules` with one-to-one mapping; no plugin-internal translation needed.
- **Hub `isAllowed` integration.** The Q2.3 Hub probe wires `HubAuthConfig.isAllowed` directly via the new predicate form on the kubun side.
