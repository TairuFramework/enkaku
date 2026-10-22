# Enkaku HTTP client transport

## Installation

```sh
npm install @enkaku/http-fetch
```

## Request cancellation

`ClientTransport` and `createTransportStream` accept `cancelOnAbort`, which defaults to `false`.
When enabled, an outgoing `abort` message cancels that rid's in-flight request POST, including its response body read.
It also skips a cancelled stream/channel open POST waiting for the SSE session or an earlier open.
The abort POST is still sent, and other calls remain usable.

The first stream/channel open establishes the shared SSE connection using only the transport's disposal signal.
Per-rid cancellation never cancels that connection.
Disposing the transport cancels its in-flight POSTs with either option value.

On React Native/Expo, the transport requires `AbortSignal.any`.
A polyfill is planned in `@sozai/runtime-expo`.
