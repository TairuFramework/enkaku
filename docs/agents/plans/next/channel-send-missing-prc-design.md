# Design: channel `send` omits `prc`, silently dropped by validating servers

**Priority:** high — data loss (channel sends silently discarded whenever the server validates messages)
**Origin:** Surfaced downstream in kubun migrating to `@enkaku/* 0.17.0`; reproduced end-to-end against enkaku alone.
**Source plan:** `channel-send-missing-prc.md` (this design supersedes it).

## Problem

`Client.createChannel().send()` builds its payload as `{ typ: 'send', rid, val }` — no `prc`. The server's per-procedure send schema requires it:

```
required: ['typ', 'prc', 'rid', 'val']   // createSendMessageSchema, packages/protocol/src/schemas/client.ts
```

A server constructed with a `protocol` builds a validator (`createValidator(createClientMessageSchema(params.protocol))`, `packages/server/src/server.ts`). With that validator active, every real-client channel `send` fails validation against all `anyOf` branches with `missingProperty: "prc"`.

The failure is **silent for `send` specifically**: the validation-failure branch (`server.ts`, `processMessage`) only emits an error reply when the raw `typ` is `request | stream | channel`. For `send` the message is dropped and `processMessage` returns null — no error reply, no `handlerError`, only an `invalidMessage` event. The client's `send()` resolves normally, so the caller never knows the value was lost.

## Root cause / history

Not a regression from recent hub work. Latent since **v0.8 (Dec 2024)**:

- `715c0c3` (v0.9, Oct 2024): send schema born `required: ['typ','rid','val']` — no prc; client also sent none. Consistent.
- `b5a3437` (Dec 7 2024): server message validator added.
- `2d83d0c` ("Refactor docs for v0.8", Dec 19 2024): renamed `cmd`→`prc` across payloads **and added `prc: {const: procedure}`** to the send schema + its `required` — the client builder was never updated. This is the divergence point.
- `04db9ac` (#34, recent): added error-replies for `request`/`stream`/`channel` validation failures, left `send` out. Made send the *lone* silent case; did not introduce the data loss.

Unsurfaced until now because the bug needs a server that is **both** built with a `protocol` (validator on) **and** receives a *real client* send. `createHub` (`hub-server/src/hub.ts` — `serve({ protocol: hubProtocol })`) is the first consumer to do both; the `channel-send-auth` tests hand-roll send tokens that already include `prc`, and ad-hoc servers omit `protocol` (no validator).

## Design decision: conform the client to the schema

`prc` is redundant for **routing** — the server routes a send purely by `rid` (`server.ts` `case 'send'` looks up `controllers[rid]`, never reads prc). prc on send exists solely as the **discriminator the stateless validator needs**: `createClientMessageSchema` builds an `anyOf` of per-procedure branches keyed `prc: {const: <procedure>}`, and the validator runs before routing with no rid→procedure context.

Chosen approach (**A**): add `prc` to the client send payload, conforming it to the schema and to the four other client payload types that all carry `prc`. Validation stays in one stateless place and keeps checking `val` per-procedure. rid remains the router; prc is a validation tag.

Rejected (**C**): drop `prc` from the send schema to treat it as genuinely absent. Would force send-`val` validation to either loosen to an anyOf across all channels (weaker typing) or move into the stateful routing step (validation split across two places). More change for a cosmetic gain; rejected.

## Changes

### 1. Core fix — client send carries `prc`

`packages/client/src/client.ts` (the `send` closure in `createChannel`):

```
{ typ: 'send', rid, val }  →  { typ: 'send', prc: procedure, rid, val }
```

Matches the create/request/stream/event builders in the same client.

### 2. Type fix — `SendCallPayload` requires `prc`

`packages/protocol/src/types/calls.ts`:

```ts
export type SendCallPayload<Procedure extends string, Value> = {
  typ: 'send'
  prc: Procedure
  rid: string
  val: Value
}
```

Thread the new `Procedure` generic through its uses:
- `SendPayloadOf` (`types/payloads.ts`) — no `Procedure` in scope, so type `prc` as `string`: `SendCallPayload<string, DataOf<Definition['send']>>`.
- `ClientPayloadOf` channel branch (`types/payloads.ts`) — pass the concrete `Procedure`.
- `UnknownCallPayload` (`calls.ts`) — `SendCallPayload<string, unknown>`.

This removes the blindness that let `as unknown as AnyClientPayloadOf` hide the missing field; the type now enforces what the schema requires.

### 3. Ergonomics — send validation failures no longer silent (Approach A)

`packages/server/src/server.ts`, validation-failure branch in `processMessage`: add `typ === 'send'` to the reply-capable check so a failed send gets an `INVALID_MESSAGE` error reply on the channel `rid`:

```
typ === 'request' || typ === 'stream' || typ === 'channel' || typ === 'send'
```

A send shares the channel's `rid` (no per-send id), and `send()` only awaits the *write*, never a reply. So the error reply routes through the client's existing `'error'` path (`#read`, `case 'error'`): it rejects the channel result promise and tears the channel down. This is intentional and accepted — a malformed send is a programming error, loud failure beats silent data loss, and after the core fix the common case (prc present) never fails. No client or protocol change is needed for this.

Out of scope: per-send ids or making `send()` await an ack (would require a protocol change).

## Tests

1. **Round-trip (the masked gap):** drive the real `createChannel().send()` against a server built **with** a `protocol` (validator active); assert the value reaches the handler. The existing `channel-send-auth` tests bypass this by hand-rolling tokens with `prc`.
2. **Regression — no silent drop:** send a `val` that fails the send schema against a validating server; assert the channel result promise rejects with `INVALID_MESSAGE` **and** an `invalidMessage` event fires.
3. **Hub end-to-end:** `createHub({ identity, store: createMemoryStore() })`; a signed client opens `hub/receive`; a second client does a direct `hub/send`; the first calls `ch.send({ ack: [sequenceID] })`; assert `store.ack` is called and the message leaves `store.fetch`. (Pre-fix: `store.ack` never called, `invalidMessage` with `missingProperty: "prc"`.)

## Verification

- `pnpm run test` (type checks + unit) green.
- Lint via `rtk proxy pnpm run lint`.
