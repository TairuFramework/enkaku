# @enkaku/protocol

## 0.22.3

### Patch Changes

- Memoize `createClientMessageSchema()` and `createServerMessageSchema()` per protocol object and message type. Every `Server` built from the same protocol now reuses one compiled validator instead of recompiling the whole protocol with ajv.

## 0.22.2

## 0.22.0

### Minor Changes

- **Breaking:** raise the `@kokuin/token` floor to `^0.6.0` and `@kokuin/capability` to `^0.5.0`. No API these packages call changed, but `VerifyTokenHook` and the `methods` registry are kokuin types, so consumers sharing them must upgrade in step. Capability chains now accept grants from `did:kokuin:` management members (`mbr` claim); verifying those needs a `methods` registry whose controller resolver implements `resolveMember` — build it with a fresh `resolver.frozen()` per verification. A non-subject chain root without `mbr` now fails with `issuer should be subject`.

## 0.21.6

## 0.21.5

## 0.21.3

## 0.21.0

### Minor Changes

- **Breaking:** raise the `@kokuin/token` floor to `^0.4.0` and `@kokuin/capability` to `^0.2.2`. Two upstream breaks reach the wire:
  - A `did:peer:4` signer now embeds its long form in `iss` for any payload without a single string `aud`. Enkaku only sets `aud` when the client is given a `serverID`, so messages signed without one change shape. Pass `embedLongForm: false` to the identity to keep the short form.
  - Base64 decoding is canonical-only. A signature or token carrying a non-canonical base64url spelling now throws `Invalid base64url encoding` instead of verifying. Every encoder in this stack emits canonical output; only hand-built or third-party payloads are affected.

  No API these packages call changed. Consumers pinned to `@kokuin/token@0.2.x`/`0.3.x` must upgrade in step.

## 0.19.0

## 0.18.1

### Patch Changes

- Update OTel setup

## 0.18.0

### Minor Changes

- Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.
