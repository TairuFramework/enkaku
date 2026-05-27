# did:peer:4 MLS auth-service — small follow-ups

Loose ends from `completed/2026-05-27-did-peer-4-mls-auth-service.complete.md` that weren't already covered by `backlog/peer4-mls-leaf-rotation.md`, `backlog/workspace-test-types-pipeline.md`, or `backlog/post-quantum-algorithms.md`.

## Items

### Re-export `makeMLSCredential` from `@enkaku/group`

`packages/group/src/index.ts` re-exports `MLSCredentialIdentity` and `parseMLSCredentialIdentity` but not `makeMLSCredential`. External consumers (Kubun, Mokei) that build MLS leaves need it. One-line export addition.

Source: `packages/group/src/group.ts:64`.

### JSDoc on `createIdentity` / `IdentityKeySpec.privateKey`

`createIdentity` has minimal JSDoc; `IdentityKeySpec.privateKey` has none. Document:
- Deterministic peer4 short-form derivation when `privateKey` is provided
- Random key generation when omitted
- Method selection rules (single classical sig key → did:key, else did:peer:4) and override behavior

Source: `packages/token/src/identity.ts:155-230`, `:394`.

### CHANGELOG entry for breaking renames (optional)

The mls-auth-service plan called for a CHANGELOG covering `MultiKeyIdentity.did → .id`, `SignOptions → SignTokenOptions`, and `SerializedCredential → MLSCredentialIdentity` for downstream consumers. Repo has no CHANGELOG convention today — verify with user whether to introduce one (per-package or root) or rely on commit history / release notes.

## Priority

Low. Polish items, not blockers. The makeMLSCredential re-export is the only one that can bite a downstream consumer immediately.
