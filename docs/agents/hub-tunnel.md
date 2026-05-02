# Hub-tunnel transport

`@enkaku/hub-tunnel` is a peer-to-peer Enkaku transport that tunnels
Enkaku messages between two peers through a hub relay. The hub acts
as a store-and-forward inbox keyed by recipient DID; the tunnel layer
adds session ordering, sequence numbers, encryption, and graceful
session-end semantics.

## When to use

- Two clients need to speak Enkaku to each other but cannot connect
  directly (NAT, mobile, air-gapped through a relay).
- A trusted relay exists (`HubLike`) but you want end-to-end
  confidentiality, not relay-mediated trust.

For direct peer-to-peer (WebSocket, Node streams, HTTP) use
`@enkaku/transport` instead.

## Architecture

```
[ Enkaku client/server ]
         │
[ EncryptedHubTunnelTransport ]   ← optional encryption layer
         │
[ HubTunnelTransport ]            ← framing, ordering, session-end
         │
[ HubLike ]                       ← caller-provided relay
```

`HubTunnelTransport` reads from a single `hub.receive(localDID)` inbox
subscription and writes to `hub.send`. Frames carry an Enkaku message
in `body` plus session-level routing metadata (sessionID, seq).

`EncryptedHubTunnelTransport` wraps `HubTunnelTransport`, encrypting
the body before encoding into a frame and decrypting on receive.

## Wire format

```ts
type HubFrame =
  | { v: 1; sessionID: string; seq: number; correlationID?: string;
      kind: 'message'; body: EnkakuMessage }
  | { v: 1; sessionID: string; seq: number; correlationID?: string;
      kind: 'session-end'; reason?: string }
```

Schema `$id`: `urn:enkaku:hub-tunnel:frame`.
- `kind: 'message'` — `body` is a standard Enkaku message envelope
  (`{header, payload}`); the inner `payload.typ` is the single source
  of truth for application-layer dispatch.
- `kind: 'session-end'` — hub-tunnel control frame; signals graceful
  end-of-session. Optional `reason` is human-readable context.

`HUB_FRAME_VERSION = 1`.

The encryption envelope (`urn:enkaku:hub-tunnel:envelope`) wraps a
ciphertext payload:

```ts
type TunnelEnvelope = { v: 1; groupID: string; ciphertext: string }
```

`TUNNEL_ENVELOPE_VERSION = 1`.

## Encryptor contract

```ts
type Encryptor = {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>
}
```

Hub-tunnel ships the interface only; callers supply implementations
that fit their key-exchange model (MLS group, Noise session, OPAQUE,
etc.).

**Caller responsibilities:**
- AEAD with associated-data binding to sessionID/seq (defense in
  depth against cross-session replays).
- Replay defense beyond AEAD nonce (per-session monotonic counter).
- Key rotation. Hub-tunnel does not signal rekey moments; callers
  schedule them out-of-band.
- Failure semantics: implementations throw; `EncryptError` /
  `DecryptError` wrap the cause. Decrypt failures **drop the offending
  frame and continue** — the session stays open and the listener sees
  an `ObservabilityEvent` of type `decrypt-failed` plus a
  `frame-dropped` with `reason: 'decrypt'`. Encrypt failures on the
  write path tear down the transport.

## Session lifecycle

- **Open.** First frame received establishes `lockedSessionID` if the
  caller passed `{ auto: true }`. Subsequent frames with mismatched
  sessionID are dropped (`onEvent: { reason: 'session-mismatch' }`).
- **Sequence ordering.** Outbound frames carry monotonic `seq`.
  Inbound frames with `seq < expectedSeq` are deduped silently; any
  larger gap is currently accepted (no out-of-order buffering).
- **Idle timeout.** Optional `idleTimeoutMs` tears down the transport
  after inactivity; the lifecycle layer sends a best-effort
  `session-end` frame to signal the peer.
- **Reconnect timeout.** Optional `reconnectTimeoutMs` paired with
  `hub.events` tears down if a `disconnected` / `reconnecting` event
  is not followed by `connected` within the budget.
- **Graceful end.** `session-end` frame from peer triggers
  `onSessionEnd?.()` and a clean readable close; from local side
  any teardown path emits one best-effort `session-end` outbound.
- **Backpressure.** Inbound queue size is capped (`inboxCapacity`,
  default 1024). Overflow tears down with `BackpressureError`.

## Observability

`onEvent?: ObservabilityEventListener` receives:
- `frame-dropped` with `reason` ∈
  `{ envelope-decode, decrypt, sender-mismatch, session-mismatch, dedup }`.
- `decrypt-failed` with the underlying `DecryptError`.
- `envelope-decode-failed` with the underlying `EnvelopeDecodeError`.

Future event types are added without breaking existing listeners
(open enum).

## Errors

- `BackpressureError` — inbox overflow.
- `DecryptError` / `EncryptError` — `Encryptor` failure surfaces.
- `EnvelopeDecodeError` — malformed `TunnelEnvelope`.
- `FrameDecodeError` — malformed `HubFrame` or schema validation
  failure.
- `HubReconnectingError` — reconnect timeout exceeded.
- `SessionNotEstablishedError` — write attempted before sessionID
  locked.
