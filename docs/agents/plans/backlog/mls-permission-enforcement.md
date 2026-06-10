# MLS Group Permission Enforcement

**Priority:** backlog (authz gap; capabilities currently advisory beyond invite acceptance)
**Origin:** June 2026 audit (`2026-06-10-audit-remediation-design.md`)

## Problem

`GroupPermission` levels (`admin`/`member`/`read`) travel in group capabilities but are never enforced on MLS operations (`packages/group/src/group.ts`):

- Any member holding group state — including a `read`-only member — can produce Add/Remove commits (`commitInvite`, `removeMember`).
- `processMessage` applies received handshake commits without checking the committer's permission level.

Capabilities are only verified at invite acceptance (`processWelcome`).

## Sketch

1. **Sender-side checks (easy)** — `commitInvite`/`removeMember` check `group.credential.permission` locally before committing. Honest-client guard only; a modified client skips it. Could fold into a small fix wave.
2. **Receiving-side commit authorization (the real fix)** — When `processMessage` sees a handshake message with Add/Remove proposals, resolve the committer's leaf → DID → capability and require `admin` (or `member` for self-removal). Needs: capability distribution to all members (piggyback on MLS extension? hub lookup?), and a policy for external commits/resync.
3. **Document advisory semantics** — If enforcement belongs to the application/delivery-service layer, state that explicitly in `@enkaku/group` docs and keep permissions as UI/policy hints.

## Dependencies

- Ties into `mls-capability-revocation.md` — both need committer-identity → capability resolution at `processMessage` time; design them together.

## Notes

- The validator hook location is the same as the revocation plan's: a check that runs before `mlsProcessMessage` in `GroupHandle.processMessage`.
- `validateGroupCapability` (`packages/group/src/capability.ts`) already validates chains; what is missing is wiring it to received commits and distributing the capability material.
