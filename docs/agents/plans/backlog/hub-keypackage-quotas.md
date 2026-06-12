# Hub Keypackage Store Quotas (Sybil Fetch + Upload Caps)

**Priority:** backlog (DoS hardening; requires authenticated DIDs, no confidentiality impact)
**Origin:** June 2026 audit follow-up review of `chore/fable-audit` branch

## Problem

Two gaps remain in the `hub/keypackage/*` resource model after the audit remediation:

1. **Fetch rate limit is Sybil-bypassable and consumption is destructive** — the
   per-requester limit (`packages/hub-server/src/handlers.ts` fetch handler,
   ~300/min keyed on requester DID) does not bound drain of a *target's*
   packages: DIDs are free to generate, so N throwaway identities drain a
   victim's key packages at N×300/min. Packages are destructively consumed
   (`memoryStore.ts` `splice`), blocking new group adds for the victim and
   inflating `fetchWindows` with throwaway entries.
2. **Upload has no per-DID stored quota** — `hub/keypackage/upload` is bounded
   per call by schema caps (50 × 16KB) but call count is unlimited and the
   per-DID array in `memoryStore` grows without bound (`packages.push`).

## Sketch

- Per-*target*-DID fetch cap (bound how fast anyone, collectively, can drain a
  given DID's packages) in addition to the per-requester cap.
- MLS last-resort key-package semantics: never consume the final package,
  serve it non-destructively so the victim can always be added to groups.
- Per-DID stored-package cap on upload: reject or evict-oldest beyond N
  packages; bound `fetchWindows` map size alongside.

## Notes

- Same threat class as [replay-protection.md] — authenticated-but-cheap
  identities abusing open-relay hub semantics.
- Roster/membership checks are unaffected; this is purely keypackage store
  resource exhaustion.
