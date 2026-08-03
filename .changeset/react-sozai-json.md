---
'@enkaku/react': patch
---

Replace the `canonicalize` dependency with `@sozai/json`.

`createRequestKey` uses canonical JSON to derive a stable cache key from a request argument. It did so through the third-party `canonicalize` package, which declares `export default fn` but ships `module.exports = fn` -- incorrect for CJS under `nodenext`, so the import needed a double cast through `unknown` to get a callable type. `@sozai/json` is native ESM with real types, so the cast and its explanatory comment are gone.

The serialization is the same RFC 8785 canonical form and the produced keys are unchanged. The only behavioural difference is the error type for values with no canonical representation: `@sozai/json` throws `TypeError` for `NaN`, `Infinity`, `BigInt` and circular references, where `canonicalize@3.0.0` threw a plain `Error` for the first, second and fourth. Passing any of those as a request argument was already a caller bug -- the throw propagates out of `createRequestKey` either way.
