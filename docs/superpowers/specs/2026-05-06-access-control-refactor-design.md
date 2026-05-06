# Access Control Refactor — Design Spec

**Date:** 2026-05-06
**Supersedes:** `2026-05-06-access-control-did-predicate.md` (narrow predicate-only scope, replaced by this broader refactor).
**Origin:** `kubun/docs/superpowers/specs/2026-05-05-hub-first-class-entity-design.md` (Decision 7) — Q2.3 probe found Enkaku's `ProcedureAccessRecord` cannot express a DID-predicate allow rule. Investigation expanded into a holistic review of the access-control surface.

## Problem

The current `accessControl` surface has accreted three orthogonal pieces of behavior into overloaded value shapes:

```ts
// Server params
accessControl?: false | true | ProcedureAccessRecord

// Per-entry value
type ProcedureAccessValue =
  | boolean
  | Array<string>
  | { allow?: boolean | Array<string>; encryption?: EncryptionPolicy }
```

Confusions documented:

1. **Top-level boolean polarity is inverted vs entry-level.** `accessControl: false` means "public, no auth"; `accessControl: true` means "auth required, server-only". At the per-entry level, `true` means "public" and `false` means "deny/skip". Same primitive, opposite polarity.
2. **Three top-level shapes for two real modes.** Real usage in `kubun` confirms only two modes are exercised: (a) standalone server with no identity and no auth, (b) server with identity and per-procedure rules. The "identity present + `accessControl: false`" combination (signed server with public ingress) is not used in practice; `plugin-rpc` actively strips identity when `accessControl: false`.
3. **Per-entry shape mixes shorthand with config.** `boolean | Array<string> | { allow, encryption }` — three forms exist purely so the encryption field can sit alongside the allow value. Adding a DID predicate variant widens this to four shapes and deepens the overload.
4. **No predicate variant.** Hub admission needs an async, app-supplied function to decide whether a given DID is admitted. There is no place in the current API surface to plug this in. `verifyToken` is the wrong hook (per-token validity, not per-DID admission, and only runs inside delegation-chain validation).
5. **Iteration semantics are implicit.** Patterns are matched in declaration order; the first allowing match wins for admission, but encryption resolution walks all matches picking the first non-null. Two different rules over the same record, neither documented at the type level.

## Goal

Refactor the access-control surface so:

- Server params expose two clean modes (standalone vs authenticated) with no boolean overloads.
- Per-procedure rules use a single config form with an `allow` field that admits public, DID-list, or predicate variants.
- A predicate variant exists with enough context (full payload + a bound delegation helper) to express any current admission policy and host-supplied async checks.
- Iteration semantics are explicit and documented.

## Non-Goals

- No change to delegation-chain validation (`checkCapability`) semantics.
- No change to `verifyToken` semantics. It stays a per-token validity hook.
- No new auth modes beyond standalone vs authenticated.
- No change to encryption-policy resolution logic.

## Proposed Surface

### Top-level: identity-driven modes

```ts
export type ServerParams<Protocol extends ProtocolDefinition> =
  | (BaseServerParams<Protocol> & {
      identity?: undefined
      accessRules?: never
    })
  | (BaseServerParams<Protocol> & {
      identity: Identity
      accessRules?: AccessRules
    })
```

Two modes, distinguished by `identity` presence:

- **Standalone (no identity).** No token verification. `accessRules` forbidden by the type. Equivalent to today's `accessControl: false` with no identity.
- **Authenticated (identity present).** Tokens verified. `accessRules` defaults to `{}` when omitted, which means "server-only" — only the server's own signed tokens (`iss === serverID`) pass, matching today's `accessControl: true` (or omitted with identity).

Replaces today's `accessControl: false | true | Record`. The `true` value collapses into "identity provided, accessRules omitted/empty". The `false` value collapses into "identity omitted". The "identity + accessControl: false" combination is removed; callers wanting signed-but-public ingress write `accessRules: { '*': { allow: true } }` (single `'*'` is the wildcard recognised by `hasPartsMatch`; multi-asterisk segments are not special).

`HandleOptions.accessControl` follows the same shape as `accessRules` (per-handler override). Renamed for symmetry:

```ts
export type HandleOptions = {
  accessRules?: false | AccessRules    // false = override to public on this transport (still requires server identity)
  logger?: Logger
  verifyToken?: VerifyTokenHook
}
```

The `false` escape on `HandleOptions.accessRules` stays — it lets a server with identity expose a public transport (e.g. unauthenticated HTTP endpoint while WebSocket transport is authenticated). This is per-transport behavior, not per-server, and does require the server to already have an identity.

### Per-entry: single config form

```ts
export type AllowContext = {
  pattern: string                              // matched rule key (e.g. 'admin/*')
  procedure: string                            // payload.prc — actual called procedure
  payload: ProcedureAccessPayload              // iss, sub, aud, exp, prc, cap
  serverID: string                             // current server identity
  verifyDelegation: () => Promise<boolean>     // run capability chain check; true if valid
}

export type AllowPredicate = (
  ctx: AllowContext,
) => boolean | Promise<boolean>

export type AccessRule = {
  allow: true | Array<string> | AllowPredicate
  encryption?: EncryptionPolicy
}

export type AccessRules = Record<string, AccessRule>
```

Three accept forms, all wrapped uniformly in `{ allow, encryption? }`:

- `{ allow: true }` — any signed caller passes (signature still verified).
- `{ allow: ['did:key:abc', ...] }` — DID list with existing iss/sub-plus-delegation semantics (see below).
- `{ allow: ctx => predicate(ctx) }` — predicate with full message context.

There is no `{ allow: false }` form. To deny, omit the pattern. Falling off the end of the rules record produces the existing `'Access denied'` error.

The shorthand forms (`true`, `Array<string>`, bare predicate) are all removed from the per-entry value type. Every entry is a config object. Encryption is always optional, always orthogonal.

### Predicate semantics

Predicate runs once per matching pattern with a full `AllowContext`. It returns a boolean (sync or async).

- `true` → admit. Procedure call proceeds.
- `false` → continue to next pattern entry. End of record → `'Access denied'`.

Sub-delegation is the predicate's responsibility. The context exposes `verifyDelegation()`, a pre-bound helper that runs `checkCapability({ act: procedure, res: serverID }, payload, delegationOptions)` with the server's configured options and returns `true` on success, `false` on the documented capability/payload/token validity errors. Other errors propagate.

Equivalence sketch — the array form `allow: ['did:a', 'did:b']` is expressible as:

```ts
allow: async ({ payload, verifyDelegation }) => {
  const set = new Set(['did:a', 'did:b'])
  if (set.has(payload.iss)) return true
  if (payload.sub != null && set.has(payload.sub)) {
    return await verifyDelegation()
  }
  return false
}
```

Hub admission policy:

```ts
allow: ({ payload }) => allowedDIDs.has(payload.iss)
```

Hub admission with sub-delegation:

```ts
allow: async ({ payload, verifyDelegation }) => {
  const candidate = payload.sub ?? payload.iss
  if (!allowedDIDs.has(candidate)) return false
  return payload.sub == null || await verifyDelegation()
}
```

### Array form semantics (preserved)

`{ allow: Array<string> }` keeps today's behavior unchanged:

1. If `payload.iss` is in the array → admit.
2. Else if `payload.sub` is in the array → run `checkCapability({ act: procedure, res: serverID }, payload, options)`. If valid → admit. If a "validity" error (`Invalid capability`, `Invalid payload`, `Invalid token`) → continue. Other errors propagate.
3. Else continue.

This matches the legacy `Array<string>` behavior verbatim. Predicates expressing the same logic call `verifyDelegation()` themselves.

### Iteration semantics (documented)

`AccessRules` is a record. Pattern matching uses `hasPartsMatch(procedure, pattern)`. Iteration follows insertion order (`Object.entries`).

- **Admission.** First entry whose pattern matches and whose `allow` evaluates to "admit" wins. Continue through subsequent entries on "deny" or "skip". Falling off the end → `'Access denied'`.
- **Encryption resolution.** All matching entries are scanned; the first whose `encryption` is non-null wins. If no entry sets `encryption`, the server-level `encryptionPolicy` applies.

These two passes have different semantics and run independently. Documented explicitly in the module.

### Migration

Breaking change. Mechanical mapping:

| Today | New |
|-------|-----|
| `accessControl: false` (no identity) | omit both `accessControl` and `accessRules`; `identity: undefined` |
| `accessControl: false` (with identity) | not supported at server level; use `accessRules: { '*': { allow: true } }` if signed-but-public is intended |
| `accessControl: true` | omit `accessRules` (defaults to `{}` server-only) |
| `accessControl: { 'foo': true }` | `accessRules: { 'foo': { allow: true } }` |
| `accessControl: { 'foo': ['did:a'] }` | `accessRules: { 'foo': { allow: ['did:a'] } }` |
| `accessControl: { 'foo': { allow: ['did:a'], encryption: 'required' } }` | unchanged (already config form), under `accessRules` |
| `accessControl: { 'foo': false }` | omit the `'foo'` entry (no-op semantically) |
| `HandleOptions.accessControl` | `HandleOptions.accessRules` (with `false` escape preserved for per-transport public override) |

All `enkaku` callers (server tests, integration tests, hub-client, http-server-transport) are updated in the same change — `accessControl` is removed entirely, no compatibility shim. Downstream `kubun` packages migrate in a follow-up PR (see "Downstream packages" below).

## Implementation Sketch

### `packages/server/src/access-control.ts`

Replace the file's exported types and `getAllowValue`:

```ts
export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type ProcedureAccessPayload = {
  iss: string
  sub?: string
  aud?: string
  prc?: string
  exp?: number
}

export type AllowContext = {
  pattern: string
  procedure: string
  payload: ProcedureAccessPayload
  serverID: string
  verifyDelegation: () => Promise<boolean>
}

export type AllowPredicate = (ctx: AllowContext) => boolean | Promise<boolean>

export type AccessRule = {
  allow: true | Array<string> | AllowPredicate
  encryption?: EncryptionPolicy
}

export type AccessRules = Record<string, AccessRule>
```

`resolveEncryptionPolicy` updated to walk `AccessRules` and read `rule.encryption` directly (no `getEncryptionPolicy` helper needed since encryption is always at a fixed field path).

`checkProcedureAccess` body becomes:

```ts
for (const [pattern, rule] of Object.entries(rules)) {
  if (!hasPartsMatch(payload.prc, pattern)) continue

  const verifyDelegation = async () => {
    if (payload.sub == null) return false
    try {
      await checkCapability({ act: payload.prc, res: serverID }, payload, options)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (
        message.startsWith('Invalid capability') ||
        message.startsWith('Invalid payload') ||
        message.startsWith('Invalid token')
      ) {
        return false
      }
      throw err
    }
  }

  const { allow } = rule

  if (allow === true) return

  if (Array.isArray(allow)) {
    if (allow.includes(payload.iss)) return
    if (payload.sub != null && allow.includes(payload.sub)) {
      if (await verifyDelegation()) return
    }
    continue
  }

  // allow is an AllowPredicate
  const ctx: AllowContext = {
    pattern,
    procedure: payload.prc,
    payload,
    serverID,
    verifyDelegation,
  }
  if (await allow(ctx)) return
  continue
}

throw new Error('Access denied')
```

The Array branch and the predicate branch share `verifyDelegation`. The Array branch keeps its existing behavior bit-for-bit; only the loop structure is reorganized.

### `packages/server/src/server.ts`

`ServerParams.accessControl` removed. `ServerParams.accessRules` added with the typed-union shape above. Constructor logic simplifies:

```ts
const serverID = params.identity?.id

if (serverID == null) {
  if (params.accessRules != null) {
    throw new Error(
      'Invalid server parameters: "accessRules" requires "identity"',
    )
  }
  this.#accessControl = {
    requireAuth: false,
    access: {},
    encryptionPolicy: params.encryptionPolicy,
    verifyToken: params.verifyToken,
  }
} else {
  this.#accessControl = {
    requireAuth: true,
    serverID,
    access: params.accessRules ?? {},
    encryptionPolicy: params.encryptionPolicy,
    verifyToken: params.verifyToken,
  }
}
```

`HandleOptions.accessControl` renamed to `accessRules` with `false | AccessRules` shape. Override logic in `handle()` adjusted accordingly (the `false` branch keeps its existing meaning of "public on this transport").

### Downstream packages

`kubun/packages/plugin-rpc`, `plugin-http`, `plugin-p2p` (and their tests) all migrate:

- `accessControl: false` (no identity) → omit identity, omit `accessRules`. The plugins' `accessControl?: false | true | Record<string, boolean | Array<string>>` option is renamed to `accessRules?: false | AccessRules` matching server semantics.
- Tests using `accessControl: false` keep their meaning under the new shape (omit identity).
- `accessControl: { '*': true }` test cases → `accessRules: { '*': { allow: true } }`.

The plugin shape mirrors the server shape one-to-one; no plugin-internal translation logic is needed beyond renaming.

## Tests

Updated/added in `packages/server/test/`:

- **Constructor invariants.** `accessRules` without `identity` throws. `identity` present, `accessRules` omitted, defaults to server-only behavior. `identity` absent, both `accessRules` absent, builds standalone server.
- **Per-entry forms.** `{ allow: true }`, `{ allow: Array<string> }`, `{ allow: predicate }` each accept and reject as expected.
- **Predicate context.** Predicate receives correct `pattern`, `procedure`, `payload`, `serverID`. `verifyDelegation()` returns true for valid chains, false for documented invalid ones, propagates other errors.
- **Predicate sync vs async.** Both supported.
- **Predicate equivalence.** A predicate replicating the array form admits/rejects identically to a literal `Array<string>` allow.
- **Iteration order.** First matching admit wins; falling off the end → `'Access denied'`. Encryption resolution walks all matches picking the first non-null.
- **Per-transport override.** `handle({ accessRules: false })` produces public ingress on that transport; `handle({ accessRules: { ... } })` overrides the server record on that transport. `handle({ accessRules: false })` rejects on a server with no identity (preserved invariant).

End-to-end test: server + signed client, predicate-based admission for one pattern, array-based admission for another. Listed/unlisted DIDs accept and reject as expected.

## Verification

```bash
pnpm run build && pnpm run lint && pnpm test
```

clean in `enkaku`. Then update downstream `kubun` packages (`plugin-rpc`, `plugin-http`, `plugin-p2p`, hub) to the new surface and run their suites. Hub uses the predicate form to wire `HubAuthConfig.isAllowed` directly.

## Alternatives Considered

**Predicate as two-call orchestration (`did + role` per call).** Rejected — predicate is run twice, return type stays boolean, but caller has no way to express delegation control without server orchestration. Pushing delegation into the predicate via `verifyDelegation()` is more flexible and uses one call.

**Tagged-union per-entry shape (`{ allow: 'public' } | { allow: { dids } } | { allow: { predicate } }`).** Rejected — more verbose without runtime benefit. The `boolean | Array<string> | function` union distinguishes cleanly via `typeof`/`Array.isArray`.

**Keep `false` per-entry as explicit deny.** Rejected — current semantics treat `false` as "skip this entry", indistinguishable from omission. Removing it eliminates a redundant form.

**Allow `verifyToken` to deny by throwing.** Rejected — the hook only runs inside `checkCapability` for delegation-chain validation. Direct-issuer and array-direct-match calls skip it. It is the wrong layer for admission policy.
