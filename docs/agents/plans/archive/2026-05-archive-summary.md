# 2026-05 Archive Summary

## Plans Completed

- **port-hub-tunnel-from-kubun** (2026-05-03, complete) -- Landed `@enkaku/hub-tunnel@0.14.0` in the Enkaku monorepo with sources ported from Kubun. Peer-to-peer transport over a `HubLike` relay with pluggable end-to-end encryption (`encryptor.ts` interface, no shipped impls). Frame discriminated union (`message` | `session-end`), envelope shape validated at runtime, payload-shape validation deferred to consumer protocol. Schema `$id` renamed `urn:kubun:…` → `urn:enkaku:…`.

- **access-control-refactor** (2026-05-07, complete) -- Replaced overloaded `accessControl` server option with tightly-typed `accessRules`. `ServerParams` discriminated union: no identity ⇒ standalone (rules forbidden by the type), identity present ⇒ authenticated with rules defaulting to `{}`. New `AccessRule = { allow: true | Array<string> | AllowPredicate; encryption?: EncryptionPolicy }` form with `AllowPredicate` carrying full message context (supports Hub-style admission). Shorthand boolean/array values removed; deny = omit the pattern.

- **handler-error-discriminator** (2026-05-08, complete) -- Unified handler-failure observation on `@enkaku/server`. `handlerError` event extended with required discriminators `category: 'auth' | 'limit' | 'encryption' | 'handler'` and `messageType: 'event' | 'request' | 'channel' | 'stream' | 'send'`. `eventAuthError` removed outright (pre-1.0, single consumer). Closes prior gap where non-event auth/encryption denials emitted nothing observable.

- **did-peer-4-transport-integration** (2026-05-26, complete) -- Wired `did:peer:4` contracts from `@enkaku/token` into the rest of the stack. Identity exchange at the token layer (not transport): first token to a given audience embeds long-form doc in `iss`; receivers decode inline, verify hash binding, cache. First-per-aud policy with `embedLongForm` override. Cache write-after-verify prevents memory DoS. MLS auth-service peer4 binding deferred to a follow-up plan.
