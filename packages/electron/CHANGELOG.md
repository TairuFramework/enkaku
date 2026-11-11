# @enkaku/electron

## 0.23.3

## 0.23.2

### Patch Changes

- Declare every package imported by published code: `@enkaku/protocol` moves to `dependencies` in client, electron, react and standalone, `@enkaku/transport` moves to `dependencies` in protocol, and react and electron gain `react` and `electron` peer dependencies. Strict installs (isolated linker, no hoisting) no longer fail to resolve these from the published declarations.

## 0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies:
  - @enkaku/client@0.23.0
  - @enkaku/server@0.23.0
  - @enkaku/transport@0.23.0

## 0.22.5

## 0.22.4

## 0.22.3

## 0.22.2

## 0.22.0

### Minor Changes

- **Breaking:** raise the `@kokuin/token` floor to `^0.6.0` and `@kokuin/capability` to `^0.5.0`. No API these packages call changed, but `VerifyTokenHook` and the `methods` registry are kokuin types, so consumers sharing them must upgrade in step. Capability chains now accept grants from `did:kokuin:` management members (`mbr` claim); verifying those needs a `methods` registry whose controller resolver implements `resolveMember` — build it with a fresh `resolver.frozen()` per verification. A non-subject chain root without `mbr` now fails with `issuer should be subject`.

### Patch Changes

- Updated dependencies:
  - @enkaku/client@0.22.0
  - @enkaku/server@0.22.0
  - @enkaku/transport@0.22.0

## 0.21.6

## 0.21.5

## 0.21.3

## 0.21.1

### Patch Changes

- Updated dependencies:
  - @enkaku/client@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies:
  - @enkaku/client@0.21.0
  - @enkaku/server@0.21.0
  - @enkaku/transport@0.21.0

## 0.19.0

### Patch Changes

- Updated dependencies [2b7949c]
  - @enkaku/transport@0.19.0
  - @enkaku/client@0.19.0
  - @enkaku/server@0.19.0

## 0.18.1

### Patch Changes

- Update OTel setup
- Updated dependencies
  - @enkaku/transport@0.18.1
  - @enkaku/client@0.18.1
  - @enkaku/server@0.18.1

## 0.18.0

### Minor Changes

- Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.

### Patch Changes

- Updated dependencies
  - @enkaku/transport@0.18.0
  - @enkaku/client@0.18.0
  - @enkaku/server@0.18.0
