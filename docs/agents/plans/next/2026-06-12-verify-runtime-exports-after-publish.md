# Verify runtime exports after publishing protocol/server/otel/schema

**Date:** 2026-06-12
**Severity:** LOW (verification gate, blocks downstream un-workaround)
**Depends on:** maintainer bumping + publishing `@enkaku/{protocol,server,otel,schema}` (see `completed/2026-06-12-enkaku-mokei-downstream-asks.complete.md`).

The runtime-export fixes are invisible at the type layer — a `.d.ts` resolves even when the JS `lib/` lacks the symbol, so the only real proof is a fresh install of the *published* package. Do this once the bumped releases are live.

## Checks (against a fresh install of the published versions)

- `require('@enkaku/protocol').ErrorCodes.ACCESS_DENIED === 'EK02'` at runtime.
- `ErrorCodes` reachable via `@enkaku/server`'s public entry.
- `import { HandlerError } from '@enkaku/server'` resolves at runtime; a handler throwing a `HandlerError` subclass with a custom code delivers that code (not `HANDLER_ERROR`) to the client.
- `import { getActiveBaggage, baggageToEntries } from '@enkaku/otel'` resolve at runtime.
- `import { createValidator } from '@enkaku/schema'` accepts `{ strict: false }` at runtime.

## Optional guard

Add a build assertion (or smoke test in CI) that fails if `error-codes`/the new exports are dropped from a built `lib/` again, so the publish-gap can't silently recur.

## Then

Signal kubun + mokei to drop their hardcoded workarounds (kubun `'EK02'` literal / `SyncAccessDeniedError`; mokei G5/G8 backlog items).
