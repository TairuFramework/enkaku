# Enkaku server

## Installation

```sh
npm install @enkaku/server
```

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
