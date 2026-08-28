# @enkaku/standalone

## 0.21.1

### Patch Changes

- Updated dependencies:
  - @enkaku/client@0.21.1

## 0.21.0

### Minor Changes

- **Breaking:** raise the `@kokuin/token` floor to `^0.4.0` and `@kokuin/capability` to `^0.2.2`. Two upstream breaks reach the wire:

  - A `did:peer:4` signer now embeds its long form in `iss` for any payload without a single string `aud`. Enkaku only sets `aud` when the client is given a `serverID`, so messages signed without one change shape. Pass `embedLongForm: false` to the identity to keep the short form.
  - Base64 decoding is canonical-only. A signature or token carrying a non-canonical base64url spelling now throws `Invalid base64url encoding` instead of verifying. Every encoder in this stack emits canonical output; only hand-built or third-party payloads are affected.

  No API these packages call changed. Consumers pinned to `@kokuin/token@0.2.x`/`0.3.x` must upgrade in step.

- **Breaking:** the `getRandomID` option is removed from `ServerBaseParams`, `ClientParams`, `ServerBridgeOptions`, `ServerTransportOptions` and `StandaloneOptions`. Pass a `Runtime` instead:

  ```ts
  // before
  new Client({ transport, getRandomID })
  // after
  new Client({ transport, runtime: createRuntime({ getRandomID }) })
  ```

  `getRandomID` was shorthand for exactly that, and passing both silently discarded it — a caller supplying a custom generator alongside a runtime got `crypto.randomUUID()` with no warning.

  `@enkaku/standalone` gains the `runtime` option it was missing, threaded through to both client and server so they share one generator.

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
