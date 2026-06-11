# Transport typed constructors + consumer cast fixes

**Origin:** item 4.5 investigation in `completed/2026-06-11-kubun-audit-boundary-fixes.complete.md` (closed WONTFIX for enkaku core; this is the optional/cross-repo remainder).

## Background

The `as unknown as ClientTransportOf<P>` / `ServerTransportOf<P>` double-casts in consumer apps are **not** an enkaku type-variance defect. They occur because consumers construct `new MessageTransport({...})` / `new Transport({...})` without type arguments, collapsing the read/write generics to `unknown`, which enkaku then correctly rejects on the covariant read position. No enkaku public-type change is warranted — relaxing the bound would re-admit `unknown` and weaken read-side safety.

## Cross-repo consumer fixes (other repos, not enkaku)

- `kubun/apps/local-todo/src/worker.ts:37` — construct `new MessageTransport<AnyClientMessageOf<P>, AnyServerMessageOf<P>>({ port })`, drop the cast.
- `sakui/apps/desktop/src/renderer/runtime.ts:47` — construct `new Transport<AnyServerMessageOf<P>, AnyClientMessageOf<P>>({ stream })`, drop the cast (note R/W order: a client transport reads server messages, writes client messages).
- `kubun/packages/plugin-p2p/src/hub/http-client.ts:43` — **stale** cast; `DIDObservingTransport` already matches `ClientTransportOf` structurally. Delete it.
- `enkaku/packages/server/test/transport-read-failure.test.ts:20` — deliberately-partial `vi.fn` mock; `as unknown as` is the sanctioned idiom. Leave.

## Optional enkaku DX (additive, non-breaking)

To prevent the dropped-type-args footgun, add protocol-typed factory helpers `serverMessageTransport<P>(params)` / `clientMessageTransport<P>(params)` in `@enkaku/message-transport` (and a `Transport`-level equivalent in `@enkaku/transport`) returning the correctly-branded transport so consumers cannot omit the type parameters. Pure DX; not required to remove the casts.
