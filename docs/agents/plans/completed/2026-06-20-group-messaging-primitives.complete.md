# Group messaging primitives (broadcast + hub pub/sub + group-rpc) — completed

**Date:** 2026-06-20
**Status:** complete
**Packages:** `@enkaku/broadcast` (new), `@enkaku/hub-protocol` / `@enkaku/hub-server` / `@enkaku/hub-tunnel` / `@enkaku/hub-client` (reworked), `@enkaku/group-rpc` (new)
**Spec:** `2026-06-19-group-messaging-primitives-design.md` (Phases 1–3)
**Origin:** `docs/agents/plans/next/group-messaging-primitives.md`
**Branch / PR:** `feat/group-primitives`, PR #41 — range `0d5da7d..d57c247` (47 commits)

## Goal

Add group-messaging fan-out primitives to Enkaku so a group is a first-class messaging
substrate: address the whole group (events), a subgroup, anycast a request, gather replies,
or run directed 1:1 RPC to a single member — all over epoch-rotating opaque topics with an
authenticated sender on every surface, and with the hub kept blind to group membership.

Delivered in three phases, each an independent, working layer:

- **Phase 1 — `@enkaku/broadcast`:** generic fan-out primitive (no MLS/hub/DID coupling).
- **Phase 2 — hub pub/sub:** turn the hub into a blind, capability-gated pub/sub broker.
- **Phase 3 — `@enkaku/group-rpc`:** high-level MLS-aware wrapper tying it together.

## Key design decisions (preserved from spec)

- **Hub stays blind.** It routes on an opaque `topicID` only — no `groupID`, no recipients,
  no membership. Payloads are opaque ciphertext the hub never interprets. Phase 2 was a
  single breaking release (old procedures removed, no shims): `publish`/`subscribe`/
  `unsubscribe` plus a `receive` channel that drains a subscriber's delivery stream across
  all subscribed topics. Added a consumer `authorize(did, action, topicID)` predicate and
  per-DID / per-topic token-bucket rate limiting; kept the single-copy-message +
  per-subscriber-delivery-index + refcount-GC store engine.
- **MLS enters only through a `GroupCrypto` port.** `@enkaku/group-rpc` never imports
  `@enkaku/group` or `ts-mls`; the consumer adapts its live MLS group into
  `{ epoch(); exportSecret(); wrap; unwrap }`. Unit-tested with a fake crypto.
- **Authenticated sender comes from `unwrap` (MLS decrypt), not the hub envelope.** The
  hub-level `senderDID` is a per-epoch ephemeral signer (privacy design) — the wrong
  identity. The meaningful sender is the MLS credential recovered during decrypt, surfaced
  uniformly at `ctx.message.payload.iss` on both the bus and directed paths (the same path
  directed RPC already used for its JWT `iss`), so handler code is identical on both
  surfaces. Required widening broadcast's `unwrap` to optionally return
  `{ payload, senderDID }` — additive and backward-compatible (`ByteTransform ⊆ Unwrap`).
- **One `HubMux` drain, three views.** A single `hub.receive()` is multiplexed into a
  `BroadcastBus` (broadcast topics), a `HubLike` (directed hub-tunnels), and an
  `onInbound(topicID, cb)` hook (lazy directed-server accept), with per-topic refcounting
  across all three. Drain fires `onInbound` listeners before pushing to sinks so a tunnel
  created synchronously inside a listener still receives the triggering frame.
- **Epoch rotation = explicit `peer.resync()`.** The consumer calls it after processing an
  MLS commit; `resync` tears down all per-epoch wiring and rebuilds it for the new epoch.
  Topics rotate per epoch via `deriveTopicID` (HKDF-SHA256). Public factory is
  `createGroupPeer` / `GroupPeer`; the directed target is addressed via `.to(memberDID)`.
- **`gather` bypasses storm-collapse via a wire flag.** Suppression (storm-collapse) is a
  handler-side property, but `gather` (collect-all) vs anycast `request` (first-wins) is a
  client-side distinction. `gather` requests are tagged on the wire so responders always
  reply, bypassing suppression — letting opt-in `suppress` and `gather` coexist without a
  footgun. Applied in both `@enkaku/broadcast` and the group-rpc bus server.

## What was built

- **`@enkaku/broadcast`** — `createBroadcastTransport` (topic as Enkaku `TransportType`,
  `wrap`/`unwrap` hooks), `BroadcastClient` (`dispatch`/`request`/`gather`),
  `createBroadcastResponder` (+ `suppressible` storm-collapse), `deriveTopicID`,
  `defineGroupProtocol`, `createMemoryBus` test fake. Sender surfacing + gather-bypass added.
- **Hub pub/sub** — `hub-protocol` pub/sub procedures; `hub-server` subscription table +
  `authorize` hook + rate limiting + retention (`maxDepth` 1000, time-expiry purge,
  zero-subscriber drop); `hub-tunnel` re-based onto `publish`/`subscribe` (topic-agnostic
  send/receive topic pair); `hub-client` re-mapped to the new API. Bootstrap
  (`keypackage/upload`+`fetch`) retained verbatim.
- **`@enkaku/group-rpc`** — `createHubMux`, `createGroupBusServer` (event + anycast-request
  demux, sender-aware), `adaptBusHandlers`, directed client + lazy inbox acceptor,
  `createGroupPeer` (`.protocol(name)` surface, `.to(memberDID)`, `resync`, `dispose`),
  topic derivation (`protocolTopic`/`inboxTopic`/`discoveryTopic` + `INBOX_LABEL`), and the
  `GroupCrypto` port. End-to-end integration test covers bus event/anycast/gather +
  directed stream/channel.

## Status

Complete. All tasks across the three phases implemented via subagent-driven development
(per-task spec + quality review). Phase 2 and Phase 3 each passed a final opus whole-branch
review with verdict **READY TO MERGE** (no Critical/Important; spec fully covered; no
over-build; `GroupCrypto` isolation and hub blindness verified). Workspace `build:types`
green (hook-verified), lint clean. Ledger: `.superpowers/sdd/progress.md`.

## Follow-on work (non-blocking)

- **Directed reply self-loop:** when a peer is both caller and callee, responder reply
  frames land on the caller's own inbox where its acceptor `onInbound` also fires, spinning
  a spurious server-side tunnel for the reply session. Self-healing (session-end disposes
  it; the client tunnel still gets its copy via mux fan-out) and covered by the both-roles
  integration test. Fix: acceptor ignores sessionIDs already seen as a client, or separate
  inbox/reply topics.
- **`hub-tunnel` iterator-error teardown:** the iterator-error branch sets `torndown` +
  `controller.error` inline instead of calling `teardown(error)`, skipping
  `hub.unsubscribe(receiveTopicID)` — a narrow subscription leak, unreachable with current
  in-process delivery.
- **Hub store tests:** restore the `ack drains store` post-state assertion; add a
  purge-scheduler integration test; optionally have `store.publish` return the recipient set
  to drop the redundant second `getSubscribers` read.
- **MLS capability revocation** (`docs/agents/plans/next/mls-capability-revocation.md`) — a
  separate future effort, not part of this work.
