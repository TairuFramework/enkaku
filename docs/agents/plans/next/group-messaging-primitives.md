# Group Messaging Primitives (fan-out transport + pub/sub hub)

**Priority:** next (unblocks Kubun's group control-plane refactor off hand-rolled messaging)

## Why

Kubun built a group control-plane messaging layer (authenticated per-group ledger, admin roster, catch-up) entirely by hand because Enkaku has no fan-out: `TransportType<R,W>` is strictly a 1:1 `ReadableWritablePair`. So Kubun reinvented what Enkaku already provides for the 1:1 case — typed protocols, handlers, validation, request/response correlation — plus a bespoke catch-up mechanism (request-ID waiter map, timeout, multi-attempt backoff, responder storm-collapse).

The fix is to add the missing primitives to Enkaku so a **group is a first-class messaging substrate**: peers run typed protocols over it, address the whole group, a subgroup, or a single peer, and the hub stays a blind capability-gated relay. Enkaku ships the primitives + types to implement against (as it already does for the hub); the consumer (Kubun) provides MLS encryption, storage, and the concrete protocols.

## What Enkaku has today (ground truth, 2026-06-19)

- **Transport** (`packages/transport`): `TransportType<R,W>` = 1:1 `ReadableWritablePair`. No fan-out/multicast/broadcast variant.
- **Hub** (`packages/hub-protocol`, `packages/hub-server`): `hub/send recipients:[DID...]` (≤100) per-recipient; `hub/group/send groupID` resolves group→members and fans out; `hub/receive` filters by `groupIDs`; `hub/group/{join,leave}`; `hub/keypackage/{upload,fetch}`. Hub is blind — sees `{ sequenceID, senderDID, groupID?, payload(ciphertext) }`, routes on that. Membership resolution currently lives in the hub.
- **hub-tunnel** (`packages/hub-tunnel`): `createHubTunnelTransport` = one 1:1 `TransportType` per `{ localDID, peerDID, sessionID }`; writes `recipients:[peerDID]`, calls `hub.receive(localDID)` once.
- **@enkaku/group**: pure MLS (create/invite/commit/remove/welcome/capability). No messaging/transport/protocol concept.
- **Client/Server/protocol**: call types event/request/stream/channel; Server demuxes by `prc`; correlation strictly 1 client ↔ 1 server per transport by `rid`. No anycast/gather/request-to-many.

## Scope — two phases of Enkaku work

### Phase 1 — group-messaging primitive package (new package)

A new package (name TBD — e.g. `@enkaku/group-transport` or `@enkaku/broadcast`; distinct from the MLS-only `@enkaku/group`). Pure primitives, no MLS, no storage, no hub wiring. Unit-tested in-process against `DirectTransports`-style fakes.

1. **`BroadcastTransport`** — the missing fan-out abstraction so Client/Server can run over a 1→N bus. Write fans out to all peers on the bus; read merges messages from all. Plus a topic-addressed envelope. Conceptually a 1→N generalization of `TransportType`; design how it composes with `Server`/`Client` (see decision A below — the bus carries **events**, not multi-reply RPC).

2. **`gather` / anycast helper** — broadcast a request-event, collect replies with timeout / quorum / storm-collapse. Generic, no MLS, no hub. This replaces Kubun's hand-rolled catch-up waiter-map (request-ID map, 5s timeout, 8 attempts, full-jitter backoff, responder jitter 0–250ms + suppression TTL). Make the timeout/quorum/jitter/suppression tunable.

3. **Group-protocol scaffold** — protocol-definition types letting a group declare sub-protocols (control / sync / app-defined), with Server demux by `prc`. Types only — mirrors `hub-protocol`, no storage.

4. **Topic-derivation functions** — pure, secret-fed-by-caller (the caller supplies the MLS group secret + epoch; Enkaku owns the scheme):
   - `discoveryTopic(recipientDID)` — **public**, pure function of the DID, no secret. Pre-group rendezvous (invite/keypackage/Welcome). Anyone can derive it (intentional).
   - `topic(groupSecret, epoch, protocol[, scope])` — group-scoped broadcast/multicast topic. Opaque to the hub, derivable only by members.
   - `inboxTopic(groupSecret, epoch, recipientDID)` — group-scoped personal inbox for unicast. Opaque, derivable only by fellow members.

### Phase 2 — hub topic routing (extend hub-protocol + hub-server)

Turn the hub into a **blind capability-gated pub/sub broker over opaque topic IDs**, removing group awareness.

- **Single pub/sub primitive.** Add `publish` / `subscribe` / `unsubscribe` over opaque topic IDs. **Remove** `hub/group/send` + `hub/group/{join,leave}` + the `groupID` receive-filter **and** the generic `hub/send recipients:[DID...]`. All three delivery shapes become topics (see below). Provide a migration path off the old procedures.
- **Capability-gated publish AND subscribe.** Both verify a capability; auth to the hub is required. Use a **per-epoch ephemeral issuer key** for capabilities so the hub sees a rotating signer (within-epoch correlation only; cross-epoch unlinkable) — a stable per-group signer would relink topics into a group and undo the privacy goal. Capabilities name explicit topic IDs for the current epoch, re-minted on epoch advance.
- **Subscribe = create the durable inbox.** Subscribing creates the durable per-`(peer, topic)` inbox queue/cursor. The hub needs *subscription* state, not group membership.
- **Storage + GC (subscription-driven):** publish appends + fans to current subscribers (per-topic log + per-subscriber cursors, or fan-out-on-write queues); deliver+ack advances the cursor (primary GC); `unsubscribe` drops that subscriber's queue (replaces "member left"); per-topic retention TTL / max-depth bounds storage against vanished subscribers; **zero-subscriber topic → drop the whole log (drop messages immediately).**
- **Discovery channel = the general rules applied to a public topic** (no special-case logic):
  - default-closed: a recipient must opt-in *subscribe* to its own `discoveryTopic(DID)` to be reachable; subscribing is a persistent identity-setup action.
  - zero subscribers → **drop immediately** (the same empty-topic-drop rule). No pre-subscribe holding — buffering for an unsubscribed DID re-creates the globally-addressable inbox we removed. Any grace window is an optional capped tunable, off by default.
  - publish authenticated by the inviter's self-signed DID capability + rate-limited per publisher.
- **Bootstrap retained narrowly:** keep the pre-group invite path (`keypackage/upload` + `keypackage/fetch` + Welcome delivery) over `discoveryTopic`. This is the one place DID-derived near-open addressing remains — small, contained, rate-limited.

## Three delivery shapes (how the consumer uses these)

| Shape | Mechanism |
|---|---|
| 1→N whole-group broadcast | `topic(groupSecret, epoch, protocol)` all members subscribe |
| 1→(M in N) subgroup | `topic(groupSecret, epoch, protocol, scope)` the M subscribe |
| 1→1 directed unicast | publish to `inboxTopic(groupSecret, epoch, recipientDID)`; hub-tunnel re-bases onto this (directed RPC unchanged) |

## Design decisions Enkaku must honor

- **A — event-bus + directed-RPC + gather, NOT RPC-over-broadcast.** The fan-out bus carries **events** (fire-and-forget 1→N). True request/response RPC stays 1:1 over a tunnel transport. "Anycast" = broadcast a request-event, responders reply by event or by opening a directed tunnel; `gather` collects. Do **not** make `rid` correlate to a multi-reply collection — leave Enkaku's 1 client ↔ 1 server `rid` model intact.
- **Opaque, epoch-derived topic IDs.** Hub routes on opaque IDs only — no visible `groupID`, no protocol label. The protocol is demuxed receiver-side from inside the (consumer-encrypted) payload. Topic IDs rotate per MLS epoch so the hub cannot correlate a topic across epochs.
- **`topicID` always required** — no `groupID`-only / topic-absent case. Whole-group broadcast is just a topic all members subscribe to (uniform opaque topics = less metadata).
- **MLS handshake stays full-group (consumer invariant, but it constrains the hub API):** the hub must not make it *possible* for a consumer to scope an MLS Commit/Welcome/Proposal to a subset in a way that silently strands members — these always go on the full-group control topic. Document this expectation; the consumer enforces it, but the primitive should not encourage subset-scoping of handshake traffic.
- **Hub stays blind.** No decryption, no membership knowledge. Payload is opaque ciphertext (consumer does MLS). Capability verification is the only thing the hub interprets.

## Out of scope (Enkaku side)

- MLS encryption/decryption, topic-secret material, the concrete group/circle/catalog/sync protocols, ledger fold/storage — all consumer (Kubun) side.
- Cryptographic isolation between subgroups (same MLS group key; isolation is the consumer's access-control concern, not separate MLS subgroups).
- Anonymous/blind-token subscription (would close the residual subscriber-co-occurrence inference at the hub) — large crypto lift, deferred.
- Semantic QoS by protocol class at the hub (the protocol label is not hub-visible) — per-opaque-topic rate-limit/meter is still fine.

## Open questions to resolve during brainstorming

- Package name + whether the scaffold/transport and the derivation funcs are one package or split.
- Exact `BroadcastTransport` interface and how `Server`/`Client` attach to it for event delivery + `gather`.
- Topic-ID KDF choice and epoch-binding details; how `discoveryTopic` resists nothing-up-my-sleeve concerns (it is intentionally public/enumerable).
- Per-epoch ephemeral capability issuer mechanics and re-mint flow on epoch advance.
- Hub storage model: per-topic log + cursors vs fan-out-on-write queues; retention defaults.
- Migration/back-compat: do `hub/group/send` and `hub/send` get removed outright or deprecated through a transition window (Kubun integrates in its Phase 4, in parallel)?

## Dependencies / sequencing

Phase 1 (primitive package) gates Phase 2 (hub) gates Kubun's integration (its Phase 4).

