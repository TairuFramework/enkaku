# Enkaku HTTP server transport

## Installation

```sh
npm install @enkaku/http-serve
```

## Per-message HTTP context

`ServerTransport.getMessageContext(message)` and `createServerBridge().getMessageContext(message)` return `HTTPMessageContext | undefined`.
The context contains the original `request: Request`, an optional `sessionID` and an optional `session: HTTPSessionHandle`.
Stream and channel invocations expose the new or existing SSE session ID from the `enkaku-session-id` header.
Messages associated with a known session share its session handle.
Unary requests and messages without a session still expose their HTTP request.

Context lookup uses message object identity and a weak map. Unknown objects, cloned messages and non-object values return `undefined`.
Context stays outside the serialised message.
The server's `onInvocation` hook receives this context through `ctx.transport`, typed as `unknown`.
A client disconnect or session drop aborts `ctx.signal` during a pending hook and prevents subsequent handler dispatch.

## SSE session ownership

`HTTPSessionHandle` exposes read-only `id` and `owner` properties plus `bindOwner(did: string): void`.
Sessions start unbound. Binding the same DID again succeeds. Binding another DID throws and preserves the original owner.
Bind ownership from the verified caller in an authenticated invocation hook:

```ts
import { type HTTPMessageContext, ServerTransport } from '@enkaku/http-serve'
import { Server } from '@enkaku/server'

const transport = new ServerTransport<typeof protocol>()
const server = new Server({
  protocol,
  handlers,
  identity,
  accessRules,
  onInvocation(ctx) {
    const context = ctx.transport as HTTPMessageContext | undefined
    if (ctx.caller != null) {
      context?.session?.bindOwner(ctx.caller.iss)
    }
  },
})
server.handle(transport)
```

`ServerTransportOptions` and `ServerBridgeOptions` accept `enforceSessionOwner`, defaulting to `true`.
Subsequent POSTs referencing a bound session must carry a `payload.iss` exactly matching its owner DID string.
A missing or different issuer produces HTTP `403` with `{ error: 'Session owner mismatch' }` before enqueueing the message.
This applies to request, event, stream, channel, send and abort messages.
The bridge checks the issuer string. The RPC server still authenticates the message.
Unbound sessions keep their existing behaviour. Setting `enforceSessionOwner: false` disables the check without clearing ownership.

## Written frame bytes

Both `ServerTransportOptions` and `ServerBridgeOptions` accept a synchronous `onFrameWritten(info: FrameWrittenInfo)` observer.

| Field | Meaning |
| --- | --- |
| `kind` | `'response'`, `'sse'` or `'heartbeat'` |
| `bytes` | UTF-8 byte length of the serialised body or frame |
| `rid` | Request ID for response and SSE frames, absent for heartbeats |
| `sessionID` | Session ID for SSE frames and heartbeats |

```ts
const transport = new ServerTransport<typeof protocol>({
  onFrameWritten(info) {
    console.log(info.kind, info.bytes, info.rid, info.sessionID)
  },
})
```

Response counts cover the JSON message body. SSE counts include the `data: ` prefix and trailing `\n\n`.
Initial and periodic heartbeat comments contain `:\n\n` and count as three bytes, with a session ID and no request ID.
Every enqueued SSE frame produces a callback, including the frame triggering buffer overflow. Frames rejected before enqueueing produce no callback.
Counts exclude HTTP headers and network overhead. Resolving a response or enqueueing a frame does not confirm delivery to the client.
Synchronous callback exceptions are logged and swallowed so writes continue.
