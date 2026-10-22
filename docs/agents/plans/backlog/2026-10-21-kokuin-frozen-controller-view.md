# One frozen `did:kokuin:` view per request

**Priority:** medium. Needed before enkaku accepts grants issued by `did:kokuin:` management
members; harmless but wasteful for root-issued grants today.
**Origin:** member-issued grants in `@kokuin/capability`, 2026-10-21 (kokuin repo). See kokuin's
`docs/reference/capability.md` ("Grants issued by management members").

## The problem

enkaku's server checks every request with `checkCapability({ act: procedure, res: serverID },
payload, options)` (`packages/server/src/access-control.ts`), where `options` is the
`DelegationChainOptions` it was configured with once. With a live `createControllerResolver` in
`options.methods`, each question one verification asks of the subject — the chain links' issuer keys
through `verifyToken`, `resolveMember` for a member-issued root, `resolveDenySet` for each link's
audience — is a separate resolution, and the live resolver re-loads and re-folds the log for each
(it shares only an in-flight fold, it is not a cache). One chain verification folds the log about
three times.

Cost is the smaller half. The larger is that the answers can come from **different states of the
log**: a revoke or removal landing between two of the questions gives a verdict no single state
supports — a member accepted before its removal, an audience checked after a settlement dropped its
denial. `assertMemberRoot` documents the requirement: membership, pin, lease and every audience
denial on the chain must come from one view.

## The fix

Build the options per request with a fresh frozen view and drop it after:

```typescript
const requestOptions = { ...options, methods: [controllerResolver.frozen(), ...otherMethods] }
await checkCapability({ act: procedure, res: serverID }, payload, requestOptions)
```

This needs the server to hold the `ControllerResolver` (or a factory for one) rather than a static
`methods` array, so the configuration surface changes: likely an option taking a function that
returns the methods for one request. Also check the other `checkCapability` call site in the same
file and any revocation checker that resolves the same subject, so all of them share the request's
view.

Gated on the `@kokuin/capability` / `@kokuin/controller` release carrying member grants.
