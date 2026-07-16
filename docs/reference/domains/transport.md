# Transport - Detailed Reference

## Overview

The Transport layer in Enkaku provides the communication foundation for RPC systems. It abstracts different communication mechanisms (HTTP, sockets, streams, message ports) behind a unified interface, allowing you to swap transport implementations without changing your RPC code. All transports implement bidirectional streaming using the Web Streams API, ensuring consistent behavior across platforms.

## Package Ecosystem

### Core Package: @enkaku/transport

**Purpose**: Defines the base `Transport` class and common abstractions used by all transport implementations.

**Key exports**:
- `Transport<R, W>` - Base class implementing bidirectional streaming
- `TransportType<R, W>` - Interface for transport objects
- `DirectTransports<ToClient, ToServer>` - In-process transport pair
- `TransportEvents` - Event types for transport lifecycle

**Dependencies**: `@sozai/async`, `@sozai/event`, `@sozai/stream`

**Core concepts**:
- Generic over read (`R`) and write (`W`) types
- Implements `AsyncIterator` for reading messages
- Extends `Disposer` for resource cleanup
- Emits `readFailed` on read errors, and `disposing`/`disposed` around teardown. The base
  `write()` does **not** catch or emit -- `writeFailed` is declared in the event map but
  emitted only by the transports that wrap their own writer (`@enkaku/http-serve`,
  `@enkaku/node-streams`)

### HTTP Client Transport: @enkaku/http-fetch

**Purpose**: Browser and Node.js HTTP client using fetch API and Server-Sent Events.

**Key exports**:
- `ClientTransport<Protocol>` - HTTP transport for RPC clients
- `createTransportStream<Protocol>(params)` - Stream creation from a URL
- `ResponseError` - HTTP error handling

**Dependencies**: `@enkaku/otel`, `@enkaku/protocol`, `@enkaku/transport`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream`, `eventsource-parser`

**How it works**:
- Simple requests: POST request with immediate JSON response
- Streams/channels: POST request establishes SSE session; server returns `enkaku-session-id` header
- Lazy sessions: Only created when first stream/channel is opened
- Subsequent messages include session ID header for routing to the SSE stream
- Uses `fetch` + `eventsource-parser` (not EventSource API) for SSE consumption, allowing custom fetch functions and better stream control
- No reconnection: when the SSE stream drops, the session returns to `idle` and the readable is
  errored. In-flight streams terminate rather than resume. Recovery is opt-in at the client
  level via `handleTransportError` / `handleTransportDisposed`, which must return a *new*
  transport -- and even then the dropped stream is not replayed

### HTTP Server Transport: @enkaku/http-serve

**Purpose**: HTTP server handler compatible with standard HTTP servers (Bun, Deno, Node).

**Key exports**:
- `ServerTransport<Protocol>` - HTTP transport for RPC servers
- `createServerBridge<Protocol>(options)` - Lower-level bridge creation
- `RequestHandler` - Type for HTTP request handling

**Dependencies**: `@enkaku/otel`, `@enkaku/protocol`, `@enkaku/transport`, `@sozai/async`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream`

**How it works**:
- Handles POST and OPTIONS requests -- preflight is answered by the transport itself, not by
  your code
- CORS support with configurable allowed origins
- POST-based session protocol: first stream/channel POST creates a session with UUID, returns SSE response with `enkaku-session-id` header
- Subsequent POSTs include session ID for routing responses to the correct SSE stream
- Session cleanup: automatic expiry after 5 minutes of inactivity, periodic sweep every 60 seconds
- Inflight request tracking with 30-second timeout for request-response messages

**Configuration options** (`ServerTransportOptions`):
- `allowedOrigin`: String or array of allowed CORS origins. **Defaults to none**: with no
  `allowedOrigin` configured, any request carrying an `Origin` header is rejected with `403`.
  `'*'` is opt-in, and even then a present `Origin` must still be a valid `http:`/`https:`
  origin
- `maxSessions`: Concurrent SSE session cap (default: 1000)
- `sessionTimeoutMs`: Session inactivity expiry (default: 300_000 -- 5 minutes)
- `maxInflightRequests`: In-flight request cap (default: 10_000)
- `requestTimeoutMs`: Request-response timeout (default: 30_000)
- `maxRequestBodySize`, `maxSessionBufferBytes`: Byte limits
- `runtime`: Runtime injection

`onWriteError` is **not** a `ServerTransport` option -- it belongs to `createServerBridge`'s
`ServerBridgeOptions`. `ServerTransport` wires its own, re-emitting failures as the
transport's `writeFailed` event.

### Socket Transport: @enkaku/socket

**Purpose**: Unix domain sockets and TCP sockets for Node.js IPC.

**Key exports**:
- `SocketTransport<R, W>` - Socket-based transport
- `connectSocket(path, options?)` - Helper to connect to socket
- `createTransportStream<R, W>(source, options?)` - Stream creation from socket

**Dependencies**: `@enkaku/otel`, `@enkaku/transport`, `@sozai/otel`, `@sozai/stream` (plus the
`node:net` builtin)

**How it works**:
- Uses newline-delimited JSON (JSONL) format
- Each message is one JSON object per line
- Socket lifecycle tied to transport disposal: `dispose()` destroys the socket
- Automatic error propagation from socket to stream
- Connect-only: the package has no server/listen API. Accept loops are yours to build with
  `node:net`, passing each accepted `Socket` to a `SocketTransport`

**Platform**: Node.js only (uses native `net` module)

### Node Streams Transport: @enkaku/node-streams

**Purpose**: Communicate over Node.js Readable/Writable streams (process pipes, custom streams).

**Key exports**:
- `NodeStreamsTransport<R, W>` - Transport for Node streams
- `createTransportStream<R, W>(source)` - Convert Node streams to Web streams

**Dependencies**: `@sozai/stream`, `@enkaku/transport` (plus the `node:stream` builtin)

**How it works**:
- Bridges Node.js streams to Web Streams API
- Input: Converts Readable to ReadableStream via `Readable.toWeb()`
- Output: Converts the Node Writable *into* a WritableStream via `Writable.toWeb()`, then pipes
  the JSONL-encoded output to it
- Uses JSON Lines format with `toJSONLines()` and `fromJSONLines()`

**Common use cases**: any `{ readable: Readable; writable: Writable }` pair -- `process.stdin` /
`process.stdout` for CLI tools, child process stdio pipes, or custom streams. The package
requires only that shape; it holds no stdio-specific handling of its own.

### Message Transport: @enkaku/message

**Purpose**: Browser MessagePort API for Web Workers, Service Workers, and Electron.

**Key exports**:
- `MessageTransport<R, W>` - Transport using MessagePort
- `createTransportStream<R, W>(source)` - Stream from MessagePort

**Dependencies**: `@enkaku/transport`

**How it works**:
- Uses `postMessage()` for writing
- Uses `onmessage` event for reading
- Leverages structured clone algorithm (no JSON serialization)
- Does **not** transfer transferable objects: `postMessage` is called with no transfer list, so
  an `ArrayBuffer` passed as a param is structured-clone copied, not detached

**Platform**: Requires the `MessagePort` global. For Electron, use `@enkaku/electron` rather
than this package -- Electron's main process exposes `MessagePortMain`, not `MessagePort`.

### Electron IPC: @enkaku/electron

**Purpose**: Enkaku RPC across the Electron main/renderer boundary.

**Key exports**:
- `serveProcess(params)` / `handleProcessPort(options)` - main-process serving
- `createMainTransportStream<R, W>(input)` - stream from a `MessagePortMain`
- `createRendererClient(options)` / `createRendererTransportStream(options)` - renderer side
- `isAllowedSenderURL(url, allowlist)` / `SenderURLAllowlist` - sender validation, where the
  allowlist is `Array<string | RegExp>`

**Dependencies**: `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`. `electron` itself is
a dev dependency -- the package imports from it and expects your app to provide it.

**How it works**:
- Builds on Electron's `MessageChannelMain` / `MessagePortMain` and `ipcMain`
- Unlike the other five, it exports no `*Transport` class of its own -- it wires
  `@enkaku/transport` streams and `@enkaku/server`'s `serve` to Electron IPC
- The default bridge name is `'app'`

**Platform**: Electron only

## Common Patterns

### Pattern: Setting Up HTTP Client-Server

**Use case**: Traditional web application with client in browser, server on backend

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-fetch'
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'
import type { MyProtocol } from './protocol'

// Client setup (browser or Node.js)
const clientTransport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})

// The protocol is a type parameter -- `Client` takes no `protocol` option
const client = new Client<MyProtocol>({ transport: clientTransport })

// Make calls
const result = await client.request('greet', { param: { name: 'Alice' } })

// Server setup
const serverTransport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://example.com', 'https://app.example.com']
})

const server = serve<MyProtocol>({
  requireAuth: false,
  protocol: myProtocol,
  transport: serverTransport,
  handlers: {
    greet: async ({ param }) => {
      return { message: `Hello, ${param.name}!` }
    }
  }
})

// Integration with HTTP server (Bun example)
Bun.serve({
  port: 3000,
  fetch: serverTransport.fetch
})

// Or with standard Request/Response
const response = await serverTransport.fetch(request)
```

**Key points**:
- `serve()` takes a singular `transport`; `new Server()` takes plural `transports: [...]`.
  Either way an access option is required -- `requireAuth: false` or an `identity`
- Single SSE session shared across all streams/channels per client
- CORS handled automatically by server transport, including OPTIONS preflight
- The server transport is a plain `Request` -> `Response` handler, so any host that speaks that
  interface can serve it
- Client automatically manages session lifecycle (lazy creation, ID tracking)
- Server tracks sessions with automatic timeout and cleanup

**Gotchas**:
- Sessions expire after `sessionTimeoutMs` of inactivity (default 5 minutes), swept on an
  interval. There is no keep-alive or heartbeat -- an idle SSE session is reaped
- With no `allowedOrigin` set, any request carrying an `Origin` header gets a `403`
- Session cleanup happens on client disconnect

### Pattern: Testing with DirectTransports

**Use case**: Unit testing RPC handlers without network overhead

**Implementation**:

```typescript
import { describe, test, expect } from 'vitest'
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import type { MyProtocol } from './protocol'

describe('RPC handlers', () => {
  test('should greet user', async () => {
    const transports = new DirectTransports<
      ServerMessage,
      ClientMessage
    >()

    const server = serve<MyProtocol>({
      requireAuth: false,
      protocol: myProtocol,
      transport: transports.server,
      handlers: {
        greet: async ({ param }) => {
          return { message: `Hello, ${param.name}!` }
        }
      }
    })

    const client = new Client<MyProtocol>({ transport: transports.client })

    const result = await client.request('greet', {
      param: { name: 'Test' }
    })

    expect(result.message).toBe('Hello, Test!')

    // Cleanup
    await transports.dispose()
  })
})
```

**Key points**:
- No network hop -- the two sides are wired to each other in-process
- Same API as remote transports
- Message passing is asynchronous: the pair is backed by `ReadableStream`/`WritableStream`, so
  delivery lands on a microtask rather than synchronously within the call
- `dispose()` on the pair disposes both sides

**Best practices**:
- Create fresh transports for each test
- Always dispose transports after test
- Use for handler logic tests, not transport tests
- For the common case, `@enkaku/standalone`'s `standalone(handlers, options)` wires a
  `DirectTransports` pair to a client and server for you

### Pattern: IPC with Socket Transport

**Use case**: Microservices communicating on same host, daemon processes

**Implementation**:

```typescript
import { createServer } from 'node:net'
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket'
import type { MyProtocol } from './protocol'

// Server process -- @enkaku/socket is connect-only, so the accept loop is plain node:net
const socketPath = '/tmp/my-service.sock'

const netServer = createServer((socket) => {
  const transport = new SocketTransport<ClientMessage, ServerMessage>({
    socket
  })

  const server = serve<MyProtocol>({
    requireAuth: false,
    protocol: myProtocol,
    transport,
    handlers: {
      // Your handlers here
    }
  })

  socket.on('close', () => {
    transport.dispose()
  })
})

netServer.listen(socketPath, () => {
  console.log(`Server listening on ${socketPath}`)
})

// Client process
const clientTransport = new SocketTransport<ServerMessage, ClientMessage>({
  socket: socketPath
})

const client = new Client<MyProtocol>({ transport: clientTransport })

// Make requests
const result = await client.request('myProcedure', { param: 'value' })
```

**Key points**:
- Each socket connection creates a new transport
- A `socket` string is an IPC/Unix socket path only -- it is handed to node's
  `createConnection(path)`, which does not parse `host:port`. For TCP, build the `Socket`
  yourself and pass the instance
- JSONL format allows streaming and framing
- Connection cleanup handled by socket events
- When `socket` is a path string, the connection is made lazily, on the transport's first read or write -- not in the constructor. `connectSocket(path, { timeoutMs, signal })` bounds that attempt (10s by default; `timeoutMs: 0` disables it), and `SocketTransport` accepts the same budget as `connectTimeoutMs`
- `transport.dispose()` flushes pending writes, then destroys the socket -- for every source shape, including a function source. A prior version only `unref()`d the socket, which left it open and could hang a peer server that waits for its connections to drain before closing

### Pattern: Web Worker Communication

**Use case**: Offload heavy computation to background thread

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { MessageTransport } from '@enkaku/message'
import type { WorkerProtocol } from './protocol'

// Main thread (main.ts)
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module'
})

const { port1, port2 } = new MessageChannel()

// Send port2 to worker
worker.postMessage({ type: 'init', port: port2 }, [port2])

// Create client using port1
const transport = new MessageTransport<FromWorker, ToWorker>({
  port: port1
})

const client = new Client<WorkerProtocol>({ transport })

// Call worker procedures
const result = await client.request('processData', {
  param: { data: largeDataset }
})

// Worker thread (worker.ts)
self.addEventListener('message', (event) => {
  if (event.data.type === 'init') {
    const transport = new MessageTransport<ToWorker, FromWorker>({
      port: event.data.port
    })

    const server = serve<WorkerProtocol>({
      requireAuth: false,
      protocol: workerProtocol,
      transport,
      handlers: {
        processData: async ({ param }) => {
          // Heavy computation here
          return { result: processedData }
        }
      }
    })
  }
})
```

**Key points**:
- Uses structured clone (no JSON serialization)
- MessageChannel provides isolated communication
- Port must be transferred in postMessage
- Worker and main thread each hold one port

**Transferable objects are not transferred**: the transport calls `port.postMessage(msg)` with
no transfer list, and neither `MessageTransportParams` nor `PortSource` accepts one. An
`ArrayBuffer` passed as a param is structured-clone **copied** -- it is not detached in the
sending thread, and large buffers pay a full copy on every call.

### Pattern: Child Process Communication

**Use case**: CLI tools, background tasks, process isolation

**Implementation**:

```typescript
import { spawn } from 'node:child_process'
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { NodeStreamsTransport } from '@enkaku/node-streams'
import type { ChildProtocol } from './protocol'

// Parent process
const child = spawn('node', ['child.js'], {
  stdio: ['pipe', 'pipe', 'inherit'] // stdin, stdout, stderr
})

const parentTransport = new NodeStreamsTransport<FromChild, ToChild>({
  streams: {
    readable: child.stdout,
    writable: child.stdin
  }
})

const client = new Client<ChildProtocol>({ transport: parentTransport })

// Communicate with child
const result = await client.request('task', { param: 'data' })

child.on('exit', (code) => {
  console.log(`Child exited with code ${code}`)
  parentTransport.dispose()
})

// Child process (child.js)
import process from 'node:process'

const childTransport = new NodeStreamsTransport<ToChild, FromChild>({
  streams: {
    readable: process.stdin,
    writable: process.stdout
  }
})

const server = serve<ChildProtocol>({
  requireAuth: false,
  protocol: childProtocol,
  transport: childTransport,
  handlers: {
    task: async ({ param }) => {
      // Process task
      return { result: 'done' }
    }
  }
})

// Keep process alive
process.stdin.resume()
```

**Key points**:
- Uses stdin/stdout for bidirectional communication
- stderr available for logging (not captured)
- JSONL format ensures message framing
- Child process must keep stdin open
- Parent should handle child exit events

**Debugging tips**:
- Use `stderr` for debug logging (console.error)
- Avoid writing to stdout directly (breaks JSONL)
- Test message parsing with manual JSONL input

## Package Interactions

### Transport and Client

The `Client` class accepts any transport implementing `ClientTransportOf<Protocol>`:

```typescript
import type { ClientTransportOf } from '@enkaku/protocol'

type ClientTransportOf<Protocol> = TransportType<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
>
```

Client writes `ClientMessage` objects and reads `ServerMessage` objects. All transport implementations provide this interface through generic parameters.

### Transport and Server

The `Server` class accepts any transport implementing `ServerTransportOf<Protocol>`:

```typescript
import type { ServerTransportOf } from '@enkaku/protocol'

type ServerTransportOf<Protocol> = TransportType<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
>
```

Server writes `ServerMessage` objects and reads `ClientMessage` objects - the inverse of client.

### Transport Events

All transports extend `Disposer` and emit `TransportEvents` -- `writeFailed`, `readFailed`,
`disposing`, `disposed`, and `requestAborted`:

```typescript
const unsubscribe = transport.events.on('writeFailed', ({ error, rid }) => {
  console.error(`Write failed for request ${rid}:`, error)
})
```

`on()` returns an unsubscribe function; there is no `off()` method.

Note that `writeFailed` on a *transport* is not how `Client` and `Server` learn about write
failures. The base `Transport.write()` neither catches nor emits, so only the transports that
wrap their own writer (`@enkaku/http-serve`, `@enkaku/node-streams`) ever fire it. `Client` and
`Server` catch write rejections directly and emit their own `writeFailed` on their own
emitters. The two events share a name, not a source.

## API Quick Reference

### Base Transport Class

```typescript
class Transport<R, W> extends Disposer {
  constructor(params: { stream: TransportInput<R, W>; signal?: AbortSignal })

  // Reading
  read(): Promise<ReadableStreamReadResult<R>>
  [Symbol.asyncIterator](): AsyncIterator<R, R | null>

  // Writing
  write(value: W): Promise<void>
  getWritable(): WritableStream<W>

  // Events
  get events(): EventEmitter<TransportEvents>

  // Disposal
  dispose(reason?: unknown): Promise<void>
}
```

### DirectTransports

```typescript
class DirectTransports<ToClient, ToServer> extends Disposer {
  constructor(options?: { signal?: AbortSignal })

  get client(): TransportType<ToClient, ToServer>
  get server(): TransportType<ToServer, ToClient>
}
```

### HTTP Client Transport

```typescript
class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: {
    url: string
    fetch?: FetchFunction
    runtime?: Runtime
    maxBufferSize?: number
  })
}
```

### HTTP Server Transport

```typescript
class ServerTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
> {
  constructor(options?: {
    allowedOrigin?: string | Array<string>
    maxSessions?: number            // default 1000
    runtime?: Runtime
    sessionTimeoutMs?: number       // default 300_000 (5 minutes)
    maxInflightRequests?: number    // default 10_000
    requestTimeoutMs?: number       // default 30_000
    maxRequestBodySize?: number
    maxSessionBufferBytes?: number
  })

  fetch(request: Request): Promise<Response>
}
```

### Socket Transport

```typescript
// Also accepts the inherited FromJSONLines options, including `highWaterMark` (default 1 MiB)
class SocketTransport<R, W> extends Transport<R, W> {
  constructor(params: {
    socket: Socket | Promise<Socket> | (() => Socket | Promise<Socket>) | string
    signal?: AbortSignal
    connectTimeoutMs?: number       // default 10_000; `0` disables
  })
}

function connectSocket(
  path: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }, // timeoutMs default 10_000; `0` disables
): Promise<Socket>
```

### Node Streams Transport

```typescript
// Also accepts the inherited FromJSONLines options
class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: {
    streams: { readable: Readable; writable: Writable }
      | Promise<{ readable: Readable; writable: Writable }>
      | (() => { readable: Readable; writable: Writable }
          | Promise<{ readable: Readable; writable: Writable }>)
    signal?: AbortSignal
  })
}
```

### Message Transport

```typescript
class MessageTransport<R, W> extends Transport<R, W> {
  constructor(params: {
    port: MessagePort | Promise<MessagePort> | (() => MessagePort | Promise<MessagePort>)
    signal?: AbortSignal
  })
}
```

## Examples by Scenario

### Scenario 1: Serverless Deployment (Cloudflare Workers)

**Goal**: Deploy RPC server to Cloudflare Workers edge network

```typescript
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'
import type { MyProtocol } from './protocol'

const transport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://myapp.com']
})

const server = serve<MyProtocol>({
  requireAuth: false,
  protocol: myProtocol,
  transport,
  handlers: {
    // Your handlers
  }
})

export default {
  async fetch(request: Request): Promise<Response> {
    return transport.fetch(request)
  }
}
```

**Why this works**:
- The server transport is a plain `Request` -> `Response` handler, which is exactly the shape a
  Worker exports
- No persistent server process needed for request-response procedures

**Caveat for streams and channels**: SSE session state lives in-process, in the transport's own
`sessions` map with an interval sweep. It is not delegated to the platform. A deployment that
spreads requests across isolates or instances will fail to route follow-up POSTs to the isolate
holding the session. Request-response procedures are unaffected; streams and channels need
sticky routing to a single instance.

### Scenario 2: Real-Time Dashboard with Streaming

**Goal**: Stream live metrics from server to browser dashboard

```typescript
// Server
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'

const transport = new ServerTransport<DashboardProtocol>()

const server = serve<DashboardProtocol>({
  requireAuth: false,
  protocol: dashboardProtocol,
  transport,
  handlers: {
    // Stream handlers are not generators: emit by writing to `writable`, and stop when
    // `signal` aborts. The returned value is the stream's result, not its data.
    liveMetrics: async ({ signal, writable }) => {
      const writer = writable.getWriter()
      try {
        while (!signal.aborted) {
          await writer.write(await collectMetrics())
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } finally {
        await writer.close()
      }
    }
  }
})

// Client (browser)
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-fetch'

const transport = new ClientTransport<DashboardProtocol>({
  url: '/rpc'
})

const client = new Client<DashboardProtocol>({ transport })

const stream = client.createStream('liveMetrics', {
  param: { interval: 1000 }
})

const reader = stream.readable.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  updateDashboard(value)
}
```

**Key aspects**:
- The handler writes to `writable`; nothing in the server iterates a generator
- HTTP client uses SSE for receiving stream
- `createStream` is the client method -- there is no `client.stream`
- `stream.readable` is a WHATWG `ReadableStream`. Async iteration (`for await`) is not
  implemented in every browser, so `getReader()` is the portable form

**No automatic reconnection**: if the SSE connection drops, the readable is errored and the
stream ends. `handleTransportError` / `handleTransportDisposed` on `Client` can supply a
replacement transport, but the interrupted stream is not replayed.

### Scenario 3: Multi-Service Architecture

**Goal**: Multiple Node.js services communicating via Unix sockets

```typescript
// Service A (gateway.ts)
import { createServer } from 'node:net'
import { serve } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket'
import { Client } from '@enkaku/client'

// Listen for incoming connections -- the accept loop is node:net, not @enkaku/socket
const server = createServer((socket) => {
  const transport = new SocketTransport<ClientMsg, ServerMsg>({
    socket
  })

  serve<GatewayProtocol>({
    requireAuth: false,
    protocol: gatewayProtocol,
    transport,
    handlers: {
      // Gateway handlers
    }
  })
})

server.listen('/tmp/gateway.sock')

// Connect to other services
const authClient = new Client<AuthProtocol>({
  transport: new SocketTransport({
    socket: '/tmp/auth.sock'
  })
})

// Service B (auth.ts)
import { createServer } from 'node:net'
import { serve } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket'

const server = createServer((socket) => {
  const transport = new SocketTransport<AuthClientMsg, AuthServerMsg>({
    socket
  })

  serve<AuthProtocol>({
    requireAuth: false,
    protocol: authProtocol,
    transport,
    handlers: {
      validateToken: async ({ param }) => {
        // Validation logic
        return { valid: true }
      }
    }
  })
})

server.listen('/tmp/auth.sock')
```

**Architecture notes**:
- Unix sockets keep traffic on the host, with no TCP stack in the path
- Process isolation with a shared filesystem
- `@enkaku/socket` connects; each service owns its own `node:net` accept loop

## Troubleshooting

### Issue: SSE Connection Keeps Closing

**Symptoms**: Streams/channels work briefly then disconnect

**Causes**:
- Session inactivity expiry: the server transport reaps sessions after `sessionTimeoutMs`
  (default 5 minutes), swept on an interval. There is no keep-alive or heartbeat to hold an
  idle session open -- if your stream is idle longer than the timeout, raise
  `sessionTimeoutMs`
- The session cap (`maxSessions`, default 1000) is reached
- Client-side buffer overflow: exceeding `maxBufferSize` aborts the SSE connection
- Client navigating away or closing tab

**Solutions**:
```typescript
// Server: widen the inactivity budget for long-lived idle streams
const transport = new ServerTransport<Protocol>({
  sessionTimeoutMs: 30 * 60_000, // 30 minutes
})

// Client: observe the failure. The SSE readable errors on disconnect, which surfaces as
// `readFailed` -- ClientTransport never emits `writeFailed`.
transport.events.on('readFailed', ({ error }) => {
  console.error('SSE stream failed:', error)
})
```

There is no built-in reconnection. To recover, supply a replacement transport from
`handleTransportError` / `handleTransportDisposed` on `Client`; in-flight streams are not
replayed.

### Issue: CORS Errors with HTTP Transport

**Symptoms**: Browser shows CORS policy error

**Causes**:
- Missing `allowedOrigin` configuration. This is the default: with none set, any request
  carrying an `Origin` header is rejected `403`
- Incorrect origin in `allowedOrigin` array

Preflight is *not* a cause -- `ServerTransport` answers `OPTIONS` itself.

**Solutions**:
```typescript
const transport = new ServerTransport<Protocol>({
  allowedOrigin: [
    'https://app.example.com',
    'http://localhost:3000' // Development
  ]
})

// Or allow all origins (not recommended for production). Note a present Origin must still be
// a valid http:/https: origin, so '*' is not unconditional.
const transport = new ServerTransport<Protocol>({
  allowedOrigin: '*'
})
```

### Issue: Socket Connect Hangs or Times Out

**Symptoms**: `Socket connect timed out after 10000ms`, or `Socket connect aborted`

**Causes**:
- Nothing is listening on the path yet
- Wrong socket path, or a path that is not an IPC socket. A `socket` string is passed to node's
  `createConnection(path)` and is never parsed as `host:port` -- for TCP, pass a `Socket`
  instance instead
- The connect attempt exceeded `connectTimeoutMs` (default 10_000)
- The transport's `signal` aborted while connecting

**Solutions**:
```typescript
// Widen or disable the connect budget
const transport = new SocketTransport<R, W>({
  socket: '/tmp/my-service.sock',
  connectTimeoutMs: 30_000, // `0` disables the timeout entirely
})

// Or connect explicitly and handle the failure
import { connectSocket } from '@enkaku/socket'

const socket = await connectSocket('/tmp/my-service.sock', { timeoutMs: 30_000 })
const transport = new SocketTransport<R, W>({ socket })
```

Note that a path-string transport connects lazily, on first read or write -- not in the
constructor. A connect failure therefore surfaces at first use, not at construction.

### Issue: Messages Not Parsing in Node Streams

**Symptoms**: Messages not received, or a `JSONLinesError` from the decoder

**Causes**:
- Writing directly to stdout instead of using transport
- Missing newlines in JSONL format

**Solutions**:
```typescript
// WRONG: Don't write directly to stdout
console.log('Hello') // Breaks JSONL parsing

// RIGHT: Use stderr for logging
console.error('Debug info') // Safe

// Ensure JSONL format (automatic with NodeStreamsTransport)
const transport = new NodeStreamsTransport<R, W>({
  streams: {
    readable: process.stdin,
    writable: process.stdout
  }
})
// Transport handles JSON.stringify + '\n' automatically
```

### Issue: Memory Leak with Streams

**Symptoms**: Memory usage grows over time

**Causes**:
- Not disposing transports
- Retaining event subscriptions past the transport's life

**Solutions**:
```typescript
// Always dispose transports
const transport = new ClientTransport<MyProtocol>({ url: '/rpc' })
const client = new Client<MyProtocol>({ transport })
try {
  const stream = client.createStream('data', { param })
  // consume the stream...
} finally {
  await transport.dispose()
}

// Aborting the signal disposes the transport -- an explicit dispose() call is redundant
const controller = new AbortController()
const transports = new DirectTransports<ToClient, ToServer>({
  signal: controller.signal
})

// Later: this alone tears both sides down
controller.abort()

// Unsubscribe with the function `on()` returns -- there is no `off()`
const unsubscribe = transport.events.on(
  'writeFailed',
  (event: TransportEvents['writeFailed']) => { /* ... */ },
)
// Later:
unsubscribe()
```

### Issue: Type Errors with Generic Transport Parameters

**Symptoms**: TypeScript errors about message types not matching

**Causes**:
- Incorrect generic parameter order (`<R, W>`)
- Mismatched protocol types
- Using wrong transport for client vs server

**Solutions**:
```typescript
// Remember: R = Read type, W = Write type.
// On the `<R, W>` transports (SocketTransport, NodeStreamsTransport, MessageTransport):
// a client reads ServerMessage and writes ClientMessage...
const clientTransport = new SocketTransport<ServerMessage, ClientMessage>({
  socket: '/tmp/service.sock',
})

// ...and a server is the inverse.
const serverTransport = new SocketTransport<ClientMessage, ServerMessage>({ socket })

// The HTTP transports are protocol-aware instead: one type param, generics derived for you.
const httpClientTransport = new ClientTransport<MyProtocol>({ url: '/rpc' })
const httpServerTransport = new ServerTransport<MyProtocol>()
```
