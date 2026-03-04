---
status: complete
date: 2026-03-04
branch: feat/otel
---

# Keystore OTel Refactor

Moved OpenTelemetry span creation from key entry `provide()` methods to identity creation functions across all 4 keystore packages, and renamed `signer.ts` to `identity.ts` for clarity.

## Motivation

Key entries are generic storage abstractions — not every key is necessarily a DID. OTel spans with DID attributes belong in the identity creation layer, where keys become identities and DIDs are naturally computed.

## Changes

### Rename `signer.ts` → `identity.ts`

All 4 keystores (node, browser, expo, electron) had `signer.ts` renamed to `identity.ts`. Barrel exports in `index.ts` updated accordingly. No public API changes — exported function names remain the same.

### Move spans from `entry.ts` to `identity.ts`

- **Entry files** reverted to plain get-or-create key storage with no OTel, no logger, no `safeGetDID` helper
- **Identity files** now wrap `provideFullIdentity()` / `provideSigningIdentity()` in OTel spans with attributes: `store_type`, `key_created`, `did`
- DID sourced from `createFullIdentity(key).id` / `createBrowserSigningIdentity(keyPair).id` instead of the manual `safeGetDID` helper that used `@noble/curves` directly
- `key_created` detected by calling `entry.get()` before `entry.provide()` — no interface changes needed

### Dependency cleanup

Removed `@noble/curves` from node, expo, and electron keystore `package.json` files — no longer imported after removing `safeGetDID` from entry files.
