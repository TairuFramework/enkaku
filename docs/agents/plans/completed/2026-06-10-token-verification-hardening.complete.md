# Token Verification Hardening — Completed

**Status:** complete
**Completed:** 2026-06-11
**Spec:** `docs/agents/plans/next/2026-06-10-audit-remediation-design.md` (shared audit-remediation design; retained for sibling plans)
**Commits:** `a74afb7`, `caa289d`, `7b2c735`, `46c8453`, `dead91b`, `f29730c`, `b6ae7c9` (branch `chore/fable-audit`)

## Goal

Close three verification weaknesses in `@enkaku/token` surfaced by the security audit:
1. Signature/payload decoupling on object-form tokens.
2. Inbound `verifiedPublicKey` trusted to skip verification.
3. Malleable high-S ES256 signatures accepted.

## What was built

- **Signature ↔ payload binding** (`packages/token/src/token.ts`). New `getVerifiableData` helper recomputes the signing input as `b64uFromJSON(header) + '.' + b64uFromJSON(payload)` (canonical JSON) for object-form tokens. A wire-supplied `data` is accepted only when it decodes to canonically-identical header and payload; otherwise verification throws. The signature is therefore always authenticated over the same payload used for authorization. A no-`data` token now verifies via recompute (same safety as a 3-part JWT string).
- **In-process verified-token brand** (`packages/token/src/token.ts`). Replaced the data-driven `isVerifiedToken` property check with a module-private `WeakSet` brand. Only objects returned by `verifyToken` in this process are trusted; deserialized JSON carrying a `verifiedPublicKey` property can never be a set member. Both the object and string verification branches register their result.
- **ES256 low-S enforcement** (`packages/token/src/verifier.ts`). Switched `p256.verify` from `{ lowS: false }` to `{ lowS: true }`, rejecting malleable high-S signatures.
- **Input type-guard.** Non-string wire `data` now yields the canonical "data does not match" error instead of a raw `TypeError` (fail-closed either way).

## Key design decisions

- **Canonical-JSON equality as the binding primitive.** Signers already build the signing input with canonical JSON (`b64uFromJSON` canonicalizes by default), so recomputing from a JSON-round-tripped token byte-matches what was signed. Accepting a differently-serialized `data` only when it canonically decodes to the same values preserves interop without decoupling.
- **Object-identity brand over data property.** A `WeakSet` keyed on object identity is unforgeable from the wire and survives in-place payload mutation, which is what let the capability test fixtures be fixed cleanly. It does not leak memory (weak keys).
- **Verifier algorithm comes from the resolved DID, not `header.alg`** — confirmed during review, so algorithm-confusion is independently closed.

## Downstream adjustments

- **Capability M-04 fixtures** (`packages/capability/test/lib.test.ts`) reworked to obtain genuinely-branded tokens via `verifyToken` then mutate payload in place. These previously passed only against a stale built `lib/`; the WeakSet brand made the unbranded literals invalid. Three negative iss/aud/sub cases now reject one layer up (at `isSignedToken` schema validation) — a verified token cannot carry a non-string iss/aud/sub, so this reflects the real layered defense.
- **Server outer-signature test** (`packages/server/test/outer-signature.test.ts`) updated: a token with its `data` field stripped now verifies (recompute) and the handler succeeds, where it previously expected an EK02 auth rejection. The forged-signature negative test in the same file still hard-rejects with EK02 — cryptographic enforcement intact.

## Verification

token 175, capability 71, server 124, group 101; workspace `pnpm run test` 75/75 tasks; lint clean. Each task passed spec + code-quality review; a final holistic security review approved the whole change.

## Follow-on

None. All three audit issues closed. Sibling audit-remediation plans (hub-hardening, platform-fixes, transport-stability) remain in `next/`.
