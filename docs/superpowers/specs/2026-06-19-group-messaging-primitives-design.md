# Group Messaging Primitives — Design

**Date:** 2026-06-19
**Status:** Approved design, ready for implementation planning
**Supersedes:** `docs/agents/plans/next/group-messaging-primitives.md` (original plan)

## Summary

Enkaku has no fan-out: `TransportType<R,W>` is strictly a 1:1 `ReadableWritablePair`. As a result Kubun hand-rolled a group control-plane messaging layer (authenticated per-group ledger, admin roster, catch-up with a request-ID waiter map, timeout, multi-attempt backoff, responder storm-collapse) — reinventing what Enkaku already provides for the 1:1 case, plus a bespoke catch-up mechanism.

This design adds the missing primitives so a **group becomes a first-class messaging substrate**: peers run typed protocols over it, address the whole group / a subgroup / a single peer, and the hub stays a blind capability-gated relay. Enkaku ships generic primitives, a blind pub/sub hub, and a high-level MLS-aware wrapper; the consumer (Kubun) supplies MLS encryption, storage, and the concrete protocols.

The work is **three packages across four phases**:

| Phase | Package | Role | MLS? |
|---|---|---|---|
| 1 | `@enkaku/broadcast` (new) | Generic fan-out primitives | none |
| 2 | `hub-protocol` + `hub-server` (extend) | Blind pub/sub broker over opaque topics | none |
| 3 | `@enkaku/group-rpc` (new) | High-level wrapper: MLS group + broadcast + server → typed group RPC | yes |
| 4 | Kubun (downstream) | Control + app protocols, ledger storage, billing authz | yes |

Phase 1 gates Phase 2 gates Phase 3 gates Kubun's integration.

## Design principles (invariants)

- **Event-bus + directed-RPC + gather, NOT RPC-over-broadcast.** The fan-out bus carries **events** (fire-and-forget 1→N). True request/response RPC stays 1:1 over a tunnel transport. Enkaku's `1 client ↔ 1 server` `rid` correlation model is left intact — `rid` never correlates to a multi-reply collection.
- **Opaque, epoch-derived topic IDs.** The hub routes on opaque IDs only — no visible `groupID`, no protocol label. Protocol is demuxed receiver-side from inside the (consumer-encrypted) payload. Topic IDs rotate per epoch so the hub cannot correlate a topic across epochs.
- **`topicID` always required.** No `groupID`-only / topic-absent case. Whole-group broadcast is just a topic that all members subscribe to (uniform opaque topics = less metadata).
- **Hub stays blind.** No decryption, no membership knowledge. Payload is opaque ciphertext. The only things the hub interprets are the `authorize` predicate and rate-limit accounting.
- **MLS handshake stays full-group.** Commit / Welcome / Proposal traffic always goes on the full-group control topic. The primitives do not encourage subset-scoping of handshake traffic. This is a consumer invariant; the primitive simply does not make subset-scoping convenient.

### Deviation from the original plan

The original plan specified a **per-epoch ephemeral capability issuer** with capability-gated publish *and* subscribe, naming explicit topic IDs and re-minted on epoch advance. **This is dropped entirely.**

Rationale: the ephemeral signer was meant to prevent the hub linking topics into a group (a stable group signer on T1,T2,T3 → "one group"; a rotating per-epoch signer → cross-epoch unlinkable). But the hub connection is authenticated by the member's **stable DID either way** (required for billing/allow-list). So in both designs the hub sees `DID X subscribes to {T1,T2,T3}` — co-occurrence by DID already reveals the group within an epoch, and the same DID re-subscribing to rotated topics links across epochs. The stable-DID auth already defeats exactly the unlinkability the capability signer was supposed to provide. The capability machinery bought nothing for its stated goal.

Replacement: **coarse per-DID authorization** (`authorize` predicate) + **cryptographic per-topic access** (topic-ID secrecy + MLS decryption). True unlinkability requires anonymous / blind-token subscription, which remains **deferred** (unchanged from the original plan's out-of-scope list).

## Phase 1 — `@enkaku/broadcast` (new package)

Pure, generic fan-out primitives. **Zero MLS imports, no `@enkaku/group` dependency.** Crypto primitives (HKDF-SHA256, SHA-256) come from `@noble/hashes` directly. Unit-tested in-process against `DirectTransports`-style fakes with an identity `seal/open`.

The package is generic over three consumer-supplied seams:

1. **`seal` / `open` codec hook** on the transports (where encryption plugs in).
2. **`(sharedSecret, epoch)`** values fed to topic derivation.
3. **Protocol definitions + handlers** supplied to `Server` / `BroadcastClient`.

MLS is the *expected* consumer of these seams, never a dependency.

### a. `BroadcastTransport`

Implements the existing `TransportType<R,W>` interface, bound to **one `topicID`** at construction.

- `write(msg)` → `seal(serialize(msg))` → publish to the topic (fan-out to all current subscribers).
- async-iterator / `read()` → fetch ciphertext for the topic → `open(ciphertext)` → deserialize → yield.

`seal` / `open` are consumer-supplied (default identity for tests). The `prc`/`rid` RPC envelope is plaintext to `Client` / `Server` but ciphertext on the wire.

**Events-only.** `request` / `stream` / `channel` cannot ride a bus transport: on 1→N, N servers reply with the same `rid` and the client's controller resolves on the first reply, silently dropping the rest. This is documented; `write()` rejects non-event payloads to turn the silent footgun into a loud error.

Existing `Server` / `Client` attach to a `BroadcastTransport` unchanged for event delivery. To run protocols over multiple topics, construct multiple transports (one per topic).

### b. `BroadcastClient`

A thin orchestrator that routes by call type. Composes existing `Client` / `Server` machinery; adds no multi-reply correlation to the core.

- **`dispatch(event)`** — fire-and-forget broadcast on the group topic.
- **`request(prm, { errorThreshold, timeoutMs })`** — broadcast a request-event; **first non-error reply wins**, the rest are ignored. `≥ errorThreshold` error replies → throw. No win before `timeoutMs` → throw. This is anycast-with-failover (Kubun's catch-up).
- **`gather(prm, { quorum, timeoutMs })`** — broadcast; **collect all replies** up to `quorum` or `timeoutMs`, return the collection. (census / poll)
- **`stream(targetDID, …)` / `channel(targetDID, …)`** — directed to **one peer**. Routes to that peer's `inboxTopic`; single responder ⇒ normal `rid` correlation ⇒ full stream/channel semantics. Reuses the existing `Client` over a directed hub-tunnel transport. No fan-in cliff.

Reply demultiplexing for `request` / `gather` keys on `(rid, senderDID)` at the helper layer, never in the core `Client`.

### c. `suppressible(handler, { jitterMs, suppressTtlMs })`

Responder-side helper, symmetric with requester-side first-wins. Wraps a `Server` handler:

- delays its reply by a random jitter in `[0, jitterMs]` (default 250ms);
- if it observes another peer already answered this `rid` on the topic, suppresses its own reply (within `suppressTtlMs`).

Replaces Kubun's hand-rolled responder jitter + suppression-TTL storm-collapse.

### d. Group-protocol scaffold

Protocol-definition types letting a group declare sub-protocols (control / sync / app-defined), with `Server` demux by `prc`. **Types only**, mirroring `hub-protocol`; no storage, no concrete protocols. Each protocol name maps to a topic via the topic-per-name convention (below).

### e. Topic derivation (pure functions)

The caller supplies the shared secret + epoch (Kubun feeds the MLS exporter secret + epoch). Enkaku owns the scheme.

- **`discoveryTopic(recipientDID)`** — public, no secret:
  `b64url(SHA-256("enkaku/discovery/v1" ‖ recipientDID))`.
  Pre-group rendezvous (invite / keypackage / Welcome). Anyone can derive it from the DID alone (intentional). Unkeyed hash with a published domain-separation tag — nothing-up-my-sleeve.
- **`topic(groupSecret, epoch, protocol[, scope])`** — group-scoped broadcast/multicast topic:
  `b64url(HKDF-SHA256(ikm=groupSecret, salt=LE64(epoch), info="enkaku/topic/v1" ‖ protocol ‖ scope))`, 32-byte output.
  Opaque to the hub, derivable only by members. Epoch in the salt → rotates per epoch, cross-epoch unlinkable.
- **`inboxTopic(groupSecret, epoch, recipientDID)`** — group-scoped personal inbox for unicast:
  same HKDF construction with `recipientDID` in `info`. Opaque, derivable only by fellow members.

HKDF-SHA256 is chosen over plain keyed HMAC to match MLS's own HKDF idiom (RFC 5869) — the code sits next to MLS, reviewers see the expected primitive, and `info`-binding is the textbook way to domain-separate. Functionally equivalent strength here (the MLS exporter secret is already a uniform PRK, so HKDF-Extract buys nothing security-wise), but idiom and readability win.

## Phase 2 — hub pub/sub (`hub-protocol` + `hub-server`)

Turn the hub into a **blind pub/sub broker over opaque topic IDs**, removing all group awareness. **Single breaking release** — old procedures are removed, not deprecated (Kubun is the only consumer and cuts over in lockstep in its Phase 4).

### Procedures

**Add:**
- `publish(topicID, payload)` — append + fan to current subscribers.
- `subscribe(topicID)` — create the durable per-`(DID, topic)` inbox (queue + cursor). Subscribing is the persistent setup action; the hub needs *subscription* state, not group membership.
- `unsubscribe(topicID)` — drop that subscriber's queue for the topic.
- Rework `receive` to drain the subscriber's delivery stream across all its subscribed topics. No `groupID` filter — the subscriber receives its topics by construction.

**Remove:**
- `hub/send` (recipients-based unicast — replaced by `inboxTopic` publish).
- `hub/group/send` (group fan-out — replaced by topic publish/subscribe).
- `hub/group/join` / `hub/group/leave` (membership leaves the hub).
- the `groupID` receive-filter.

### Authorization

Pluggable predicate, consumer-supplied:

```
authorize(did, action: 'publish' | 'subscribe', topicID) => boolean | Promise<boolean>
```

JWT auth to the hub is still required (existing mechanism). Reference default = allow any authed DID; Kubun plugs in a paying-member check. There is **no per-topic ACL** — per-topic access is cryptographic (topic-ID secrecy + MLS decryption). The `topicID` is passed so the same hook can feed rate-limit accounting.

### Rate-limiting

Per-DID and per-topic, both tunable:

```
rateLimit: {
  perDID:   { rate, burst },   // default ~20/s, burst 50
  perTopic: { rate, burst },   // default ~100/s, burst 200
}
```

Per-DID caps a noisy identity; per-topic caps a flooded topic regardless of who. This bounds the write-abuse window (a just-removed member still knows current-epoch topic IDs until rotation; its payloads are MLS-rejected by recipients, but bandwidth/storage spam is possible). Self-heals on epoch advance: members who see an invalid-message flood trigger an MLS commit → topics rotate → the abuser can't derive the new topic IDs.

### Storage

Reuse the existing `createMemoryStore` engine shape — it is already the efficient model (single message copy + per-subscriber index + refcount GC):

- `messages: Map<seqID, { payload, recipients: Set<DID>, storedAt }>` — one copy per message.
- `deliveries: Map<subscriberDID, [seqID…]>` — per-subscriber delivery index, independent progress.
- GC: ack removes seqID from the index + decrements the `recipients` refcount; `size === 0` → delete the message. Plus age `purge`.

Deltas:

| Keep | Change | Add | Remove |
|---|---|---|---|
| `messages`, `deliveries`, `ack`, `purge`, refcount GC, `storeKeyPackage` / `fetchKeyPackages` | `store(recipients[])` → `publish(topicID)`: recipients resolved from the **subscription table**, not params; `groupID` field → `topicID` | `subscriptions: Map<topicID, Set<DID>>`; `subscribe` / `unsubscribe`; per-topic max-depth trim; zero-subscriber → drop the topic's messages immediately | `addGroupMember` / `removeGroupMember` / `getGroupMembers`; the `groupID` receive-filter |

`publish(topicID)` looks up `subscriptions.get(topicID)` and pushes the seqID into each subscriber's existing delivery list — mechanically identical to today's `store()`, except recipients are resolved from subscriptions instead of passed in. `fetch(subscriberDID)` is unchanged (drains the subscriber's delivery list across all its topics into one receive stream). `unsubscribe` removes the subscriber from the table and clears its pending deliveries for the topic; the last unsubscribe drops the topic log.

**Retention** (bounds storage against slow/vanished subscribers): per-topic `maxDepth` (default ~1000 msgs) + `ttlMs` (default ~7d), whichever hits first trims oldest; zero-subscriber topic drops the whole log immediately. All tunable. A subscriber stuck past the bound loses the trimmed tail and can catch up via `gather` / epoch rotation.

### Directed transport — hub-tunnel re-based onto topics

`createHubTunnelTransport` is re-based onto the pub/sub API: bound to send → the peer's `inboxTopic`, receive ← the local DID's own `inboxTopic` (replacing `recipients:[peerDID]` + `hub.receive`). This is the directed transport that `BroadcastClient.stream` / `channel` reuse for 1→1 RPC.

### Bootstrap (retained narrowly)

The pre-group invite path stays: `keypackage/upload` + `keypackage/fetch` remain as a key directory (request procedures). Welcome delivery rides `discoveryTopic` via publish/subscribe under the *general* rules (no special-case logic):

- **Default-closed:** a recipient must opt-in `subscribe` to its own `discoveryTopic(DID)` to be reachable. Subscribing is a persistent identity-setup action.
- **Zero subscribers → drop immediately** (the same empty-topic-drop rule). No pre-subscribe holding (that would re-create the globally-addressable inbox being removed). Any grace window is an optional capped tunable, off by default.
- Publish to a discoveryTopic is authenticated by the inviter's self-signed DID and rate-limited per publisher.

This is the one place DID-derived near-open addressing remains — small, contained, rate-limited.

## Phase 3 — `@enkaku/group-rpc` (new package)

The high-level, MLS-aware wrapper. Naming follows the house `<substrate>-rpc` convention (cf. `@enkaku/electron-rpc` = "RPC using Electron IPC"); `@enkaku/group-rpc` = "RPC over an MLS group". Depends only on Enkaku packages (`client`, `server`, `broadcast`, `group`). Built after Phase 2 because it needs real `subscribe` / `publish` + epoch-rotation against a live hub.

This is **where MLS enters**: it supplies the `seal` / `open` hook from the live group and the `(secret, epoch)` for topic derivation. It removes the boilerplate every consumer would otherwise repeat: per-protocol topic derivation, subscriptions, seal/open wiring, a `Server` + `BroadcastClient` per protocol, and epoch-rotation resubscribe.

### API sketch

```ts
// consumer defines app protocols with the broadcast scaffold types
const circle = defineGroupProtocol({ /* … */ })
const sync = defineGroupProtocol({ /* … */ })

const comms = createGroupComms({
  group,        // @enkaku/group GroupHandle — source of secret, epoch, seal/open
  hub,          // hub client
  identity,     // local DID / keystore
  protocols: { circle, sync },
  handlers: { circle: { /* … */ }, sync: { /* … */ } },
})

comms.protocol('circle').dispatch(evt)                                  // 1→N broadcast
await comms.protocol('sync').request(prm, { errorThreshold, timeoutMs }) // anycast catch-up
await comms.protocol('sync').gather(prm, { quorum, timeoutMs })          // collect
comms.protocol('circle').channel(targetDID, /* … */)                    // 1→1 directed RPC
// MLS commit → comms re-derives topics, unsubscribes old / subscribes new — automatic
```

`createGroupComms` owns:

- topic derivation from the live group (`secret`, `epoch`) per protocol name + own `inboxTopic`;
- hub `subscribe` / `unsubscribe` per protocol topic + inbox;
- a `BroadcastTransport` per protocol wired with the group's MLS `seal` / `open`;
- a `Server` (handlers) + `BroadcastClient` per protocol;
- **epoch-rotation resubscribe**: on MLS commit, re-derive topics, subscribe new, unsubscribe old (old topics hit zero subscribers → hub drops them; removed members can't derive the new topics);
- a typed `.protocol(name)` surface exposing `dispatch` / `request` / `gather` / `stream` / `channel`.

The consumer supplies only protocol definitions, handlers, and app logic.

## Three delivery shapes (how the consumer uses these)

| Shape | Mechanism |
|---|---|
| 1→N whole-group broadcast | `topic(groupSecret, epoch, protocol)` — all members subscribe |
| 1→(M in N) subgroup | `topic(groupSecret, epoch, protocol, scope)` — the M subscribe |
| 1→1 directed unicast | publish to `inboxTopic(groupSecret, epoch, recipientDID)`; hub-tunnel re-bases onto this (directed RPC unchanged) |

Subgroup isolation is access-control only (same MLS group key) — not separate MLS subgroups. Cryptographic isolation between subgroups is a consumer concern, out of scope here.

## End-to-end flow (members A, B, C; Kubun = consumer)

1. **Setup (consumer / MLS):** members run MLS → each extracts `exporterSecret` + `epoch`.
2. **Join the substrate (per member, via `createGroupComms`):** derive + `subscribe` each participating protocol topic (`topic(secret, epoch, "control")`, `topic(secret, epoch, "sync")`, …) and own `inboxTopic`; attach `Server` + `BroadcastClient` per protocol with MLS `seal` / `open`.
3. **Group event:** `dispatch(evt)` on a protocol topic → `seal` → hub `publish(topic, ct)` → fans to subscribers → each `Server` `open`s + demuxes by `prc`.
4. **Catch-up:** `request(prm, { errorThreshold, timeoutMs })` → broadcast request-event → responders run `suppressible` handlers → first non-error reply wins.
5. **Directed RPC:** `channel(targetDID, …)` → directed hub-tunnel on `targetDID`'s `inboxTopic` → normal Client/Server RPC.
6. **Epoch advance (MLS commit):** topics rotate (HKDF on the new epoch) → members re-subscribe new, unsubscribe old → old topics hit zero subscribers → hub drops them → removed members cannot derive the new topics.

**Sub-protocol discovery:** protocol names are app constants — every member derives the same `topic(secret, epoch, name)`, so finding a known protocol's topic needs no runtime discovery. Dynamic sub-protocols / scopes (e.g. an ephemeral subgroup with a random `scope`) are announced over the **control protocol**, which is **Kubun's** to define. Enkaku ships the scaffold types + the topic-per-name convention only.

## Out of scope (Enkaku side)

- MLS encryption/decryption, topic-secret material, the concrete group/circle/catalog/sync protocols, ledger fold/storage — all consumer (Kubun) side.
- The concrete control protocol (sub-protocol/scope announcements, epoch-transition coordination, roster) — Kubun's; it embeds MLS/membership assumptions.
- Cryptographic isolation between subgroups (same MLS group key).
- Anonymous / blind-token subscription (would close the residual subscriber-co-occurrence inference at the hub) — large crypto lift, deferred.
- Semantic QoS by protocol class at the hub (the protocol label is not hub-visible) — per-opaque-topic rate-limit/meter is still fine.

## Sequencing

```
Phase 1: @enkaku/broadcast (generic primitives)
   ↓
Phase 2: hub pub/sub (hub-protocol + hub-server, single breaking release)
   ↓
Phase 3: @enkaku/group-rpc (high-level MLS wrapper)
   ↓
Phase 4: Kubun integration (control + app protocols, ledger storage, billing authz)
```
