# Hub-server: surface double-bind on `hub/receive`

**Date:** 2026-04-25
**Status:** in-review
**Surfaced by:** Kubun plugin-p2p hub-receive multiplexing work (`kubun/docs/superpowers/specs/2026-04-25-hub-receive-multiplexing-design.md`).

## Problem

`HubClientRegistry.setReceiveWriter(did, writer)` overwrites silently when a writer is already bound for the DID. This hides protocol violations: a misbehaving client opening a second `hub/receive` stream against the same DID kills delivery on the first, with no error surfaced.

The single-writer-per-DID invariant is intentional (DID = device = one online subscriber; direct-message routing has no principled multi-writer semantics). The failure mode is the silence, not the constraint.

Kubun discovered this via plugin-p2p's `GroupChannel` opening one `hub/receive` per MLS group; multi-group peers silently lost messages from previously-joined groups. Kubun is fixing on its side (single multiplexed stream per `(deviceDID, hubURL)`), but the hub-server should harden so future violators surface loudly.

## Proposed change

`packages/hub-server/src/registry.ts`:

```ts
setReceiveWriter(did: string, writer: (message: StoredMessage) => void): void {
  const entry = this.#clients.get(did)
  if (entry == null) return
  if (entry.sendMessage != null) {
    throw new Error(`receive writer already bound for DID ${did}`)
  }
  entry.sendMessage = writer
}
```

Preserve silent return for unregistered DID. Throw only on double-bind.

`packages/hub-server/src/handlers.ts`:

`hub/receive` calls `setReceiveWriter` at line 77; the throw must propagate as a channel rejection observable to the calling client. The existing `signal.aborted` listener (line 142) calls `clearReceiveWriter`, freeing the slot on transport drop / explicit close.

## Reconnect race

Client reconnect after transport drop: hub may not yet have observed `signal.aborted` when the new `hub/receive` arrives. With the throw, this scenario rejects the new attempt. Tolerated by:

- Client-side close-first discipline (`pool.release` before re-acquire — already in plugin-p2p's `GroupChannel.#openInner`)
- Hub-side timely cleanup on `signal.aborted` (already wired)
- Client backoff retry on failed reconnect

Verify ordering at the handler level: if the throw happens too early (before `register` has run), we may lose the cleanup hook. Audit the handler before applying.

## Tests

`test/registry.test.ts`:
- `setReceiveWriter` throws when called twice for same DID without `clearReceiveWriter` between.
- `setReceiveWriter` succeeds again after `clearReceiveWriter`.
- `setReceiveWriter` for unregistered DID is a no-op (preserve existing behavior).

`test/hub.test.ts` (or new file):
- Two concurrent `hub/receive` calls for same DID: second rejects, first stays alive.
- Abort first call; immediate `hub/receive` retry succeeds (race tolerance).
- Abort first call; delayed `hub/receive` retry succeeds.

## Scope

- `packages/hub-server/src/registry.ts` — throw on double-bind
- `packages/hub-server/src/handlers.ts` — verify ordering, propagate throw as channel rejection if needed
- `packages/hub-server/test/registry.test.ts` + `hub.test.ts` — coverage above

Pre-existing `test:types` errors in `test/hub.test.ts:305,307` (`TransportType` assignability) are unrelated — separate cleanup.

## Why not "just bigger registry"

Multi-writer-per-DID was considered and rejected:
- Direct `hub/send` semantics break with N writers (deliver to all? one? round-robin? no principled answer)
- ack ownership, `isOnline` semantics get muddier
- No driving use case besides Kubun's accidental design (now being fixed on its side)
- YAGNI

Single-writer is the correct invariant. This change makes its enforcement loud.
