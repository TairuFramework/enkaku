# @enkaku/broadcast

Generic fan-out broadcast primitives for Enkaku RPC: a topic-addressed
broadcast transport, an anycast/gather client, a responder with storm-collapse,
and opaque topic-ID derivation. No MLS, hub, or DID coupling — the consumer
supplies a `BroadcastBus`, a `wrap`/`unwrap` byte transform, and the keying
material fed to `deriveTopicID`.

## Installation

```sh
npm install @enkaku/broadcast
```

## Exports

- `deriveTopicID(secret, epoch, label, scope?)` — opaque HKDF-SHA256 topic ID.
- `createBroadcastTransport({ topicID, bus, wrap?, unwrap? })` — `TransportType` over one topic.
- `BroadcastClient` — `dispatch` (event), `request` (anycast first-wins), `gather` (collect).
- `createBroadcastResponder` + `suppressible` — the responding side with jitter/suppression.
- `defineGroupProtocol` / `GroupProtocolDefinition` — protocol scaffold types.
- `BroadcastBus` / `createMemoryBus` — the bus interface and an in-process fake.
