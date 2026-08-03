---
'@enkaku/server': patch
---

Make the replay dedup key independent of how the signature is spelled.

When a signed message carries no `jti`, `checkReplay` falls back to the signature for its dedup key, and it used the base64url **string** received off the wire. A signature is verified by its bytes, and several strings decode to the same bytes: the spare bits in the final chunk of a 64-byte Ed25519 signature give 16 spellings, and padding gives more. All of them verify. So one captured message could be replayed once per spelling, and the docstring's claim that the fallback was tamper-safe after verification did not hold.

The key now re-encodes the decoded signature canonically, collapsing every spelling to one entry.

`@enkaku/client` always stamps `jti`, so its messages never took the fallback and are unaffected. The exposure was to peers that omit `jti`, which the protocol schema permits. This adds a `@sozai/codec` dependency to `@enkaku/server`.
