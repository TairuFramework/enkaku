# Hub-server `hub/receive` double-bind hardening

**Status:** complete
**Date:** 2026-04-26
**Surfaced by:** Kubun plugin-p2p hub-receive multiplexing work.

## Goal

Make `HubClientRegistry.setReceiveWriter` throw on double-bind so a misbehaving client opening a second `hub/receive` for the same DID surfaces a loud error instead of silently overwriting the first writer. Single-writer-per-DID invariant unchanged; only its enforcement becomes loud.

## Key design decisions

- **Single-writer-per-DID kept as the invariant.** Multi-writer-per-DID was rejected: direct `hub/send` semantics break with N writers (no principled answer for deliver-to-all/one/round-robin), ack ownership and online semantics get muddier, and the only driving case (Kubun's accidental design) was already being fixed on the client side.
- **Two-layer defense.** Pre-check at the handler before allocating channel writer/reader, plus a defensive throw inside the registry. The pre-check is what avoids leaking stream locks; the registry throw is defense-in-depth.
- **Decoupled double-bind guard from `isOnline` semantics.** Added a dedicated `isWriterBound(did)` method on `HubClientRegistry` so future changes to `isOnline` (e.g., presence-tracking divergence) don't silently weaken the guard.
- **Reconnect race tolerated by existing cleanup.** The `signal.aborted` listener in the handler synchronously calls `clearReceiveWriter`, freeing the slot before the next `hub/receive` arrives — verified via immediate-reopen and delayed-reopen tests.

## What was built

- `packages/hub-server/src/registry.ts`: `setReceiveWriter` throws on double-bind; new `isWriterBound` method.
- `packages/hub-server/src/handlers.ts`: `hub/receive` pre-checks `isWriterBound` before locking streams and throws cleanly so the rejection surfaces to the offending client without disrupting the first subscriber.
- `packages/hub-server/test/registry.test.ts`: 3 cases — throw on double-bind, recover after `clearReceiveWriter`, no-op for unregistered DID.
- `packages/hub-server/test/hub.test.ts`: 3 cases — concurrent double `hub/receive` (second rejects, first stays alive), close + immediate reopen, close + delayed reopen.

## Verification

- `pnpm --filter @enkaku/hub-server test:unit` — 37/37 pass.

## Follow-on work (separate)

- `HandlerError.from` in `packages/server/src/utils.ts` has a spread-order bug: `{ message: cause.message, ...params, cause }` lets `params.message = 'Handler execution failed'` overwrite the original cause message. Original message preserved in server-side `logger.warn`, but client-visible payload loses it. Affects every handler error surface — repo-wide concern, deferred.
- Pre-existing `TransportType` assignability errors in `hub.test.ts` teardown block — separate cleanup.
