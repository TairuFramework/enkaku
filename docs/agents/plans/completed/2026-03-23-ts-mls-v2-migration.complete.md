# ts-mls v2 Migration

**Status:** complete
**Date:** 2026-03-23
**Branch:** `chore/ts-mls-v2`

## Goal

Migrate `@enkaku/group` from ts-mls v1.6.2 to v2.0.0-rc.10 — the sole ts-mls consumer in the monorepo.

## What was built

- **Dependency bump** to `ts-mls@2.0.0-rc.10` (no stable v2 release yet; pinned to RC)
- **CryptoProvider rewrite** — `getCiphersuiteImpl` now accepts a numeric ciphersuite ID instead of a full algorithm descriptor object. Added a lookup table for supported X25519+Ed25519 suites (IDs 1 and 3)
- **DID-based AuthenticationService** (`authentication.ts`) — validates MLS basic credentials by comparing the Ed25519 public key derived from the DID against the signing key in the leaf node. Handles both JSON-encoded `SerializedCredential` and plain DID string formats. Uses constant-time comparison
- **Full `group.ts` migration** — all ts-mls calls converted from positional args to v2 params objects. `GroupHandle` stores `MlsContext` instead of bare `CiphersuiteImpl`. String-literal enums replaced with numeric constants throughout
- **`processMessage` compatibility** — `GroupHandle.decrypt`/`processMessage` switched from `processPrivateMessage` to `processMessage` to handle `MlsFramedMessage` wrappers returned by v2's `createApplicationMessage`
- **Test migration** — all 3 test files updated (48 tests total, all passing)
- **e2e-expo compatibility preserved** — `GroupOptions.cryptoProvider` still works; no changes needed to `GroupEncryption.tsx`

## Key design decisions

- **Signature-only AuthenticationService** — MLS layer validates DID-to-key binding only. Capability-chain validation remains in `processWelcome` as a separate concern. This avoids circular dependencies between MLS context and the Enkaku capability system
- **Big-bang migration** — all changes in one branch. Justified because the blast radius is a single package (`@enkaku/group`) and breaking changes are acceptable (packages unreleased)
- **Custom noble CryptoProvider retained** — despite ts-mls v2 now exporting its own `nobleCryptoProvider`, the Enkaku provider is kept for React Native (Hermes) compatibility and custom RNG injection

## Follow-on work

- Update to stable `ts-mls@^2.0.0` when released (currently pinned to RC)
