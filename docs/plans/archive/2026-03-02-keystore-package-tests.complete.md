# Keystore Package Test Suites (T-05)

**Status:** Complete
**Completed:** 2026-03-03
**Security audit issue:** T-05 — zero unit test coverage across all 4 keystore packages

## Summary

Added 78 unit tests across all four keystore packages, covering KeyEntry lifecycle (get/set/provide/remove, sync + async variants), KeyStore creation and caching, and identity helper functions.

## Changes

| Package | Tests | Key coverage |
|---------|-------|-------------|
| `@enkaku/node-keystore` | 23 | NodeKeyEntry lifecycle, NodeKeyStore singleton/caching, provideFullIdentity |
| `@enkaku/electron-keystore` | 18 | ElectronKeyEntry with encryption mocks, ElectronKeyStore singleton, provideFullIdentity |
| `@enkaku/expo-keystore` | 15 | ExpoKeyEntry lifecycle, ExpoKeyStore factory, randomPrivateKey utils, provideFullIdentity |
| `@enkaku/browser-keystore` | 22 | BrowserKeyEntry with mock IDB, BrowserKeyStore validation/caching, SubtleCrypto utils, ECDSA signing identity |

## Approach

- Vitest with `vi.mock()` for platform-specific dependencies (@napi-rs/keyring, electron/electron-store, expo-secure-store/expo-crypto, IndexedDB)
- Class-based mocks to avoid arrow function constructor issues
- `vi.hoisted()` for mock functions used in `vi.mock` factories
- Real Node.js SubtleCrypto for browser-keystore crypto tests (ECDSA P-256, DID generation, JWT signing)
- Mock IDB using `queueMicrotask` for async callback simulation
