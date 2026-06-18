# Custom GroupContext extension support for kubun (consumer request)

## Context

Kubun bakes a genesis anchor into the MLS GroupContext at `createGroup`: a custom GroupContext extension carrying the creator's DID (the epoch-0 admin). The extension is set via `createGroup(identity, groupID, { extensions: [...] })` using a ts-mls `makeCustomExtension`, is meant to survive every epoch, and to reach joiners inside the authenticated `GroupInfo` (covered by its signature and confirmation tag). Kubun uses this anchor as the immutable root of an authenticated admin chain — every peer must agree on the creator, and no later commit may rewrite it.

Two enkaku gaps block this. The first makes anchored groups completely un-joinable today and is a hard blocker; the second is a hardening requirement for the immutability guarantee.

## Gap 1 — leaf nodes cannot advertise custom extension capabilities (BLOCKING)

MLS (RFC 9420) requires that every member's leaf node advertise, in its `Capabilities.extensions`, each extension type present in the GroupContext. ts-mls enforces this in `validateProposals` (`extensionsSupportedByCapabilities`). Enkaku builds all leaves via `generateKeyPackageWithKey` with `defaultCapabilities()`, whose `extensions` is empty, and neither `createGroup`, `createKeyPackageBundle`, nor `GroupOptions` expose a way to set leaf capabilities.

Consequence: a group created with any custom GroupContext extension cannot produce an invite — `commitInvite` throws on the inviter:

```
ValidationError: Added leaf node that doesn't support extension in GroupContext
    at validateProposals (ts-mls/dist/src/clientState.js:180)
    at commitInvite (@enkaku/group/lib/group.js:290)
```

So today the write/read paths work in isolation (a creator can read back its own anchor), but the group is un-joinable, which defeats the purpose. This must be fixed first.

### Request

Let consumers set leaf-node capabilities so every member's leaf advertises the custom extension type(s) the group uses. ts-mls `generateKeyPackageWithKey` already accepts an optional `capabilities` parameter; the need is to plumb it through enkaku. Concretely, a way to specify the custom extension type(s) at both:

- `createGroup` / the creator's own leaf (so the creator advertises it), and
- `createKeyPackageBundle` (so an invitee's KeyPackage advertises it, since the inviter validates the invitee's leaf against the GroupContext extensions at `commitInvite`).

### Acceptance criteria

- A group created with a custom GroupContext extension can invite and admit a new member whose KeyPackage was generated with the matching capability, with no `validateProposals` error.
- The custom extension value remains readable by the creator and every joiner after `processWelcome`.
- Groups created without custom extensions are unaffected (default capabilities unchanged).

## Gap 2 — no way to reject a commit that mutates GroupContext extensions (immutability)

MLS allows a member to rewrite the entire GroupContext extension vector via a `group_context_extensions` proposal (ts-mls `ProposalGroupContextExtensions`) carried in a commit. Enkaku exposes no way for a consumer to (a) detect that an incoming commit mutates GroupContext extensions and refuse to apply it, nor (b) veto such a proposal before state advances. Kubun needs to hard-reject any commit that mutates the genesis-anchor extension, while leaving ordinary Add/Remove/Update commits unaffected.

### Request / proposed direction (suggestion, not prescriptive)

Provide a way for the consumer to inspect and reject a commit's contained proposals before the effective state advances. Two shapes that would work:

- A policy/veto hook invoked during commit processing that receives the proposals contained in the commit and can reject the whole commit.
- Surfacing the proposal types (and, for `group_context_extensions`, the proposed extension vector) contained in a commit before state advances, so the consumer can compare against its current extensions and refuse.

A key constraint: the in-memory MLS handle advances its epoch as part of `processMessage`, so rejection must not leave the handle advanced past a commit the consumer refused. This relates to kubun's commit-atomicity work — a rejected commit must leave the handle at its pre-commit epoch.

### Acceptance criteria

- A received commit carrying a `group_context_extensions` proposal that touches kubun's anchor extension can be rejected by the consumer before the persisted/effective state advances, and the handle remains at its pre-commit epoch.
- A normal commit (Add, Remove, Update) is unaffected and applies as today.

## Priority

Gap 1 is a hard blocker for kubun's authenticated group control ledger (the anchor is un-joinable without it). Gap 2 is required before the immutability guarantee can be claimed, but kubun can proceed on the rest of the ledger once Gap 1 lands, treating immutability as a documented limitation until Gap 2 is available.
