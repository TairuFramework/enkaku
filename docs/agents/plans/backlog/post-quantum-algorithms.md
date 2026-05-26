# Post-quantum algorithms (ML-DSA, ML-KEM)

**Priority:** backlog
**Predecessors:** [did:peer:4 PQ-friendly identifiers](../completed/2026-05-26-did-peer-4-pq-friendly.complete.md)

## Goal

Plug `paulmillr/noble-post-quantum` (ML-DSA signatures, ML-KEM key encapsulation, optionally SLH-DSA) into the `@enkaku/token` algorithm registry, so identities can hold PQ keys end-to-end.

## Phasing (recommended)

1. **Verifier-only.** Add ML-DSA `Verifier` to the existing `Verifiers` map. Allows enkaku servers to verify tokens signed by external PQ identities, no keystore changes.
2. **Node + Electron signing.** Generate / store ML-DSA private keys via `node-keystore` and `electron-keystore` (no size constraints in those backends). Wire `KeyAlg` enum + multicodec entries.
3. **JWE hybrid KEM.** New envelope variant `alg: 'X25519+ML-KEM-768'` (or similar hybrid). Combines existing X25519 ECDH with ML-KEM encapsulation. Don't replace the X25519-only path — add an opt-in hybrid.
4. **Browser + Expo keystore refactor.** Both currently hardcode classical algs and have size constraints incompatible with PQ key material (browser `SubtleCrypto` has no ML-DSA; Expo `expo-secure-store` has iOS Keychain ~4 KB cap that ML-DSA-87 exceeds). Move to raw bytes in IndexedDB / split storage.

Each phase is its own design+plan.

## Notes

- The `did:peer:4` foundation already supports long-form docs containing multiple keys, so a single identity can hold classical + ML-DSA + X25519 + ML-KEM keys; the algorithm work just adds verifier/codec entries and key generation paths.
- `MultiKeyIdentity.sign({ kid })` already lets clients choose which key signs — useful for hybrid transitions.
- Defer MLS PQ ciphersuites until the IETF `draft-ietf-mls-combiner` lands and `ts-mls` supports them.
- Defer Ledger PQ until firmware support exists.

## References

- noble-post-quantum: <https://github.com/paulmillr/noble-post-quantum>
- ML-DSA-65: ~1.9 KB pubkey, ~3.3 KB signature → tokens go from ~200 bytes to ~7 KB.
- ML-KEM-768: ~1.2 KB pubkey, ~1.1 KB ciphertext.
