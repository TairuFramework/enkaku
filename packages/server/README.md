# Enkaku server

## Installation

```sh
npm install @enkaku/server
```

## Invocation hook

`Server`, `serve()` and `server.handle(transport, options)` accept an optional `onInvocation: InvocationHook` callback.
The per-transport hook overrides the server hook.
The server awaits the hook after validation, authentication, access control, encryption and replay checks, before starting the handler.
It runs once for each request, stream, channel or event invocation, never for `send` or `abort` messages.

`InvocationContext` contains:

| Field | Meaning |
| --- | --- |
| `type` | `'request'`, `'stream'`, `'channel'` or `'event'` |
| `procedure` | Procedure name |
| `signal` | AbortSignal for cancellation while the hook awaits dispatch |
| `rid` | Request ID, absent for events |
| `caller` | `InvocationCaller` with verified `iss` and optional caller-asserted `sub` |
| `verifyDelegation()` | Asynchronous delegation check for this procedure and server |
| `transport` | Transport-specific context, typed as `unknown` |
| `message` | Original message |

With `requireAuth: false`, `caller` is absent and `verifyDelegation()` returns `false`.
`sub` becomes trustworthy only when `verifyDelegation()` returns `true`.
Missing or invalid delegation returns `false`, as does a subject matching the issuer. Unexpected verification failures reject the promise.
Transport cancellation aborts `signal` while the hook is pending. Hooks can use it to cancel asynchronous checks.
After cancellation, resolving the hook never starts the handler.
The check memoises its promise and shares it with access-control predicates.
The access-check functions return an `AccessDecision` exposing the same `verifyDelegation()` method.

```ts
import { InvocationRejectedError, Server } from '@enkaku/server'

const server = new Server({
  protocol,
  handlers,
  identity,
  accessRules,
  async onInvocation(ctx) {
    if (ctx.caller?.sub != null && !(await ctx.verifyDelegation())) {
      throw new InvocationRejectedError({
        code: 'DELEGATION_REQUIRED',
        message: 'A valid delegation is required',
      })
    }
  },
})
```

Throwing `InvocationRejectedError({ code, message, cause? })` skips the handler and preserves the supplied code and message in the error reply.
Other exceptions produce code `EK01` and message `Invocation hook failed`, without exposing the exception message.
Events receive no reply. All hook failures emit `handlerError` with category `'invocation'` and mark the invocation span as failed.

## Outgoing stream backpressure

`Server` and `serve()` accept `streamHighWaterMark`, a positive finite safe integer defaulting to `1`.
It bounds the outgoing readable queue for each stream and channel handler, measured in values rather than bytes.
The channel's incoming pipe keeps its existing behaviour.

```ts
const server = serve({
  requireAuth: false,
  protocol,
  handlers,
  transport,
  streamHighWaterMark: 4,
})
```

When transport sends stall, the queue fills and the handler's next `writer.write()` stays pending.
The writer's `desiredSize` drops to `0` until downstream consumption resumes.
Values already in transport buffers sit outside this queue limit.
Handlers must await writes or respect `writer.ready` to avoid accumulating pending writes themselves.
The default now applies backpressure where previous versions allowed unbounded outgoing queues.

## Channel sends

The server delivers a `send` message only when its `prc` matches the procedure of the channel open on its `rid`.
Any other `send`, including one addressed to a request or stream, is an invalid message.
The server emits `invalidMessage` and replies with error code `EK08` on that `rid`.
As with other invalid sends, the client then treats the channel as failed, while the server handler may keep running.
`abort` messages carry no procedure and are routed by `rid` alone.

## Payload redaction

`Server` and `serve()` accept `redactProcedures`, an array of procedure names or a predicate `(procedure: string) => boolean`.
A predicate that throws counts as a match.
The server never logs payloads of a redacted procedure, at any level.
This covers params, event data, sent and received channel or stream values, results, and handler or invocation hook errors.
Invalid messages that name a redacted procedure are logged without their validation error.
Channel `send` messages and invalid messages use the procedure of the live request for their `rid`, not the client-supplied `prc`.
With the option set, an invalid message naming no known procedure is also logged without its validation error.
So is an invalid `send` or `abort` that arrives while authentication of its request is still pending.
Log records keep the procedure name, request ID, message type and error code.
Error records also keep the error name, never its message or cause.
Spans of a redacted procedure record the error code and name only.
Their error message and status message read `Error details redacted`, as does the validation error of an invalid message.
Messages on the wire are unchanged.
In-process `handlerError` and `invalidMessage` events still carry the payload, and the `error.cause` of `writeFailed` events can too.
Consumers must not log those payloads.

```ts
const server = serve({
  requireAuth: false,
  protocol,
  handlers,
  transport,
  redactProcedures: ['secrets/provision', 'mcp/callTool'],
})
```
