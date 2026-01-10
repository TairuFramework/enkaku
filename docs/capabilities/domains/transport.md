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

**Dependencies**: `@enkaku/async`, `@enkaku/event`, `@enkaku/stream`

**Core concepts**:
- Generic over read (`R`) and write (`W`) types
- Implements `AsyncIterator` for reading messages
- Extends `Disposer` for resource cleanup
- Emits events on write failures

### HTTP Client Transport: @enkaku/http-client-transport

**Purpose**: Browser and Node.js HTTP client using fetch API and Server-Sent Events.

**Key exports**:
- `ClientTransport<Protocol>` - HTTP transport for RPC clients
- `createEventStream(url)` - SSE connection management
- `ResponseError` - HTTP error handling

**Dependencies**: `@enkaku/protocol`, `@enkaku/stream`, `@enkaku/transport`

**How it works**:
- Simple requests: POST request with immediate JSON response
- Streams/channels: POST request + SSE connection for server push
- Lazy SSE: Only connects when first stream/channel is opened
- Automatic session management with server

**Browser compatibility**: Works in all modern browsers with fetch and EventSource

### HTTP Server Transport: @enkaku/http-server-transport

**Purpose**: HTTP server handler compatible with standard HTTP servers (Bun, Deno, Node).

**Key exports**:
- `ServerTransport<Protocol>` - HTTP transport for RPC servers
- `createServerBridge<Protocol>(options)` - Lower-level bridge creation
- `RequestHandler` - Type for HTTP request handling

**Dependencies**: `@enkaku/async`, `@enkaku/protocol`, `@enkaku/stream`, `@enkaku/transport`

**How it works**:
- Handles GET, POST, and OPTIONS requests
- CORS support with configurable allowed origins
- Session management for stateful streams
- SSE feed for server-to-client streaming
- Request deduplication and inflight tracking

**Configuration options**:
- `allowedOrigin`: String or array of allowed CORS origins (default: '*')
- `onWriteError`: Callback for transport write errors

### Socket Transport: @enkaku/socket-transport

**Purpose**: Unix domain sockets and TCP sockets for Node.js IPC.

**Key exports**:
- `SocketTransport<R, W>` - Socket-based transport
- `connectSocket(path)` - Helper to connect to socket
- `createTransportStream<R, W>(source)` - Stream creation from socket

**Dependencies**: `node:net`, `@enkaku/stream`, `@enkaku/transport`

**How it works**:
- Uses newline-delimited JSON (JSONL) format
- Each message is one JSON object per line
- Socket lifecycle tied to transport disposal
- Automatic error propagation from socket to stream

**Platform**: Node.js only (uses native `net` module)

### Node Streams Transport: @enkaku/node-streams-transport

**Purpose**: Communicate over Node.js Readable/Writable streams (process pipes, custom streams).

**Key exports**:
- `NodeStreamsTransport<R, W>` - Transport for Node streams
- `createTransportStream<R, W>(source)` - Convert Node streams to Web streams

**Dependencies**: `node:stream`, `@enkaku/stream`, `@enkaku/transport`

**How it works**:
- Bridges Node.js streams to Web Streams API
- Input: Converts Readable to ReadableStream via `Readable.toWeb()`
- Output: Converts WritableStream to Writable via `Writable.toWeb()`
- Uses JSON Lines format with `toJSONLines()` and `fromJSONLines()`

**Common use cases**:
- `process.stdin` / `process.stdout` for CLI tools
- Child process stdio pipes
- Custom stream implementations (file streams, network streams)

### Message Transport: @enkaku/message-transport

**Purpose**: Browser MessagePort API for Web Workers, Service Workers, and Electron.

**Key exports**:
- `MessageTransport<R, W>` - Transport using MessagePort
- `createTransportStream<R, W>(source)` - Stream from MessagePort

**Dependencies**: `@enkaku/transport`

**How it works**:
- Uses `postMessage()` for writing
- Uses `onmessage` event for reading
- Leverages structured clone algorithm (no JSON serialization)
- Supports transferable objects

**Platform**: All modern browsers, Web Workers, Service Workers, Electron

## Common Patterns

### Pattern: Setting Up HTTP Client-Server

**Use case**: Traditional web application with client in browser, server on backend

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { MyProtocol } from './protocol'

// Client setup (browser or Node.js)
const clientTransport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})

const client = new Client({
  protocol: myProtocol,
  transport: clientTransport
})

// Make calls
const result = await client.request('greet', { param: { name: 'Alice' } })

// Server setup
const serverTransport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://example.com', 'https://app.example.com']
})

const server = new Server({
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
- Single SSE connection shared across all streams/channels
- CORS handled automatically by server transport
- Compatible with Bun, Deno, Cloudflare Workers, Node.js
- Client automatically manages connection state
- Server tracks sessions for stateful operations

**Gotchas**:
- SSE connections require keep-alive or will timeout
- Server must handle preflight OPTIONS requests for CORS
- Session cleanup happens on client disconnect

### Pattern: Testing with DirectTransports

**Use case**: Unit testing RPC handlers without network overhead

**Implementation**:

```typescript
import { describe, it, expect } from 'vitest'
import { Client } from '@enkaku/client'
import { Server } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import type { MyProtocol } from './protocol'

describe('RPC handlers', () => {
  it('should greet user', async () => {
    const transports = new DirectTransports<
      ServerMessage,
      ClientMessage
    >()

    const server = new Server({
      protocol: myProtocol,
      transport: transports.server,
      handlers: {
        greet: async ({ param }) => {
          return { message: `Hello, ${param.name}!` }
        }
      }
    })

    const client = new Client({
      protocol: myProtocol,
      transport: transports.client
    })

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
- Zero network latency - perfect for tests
- Same API as remote transports
- Automatic type inference from protocol
- Synchronous message passing under the hood
- Dispose both transports together

**Best practices**:
- Create fresh transports for each test
- Always dispose transports after test
- Use for handler logic tests, not transport tests

### Pattern: IPC with Socket Transport

**Use case**: Microservices communicating on same host, daemon processes

**Implementation**:

```typescript
import { createServer } from 'node:net'
import { Client } from '@enkaku/client'
import { Server } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket-transport'
import type { MyProtocol } from './protocol'

// Server process
const socketPath = '/tmp/my-service.sock'

const netServer = createServer((socket) => {
  const transport = new SocketTransport<ClientMessage, ServerMessage>({
    socket
  })

  const server = new Server({
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

const client = new Client({
  protocol: myProtocol,
  transport: clientTransport
})

// Make requests
const result = await client.request('myProcedure', { param: 'value' })
```

**Key points**:
- Each socket connection creates a new transport
- Socket path can be file path (Unix) or `host:port` (TCP)
- JSONL format allows streaming and framing
- Server creates transport per connection
- Connection cleanup handled by socket events

**Performance considerations**:
- Unix sockets faster than TCP for same-host
- JSONL adds small parsing overhead
- Consider connection pooling for high throughput

### Pattern: Web Worker Communication

**Use case**: Offload heavy computation to background thread

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { Server } from '@enkaku/server'
import { MessageTransport } from '@enkaku/message-transport'
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

const client = new Client({
  protocol: workerProtocol,
  transport
})

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

    const server = new Server({
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
- Supports transferable objects (ArrayBuffer, etc.)
- MessageChannel provides isolated communication
- Port must be transferred in postMessage
- Worker and main thread each hold one port

**Transferable objects**:
```typescript
// Transfer ArrayBuffer ownership to worker
const buffer = new ArrayBuffer(1024)
const result = await client.request('processBuffer', {
  param: { buffer }
})
// buffer is now detached (neutered) in main thread
```

### Pattern: Child Process Communication

**Use case**: CLI tools, background tasks, process isolation

**Implementation**:

```typescript
import { spawn } from 'node:child_process'
import { Client } from '@enkaku/client'
import { Server } from '@enkaku/server'
import { NodeStreamsTransport } from '@enkaku/node-streams-transport'
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

const client = new Client({
  protocol: childProtocol,
  transport: parentTransport
})

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

const server = new Server({
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

All transports extend `Disposer` and emit `TransportEvents`:

```typescript
transport.events.on('writeFailed', ({ error, rid }) => {
  console.error(`Write failed for request ${rid}:`, error)
})
```

This allows clients and servers to handle write failures (network errors, closed connections, etc.).

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
class ClientTransport<Protocol> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  constructor(params: { url: string })
}
```

### HTTP Server Transport

```typescript
class ServerTransport<Protocol> extends Transport<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
> {
  constructor(options?: {
    allowedOrigin?: string | Array<string>
  })

  fetch(request: Request): Promise<Response>
}
```

### Socket Transport

```typescript
class SocketTransport<R, W> extends Transport<R, W> {
  constructor(params: {
    socket: Socket | Promise<Socket> | (() => Socket | Promise<Socket>) | string
    signal?: AbortSignal
  })
}

function connectSocket(path: string): Promise<Socket>
```

### Node Streams Transport

```typescript
class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: {
    streams: { readable: Readable; writable: Writable }
      | Promise<{ readable: Readable; writable: Writable }>
      | (() => { readable: Readable; writable: Writable })
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
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { MyProtocol } from './protocol'

const transport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://myapp.com']
})

const server = new Server({
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
- Serverless functions are stateless (HTTP perfect fit)
- Edge network provides low latency globally
- SSE connections handled by Cloudflare's infrastructure
- No persistent server process needed

### Scenario 2: Real-Time Dashboard with Streaming

**Goal**: Stream live metrics from server to browser dashboard

```typescript
// Server
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'

const transport = new ServerTransport<DashboardProtocol>()

const server = new Server({
  protocol: dashboardProtocol,
  transport,
  handlers: {
    liveMetrics: async function* ({ param }) {
      while (true) {
        const metrics = await collectMetrics()
        yield { metrics }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
})

// Client (browser)
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'

const transport = new ClientTransport<DashboardProtocol>({
  url: '/rpc'
})

const client = new Client({ protocol: dashboardProtocol, transport })

const stream = client.stream('liveMetrics', {
  param: { interval: 1000 }
})

for await (const { metrics } of stream.readable) {
  updateDashboard(metrics)
}
```

**Key aspects**:
- Generator function yields metrics continuously
- HTTP client uses SSE for receiving stream
- Browser receives updates in real-time
- Automatic reconnection if connection drops

### Scenario 3: Multi-Service Architecture

**Goal**: Multiple Node.js services communicating via Unix sockets

```typescript
// Service A (gateway.ts)
import { createServer } from 'node:net'
import { Server } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket-transport'
import { Client } from '@enkaku/client'

// Listen for incoming connections
const server = createServer((socket) => {
  const transport = new SocketTransport<ClientMsg, ServerMsg>({
    socket
  })

  new Server({
    protocol: gatewayProtocol,
    transport,
    handlers: {
      // Gateway handlers
    }
  })
})

server.listen('/tmp/gateway.sock')

// Connect to other services
const authClient = new Client({
  protocol: authProtocol,
  transport: new SocketTransport({
    socket: '/tmp/auth.sock'
  })
})

// Service B (auth.ts)
import { createServer } from 'node:net'
import { Server } from '@enkaku/server'
import { SocketTransport } from '@enkaku/socket-transport'

const server = createServer((socket) => {
  const transport = new SocketTransport<AuthClientMsg, AuthServerMsg>({
    socket
  })

  new Server({
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

**Architecture benefits**:
- Low-latency communication between services
- No network overhead (Unix sockets)
- Process isolation with shared filesystem
- Easy to scale by adding more services

## Troubleshooting

### Issue: SSE Connection Keeps Closing

**Symptoms**: Streams/channels work briefly then disconnect

**Causes**:
- Reverse proxy timeout (nginx, Cloudflare)
- Server not sending keep-alive comments
- Client navigating away or closing tab

**Solutions**:
```typescript
// Server: Send keep-alive comments
setInterval(() => {
  // SSE comments don't trigger events
  response.write(': keepalive\n\n')
}, 30000) // Every 30 seconds

// Reverse proxy: Increase timeout
// nginx.conf
proxy_read_timeout 300s;

// Client: Handle reconnection
transport.events.on('writeFailed', () => {
  // Reconnect logic
})
```

### Issue: CORS Errors with HTTP Transport

**Symptoms**: Browser shows CORS policy error

**Causes**:
- Missing allowedOrigin configuration
- Incorrect origin in allowedOrigin array
- Not handling OPTIONS preflight

**Solutions**:
```typescript
const transport = new ServerTransport<Protocol>({
  allowedOrigin: [
    'https://app.example.com',
    'http://localhost:3000' // Development
  ]
})

// Or allow all origins (not recommended for production)
const transport = new ServerTransport<Protocol>({
  allowedOrigin: '*'
})
```

### Issue: Socket Connection Refused

**Symptoms**: `ECONNREFUSED` or `ENOENT` errors

**Causes**:
- Server not listening yet
- Wrong socket path
- Permissions on socket file
- Stale socket file from previous run

**Solutions**:
```typescript
import { existsSync, unlinkSync } from 'node:fs'

const socketPath = '/tmp/my-service.sock'

// Clean up stale socket
if (existsSync(socketPath)) {
  unlinkSync(socketPath)
}

server.listen(socketPath, () => {
  // Set permissions if needed
  chmodSync(socketPath, 0o666)
  console.log('Listening on', socketPath)
})
```

### Issue: Messages Not Parsing in Node Streams

**Symptoms**: `SyntaxError: Unexpected token` or messages not received

**Causes**:
- Writing directly to stdout instead of using transport
- Missing newlines in JSONL format
- Binary data in stream

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
- Not closing streams after use
- Not disposing transports
- Accumulating event listeners

**Solutions**:
```typescript
// Always dispose transports
const transport = new ClientTransport({ url: '/rpc' })
try {
  await client.stream('data', { param })
} finally {
  await transport.dispose()
}

// Use AbortSignal for cleanup
const controller = new AbortController()
const transport = new DirectTransports({
  signal: controller.signal
})

// Later: abort and cleanup
controller.abort()
await transport.dispose()

// Remove event listeners
const handler = (event) => { /* ... */ }
transport.events.on('writeFailed', handler)
// Later:
transport.events.off('writeFailed', handler)
```

### Issue: Type Errors with Generic Transport Parameters

**Symptoms**: TypeScript errors about message types not matching

**Causes**:
- Incorrect generic parameter order (`<R, W>`)
- Mismatched protocol types
- Using wrong transport for client vs server

**Solutions**:
```typescript
// Remember: R = Read type, W = Write type
// Client reads ServerMessage, writes ClientMessage
const clientTransport = new SomeTransport<ServerMessage, ClientMessage>({
  // ...
})

// Server reads ClientMessage, writes ServerMessage
const serverTransport = new SomeTransport<ClientMessage, ServerMessage>({
  // ...
})

// Or use protocol-aware transports (they handle generics)
const clientTransport = new ClientTransport<MyProtocol>({ url: '/rpc' })
const serverTransport = new ServerTransport<MyProtocol>()
```
