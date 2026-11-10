# Enkaku transport

## Installation

```sh
npm install @enkaku/transport
```

## Per-message context

`TransportType<R, W>` supports an optional `getMessageContext(message: unknown): unknown` method.
Transports can expose local metadata for a received message without changing its serialised representation.
The server passes this metadata to the invocation hook as `InvocationContext.transport`.

The base `Transport` does not implement this optional method. Existing transports need no changes.
Custom transports can implement the method and return a more specific context type.
The server receives `undefined` when the method is absent.
Callers should narrow the returned `unknown` value before accessing its fields.

The HTTP server transport exposes the original HTTP request and optional SSE session metadata.
See the [HTTP server transport documentation](../http-serve/README.md) for its context and ownership APIs.
