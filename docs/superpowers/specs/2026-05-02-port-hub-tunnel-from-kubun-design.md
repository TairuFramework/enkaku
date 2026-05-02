# Port hub-tunnel from Kubun to `@enkaku/hub-tunnel`

## Context

`@kubun/hub-tunnel` is the peer-to-peer Enkaku transport that tunnels
Enkaku messages through a hub relay using a JSON-encoded `HubFrame`. It
was built inside the Kubun repo to unblock hub-mediated MLS-encrypted
document sync (Kubun PR #31), but it has zero `@kubun/*` dependencies
and no Kubun-specific behaviour: the encryptor is pluggable
(`Encryptor` interface), and the transport is generic over any Enkaku
protocol.

The package belongs in the Enkaku monorepo so any Enkaku consumer can
build hub-mediated peer-to-peer transports without pulling in Kubun.

This spec covers the Enkaku-side work: porting the package, aligning
the wire format with Enkaku's RPC envelopes, and publishing. The Kubun
cutover (renaming the dependency, deleting the old package directory)
is tracked separately on the Kubun side; this spec calls out the
handoff but does not cover the Kubun PR itself.

## Goals

1. Land `@enkaku/hub-tunnel` in the Enkaku monorepo with sources ported
   1:1 from `kubun/packages/hub-tunnel/`, except for the wire-format
   alignment described below.
2. Align `HubFrame` with Enkaku message envelopes: outer frame
   discriminates only between carried Enkaku messages and hub-tunnel
   control frames; inner body is a standard Enkaku message validated
   against schemas from `@enkaku/protocol`.
3. Publish `@enkaku/hub-tunnel@0.14.0` to npm so Kubun (and any future
   consumer) can depend on it.

## Non-Goals

- **Kubun-side migration.** Renaming Kubun's dependency, removing
  `kubun/packages/hub-tunnel/`, and updating `@kubun/plugin-p2p`
  imports happen in a Kubun PR after this work publishes. See
  "Cutover handoff" below.
- **New transport features.** Reconnect, idle timeout, backpressure,
  observability events are already implemented; ported as-is.
- **Wire-protocol versioning.** `HUB_FRAME_VERSION` stays `1`. The
  package is unreleased; no peers in the wild rely on the previous
  kind enum.
- **Splitting `Encryptor` into a separate package** (e.g.
  `@enkaku/encryptor`). Revisit only if a second consumer outside
  hub-tunnel appears.
- **Shipping default `Encryptor` implementations** (no-op or
  symmetric). Real crypto belongs in layers that own key lifecycle
  (MLS, Noise, etc.). Callers bring their own implementation.

## Design

### Package layout

```
enkaku/packages/hub-tunnel/
├── src/
│   ├── encrypted-transport.ts   (ported)
│   ├── encryptor.ts             (interface only — no shipped impls)
│   ├── envelope.ts              (ported, $id renamed)
│   ├── errors.ts                (ported)
│   ├── events.ts                (ported)
│   ├── frame.ts                 (rewritten — see Wire format)
│   ├── transport.ts             (ported, write path simplified)
│   └── index.ts                 (re-exports)
├── test/                        (~63 tests ported, fixtures kept)
├── package.json
├── README.md                    (minimal — points to docs/agents/hub-tunnel.md)
├── tsconfig.json
└── LICENSE.md
```

### `package.json`

Initial version: `0.14.0` (matches the monorepo baseline; all other
Enkaku packages are at `0.14.x`).

```jsonc
{
  "name": "@enkaku/hub-tunnel",
  "version": "0.14.0",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "dependencies": {
    "@enkaku/async":       "catalog:",
    "@enkaku/codec":       "catalog:",
    "@enkaku/hub-protocol":"catalog:",
    "@enkaku/protocol":    "catalog:",
    "@enkaku/schema":      "catalog:",
    "@enkaku/transport":   "catalog:"
  },
  "devDependencies": {
    "@enkaku/client": "catalog:",
    "@enkaku/server": "catalog:",
    "@enkaku/token":  "catalog:"
  }
}
```

`@enkaku/protocol` is promoted from devDep to runtime dep because the
frame schema validates `body` against Enkaku message schemas at
runtime.

### Wire format

`HubFrame` is a discriminated union. Outer `kind` distinguishes only
between hub-tunnel control frames and frames carrying an Enkaku
message; the inner Enkaku message envelope's `payload.typ` is the
single source of truth for application-layer dispatch.

```ts
export const HUB_FRAME_VERSION = 1

export type HubFrame =
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'message'
      body: EnkakuMessage  // {header, payload} from @enkaku/protocol
    }
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'session-end'
      reason?: string
    }
```

**JSON Schema** (`$id: 'urn:enkaku:hub-tunnel:frame'`): discriminated
union via `oneOf` keyed on `kind`.

- `kind: 'message'` branch — `body` required, validates against the
  `anyOf(signedMessageSchema, unsignedMessageSchema)` pattern produced
  by `@enkaku/protocol`'s `createMessageSchema`. Note:
  `createMessageSchema` is currently `@internal` in `@enkaku/protocol`;
  reuse implies either dropping the `@internal` tag or extracting a
  stable helper. Decide during implementation.
- `kind: 'session-end'` branch — no `body`; optional `reason: string`.

**Write path (`transport.ts`):** outbound application frames stamp
`kind: 'message'` and place the caller-supplied Enkaku message in
`body`. The write path no longer inspects `body.payload.typ` to choose
a kind; kind is structural, not type-derived. `session-end` frames are
written by the lifecycle layer.

**Read path:** `decodeFrame` validates the discriminated schema. Kind
or body shape mismatch raises `FrameDecodeError`. Strict from day one
— no permissive transitional period, since the package is unreleased.

**Migration from current Kubun shape:** zero compat shim. Old kinds
(`rpc-req`, `rpc-resp`, `rpc-err`, `ch-open`, `ch-msg`, `ch-close`,
`ch-err`) are dropped. Hub-tunnel is unreleased; no peer in the wild
sends them.

**Envelope schema** (`urn:enkaku:hub-tunnel:envelope`): `$id` renamed
from `urn:kubun:...` to `urn:enkaku:...`. Schema otherwise unchanged.

### Encryptor surface

```ts
export type Encryptor = {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>
}
```

Interface only — no shipped implementations. Callers supply their own
encryptor: `MLSEncryptor` lives in `@kubun/plugin-p2p`; future
consumers bring whatever fits their key-exchange model.

**Contract** (documented in JSDoc + `docs/agents/hub-tunnel.md`):

- `encrypt` produces ciphertext that the peer's `decrypt` reverses.
- AEAD with associated-data binding (sessionID, seq), replay defense,
  and key rotation are caller responsibilities. Hub-tunnel does not
  dictate key exchange; callers establish a shared key out-of-band
  (MLS, Noise, OPAQUE, etc.) before transport startup.
- Failures throw; existing `EncryptError` / `DecryptError` from
  `errors.ts` propagate.

**Test fixture:** `test/fixtures/FakeEncryptor` ports as-is. Stays in
`test/fixtures/`; not exported from the package.

### Tests

**Port plan.** Copy `kubun/packages/hub-tunnel/test/` →
`enkaku/packages/hub-tunnel/test/` 1:1. Update imports to relative
paths within the package.

Test files (~63 cases across 18 files) ported as-is:

```
test/
├── fixtures/                                  (FakeHub, FakeEncryptor, helpers)
├── echo-protocol.test.ts
├── encrypted-transport-decrypt-fail.test.ts
├── encrypted-transport-e2e.test.ts
├── encrypted-transport-encrypt-fail.test.ts
├── encrypted-transport-observability.test.ts
├── encrypted-transport-opacity.test.ts
├── encrypted-transport-tampered.test.ts
├── encrypted-transport.test.ts
├── envelope.test.ts
├── fake-encryptor.test.ts
├── fake-hub.test.ts
├── frame.test.ts                              (rewritten — Shape Y schema)
├── transport-auto-session.test.ts
├── transport-backpressure.test.ts
├── transport-channel.test.ts
├── transport-concurrent.test.ts
├── transport-lifecycle.test.ts
├── transport-ordering.test.ts
├── transport-reconnect.test.ts
└── transport.test.ts
```

**Rewrites required (not 1:1 ports):**

- `frame.test.ts` — new Shape Y schema. Add round-trip cases per
  Enkaku `payload.typ` carried inside `kind: 'message'`, plus
  `session-end` cases with and without `reason`. Add negative cases
  (missing `body` for `kind: 'message'`, body present for `kind:
  'session-end'`, malformed Enkaku message, unknown `kind`).
- `transport-*.test.ts` — anywhere a test asserts `kind: 'rpc-req'` /
  `'ch-msg'` / etc., update to `kind: 'message'` and assert the inner
  `body.payload.typ` instead.

**Integration test.** New
`tests/integration/hub-tunnel-echo.test.ts` in the existing
`@enkaku/integration-tests` package (top-level `tests/integration/`):

- Two peers (client + server) using `@enkaku/client` and
  `@enkaku/server`.
- `FakeHub` copied locally into the integration test (package
  `test/fixtures/` is not exported from `@enkaku/hub-tunnel`).
- Local noop `Encryptor` defined inline.
- Echo `RequestProcedure` round-trips request/result through the
  tunnel.
- Asserts: happy-path round-trip, `session-end` cleanly closes the
  transport.

### Documentation

**`packages/hub-tunnel/README.md`** (minimal — matches Enkaku
package-README precedent of ~6 lines):

```markdown
# @enkaku/hub-tunnel

Peer-to-peer Enkaku transport tunneled through a hub relay. Carries
any Enkaku protocol over a pluggable `Encryptor` (BYO key exchange).

See `docs/agents/hub-tunnel.md` for wire format, Encryptor contract,
and session lifecycle.
```

**`docs/agents/hub-tunnel.md`** (new, full reference):

1. Overview — what it does, when to use vs direct transports.
2. Architecture — layers (`HubLike` → `HubTunnelTransport` →
   `EncryptedHubTunnelTransport` → Enkaku client/server), with
   diagram.
3. Wire format — `HubFrame` discriminated shape, schema
   `urn:enkaku:hub-tunnel:frame`, kinds `message` / `session-end`,
   body = Enkaku message envelope. Encryption envelope
   `urn:enkaku:hub-tunnel:envelope`.
4. Encryptor contract — interface, AEAD / replay / rotation
   expectations, failure semantics.
5. Session lifecycle — open, seq ordering, `session-end` semantics,
   reconnect, idle timeout, backpressure.
6. Observability — `ObservabilityEvent` / `FrameDroppedReason` event
   surface.
7. Errors — exported error types and when each is thrown.

**`docs/agents/architecture.md`:**

- Add `@enkaku/hub-tunnel` to the `#### Hub & Group Communication`
  subsection under Key Packages.
- Add a short "Hub-tunneled transport" subsection under `## RPC
  Framework Patterns` alongside "Transport Layer", pointing to
  `docs/agents/hub-tunnel.md`.

### Repo wiring

- `pnpm-workspace.yaml`: add `@enkaku/hub-tunnel: 0.14.0` to the
  `catalog:` section. Workspace `packages: ['packages/*', ...]` glob
  already covers the new directory.
- `biome.json`: existing `packages/*` glob covers it; no change.
- `tsconfig.json` references: follow per-package pattern used by
  sibling packages; no repo-root tsconfig change.

## Cutover handoff to Kubun

Sequencing — Enkaku side does, Kubun side consumes:

1. **Enkaku PR lands** with the package, tests green, version
   `0.14.0`.
2. **Publish to npm** via `pnpm --filter @enkaku/hub-tunnel publish`.
   Confirm `@enkaku/hub-tunnel@0.14.0` resolves from the registry.
3. **Signal to Kubun side.** Reference Kubun's
   `docs/agents/plans/next/port-hub-tunnel-to-enkaku.md` and PR #31
   review comment in the Enkaku PR description; note that `0.14.0` is
   published and the Kubun cutover is unblocked.
4. **Kubun PR (separate, not part of this work)** then:
   - Adds catalog entry `@enkaku/hub-tunnel: ^0.14.0` to
     `kubun/pnpm-workspace.yaml`.
   - Replaces `@kubun/hub-tunnel: workspace:*` with
     `@enkaku/hub-tunnel: catalog:` in `@kubun/plugin-p2p` and any
     other consumers.
   - Updates imports `@kubun/hub-tunnel` → `@enkaku/hub-tunnel`.
   - Updates `vi.spyOn` targets in
     `hub-tunnel-sync-integration.test.ts`,
     `hub-tunnel-sync-listener.test.ts`,
     `hub-tunnel-sync-provider.test.ts`.
   - Deletes `kubun/packages/hub-tunnel/`.
   - Moves `kubun/docs/agents/plans/next/port-hub-tunnel-to-enkaku.md`
     to `completed/`.

This Enkaku spec covers steps 1–3. Step 4 lives in a Kubun-side plan
written after publish.

## Risks & mitigations

- **Concurrent edits in `kubun/packages/hub-tunnel/`** between the
  Enkaku port branch starting and the Kubun cutover PR landing.
  Mitigation: freeze `kubun/packages/hub-tunnel/` once the Enkaku port
  branch starts.
- **Wire format divergence in flight.** Mitigation: Kubun does not
  consume the new Enkaku package until publish; the existing
  `@kubun/hub-tunnel` keeps shipping its current shape until the
  cutover PR replaces it wholesale.
- **Strict frame schema surfaces latent bugs** where a frame was
  decoded against the old permissive schema. Mitigation: covered by
  rewritten `frame.test.ts` and the integration test; the strictness
  is the point — catch mismatches in CI rather than at runtime.

## Verification

- `pnpm --filter @enkaku/hub-tunnel test` — unit + types pass.
- `pnpm --filter @enkaku/integration-tests test` —
  `hub-tunnel-echo.test.ts` passes.
- `pnpm run build && pnpm run test` at repo root — full suite green.
- Manual: `npm view @enkaku/hub-tunnel@0.14.0` resolves after publish.

## References

- Kubun-side plan:
  `kubun/docs/agents/plans/next/port-hub-tunnel-to-enkaku.md`.
- Original review thread requesting kind/typ alignment:
  Kubun PR #31, comment `#discussion_r3176466846`.
- In-code marker today: `// TODO(enkaku-port)` in
  `kubun/packages/hub-tunnel/src/transport.ts` at the hardcoded
  `kind: 'rpc-req'` write site.
