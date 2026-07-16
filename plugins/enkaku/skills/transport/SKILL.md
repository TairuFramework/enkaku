---
name: transport
description: Use when choosing or configuring an Enkaku transport - HTTP, WebSocket, Node streams, MessagePort, or Electron IPC.
---

# Enkaku Transport Layer

## Packages in This Domain

**Core**: `@enkaku/transport`

**Implementations**: `@enkaku/http-fetch`, `@enkaku/http-serve`, `@enkaku/socket`, `@enkaku/node-streams`, `@enkaku/message`, `@enkaku/electron`

## Key Patterns

`Client` takes no `protocol` option -- the protocol is a type parameter. `serve()` takes a
singular `transport`; `new Server()` takes plural `transports`. Either way an access option is
required: `requireAuth: false` or an `identity`.

### Pattern 1: HTTP Request-Response (Client-Server)

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-fetch'
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'
import type { MyProtocol } from './protocol'

// Client side
const transport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})
const client = new Client<MyProtocol>({ transport })

// Server side
const serverTransport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://example.com']
})
const server = serve<MyProtocol>({
  requireAuth: false,
  protocol: myProtocol,
  transport: serverTransport,
  handlers,
})

// Use with Bun/Deno/Node HTTP server
Bun.serve({
  port: 3000,
  fetch: serverTransport.fetch
})
```

**Use case**: Traditional web apps, serverless functions, REST-like RPC

**Key points**:
- HTTP client handles SSE for streams/channels automatically
- Server transport manages CORS (including OPTIONS preflight) and session state
- Any host that speaks `Request` -> `Response` can serve it
- Request-response uses immediate responses, streams use Server-Sent Events
- No persistent connection needed for simple requests
- `allowedOrigin` defaults to none: a request carrying an `Origin` header is rejected `403`
  unless you configure it
- SSE sessions are held in-process, so streams and channels need sticky routing to one instance

### Pattern 2: In-Process Communication (Direct Transport)

```typescript
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import type { MyProtocol } from './protocol'

const transports = new DirectTransports<ToClient, ToServer>()

const client = new Client<MyProtocol>({ transport: transports.client })

const server = serve<MyProtocol>({
  requireAuth: false,
  protocol: myProtocol,
  transport: transports.server,
  handlers,
})

// Perfect for testing or same-process scenarios.
// `@enkaku/standalone` wraps this whole pattern: standalone(handlers, options)
await client.request('myProcedure', { param: 'value' })
```

**Use case**: Testing, monolithic apps, local development

**Key points**:
- Zero network overhead - uses in-memory streams
- Type-safe communication between client/server in same process
- Same API as remote transports - easy to swap
- Ideal for unit testing RPC handlers
- Shared AbortSignal support for coordinated cleanup

### Pattern 3: Socket-Based IPC (Unix/TCP Sockets)

```typescript
import { SocketTransport, connectSocket } from '@enkaku/socket'
import type { MyProtocol } from './protocol'

// Client connecting to Unix socket
const clientTransport = new SocketTransport<
  ServerMessage,
  ClientMessage
>({
  socket: '/tmp/my-app.sock'
})

// Server accepting socket connections -- @enkaku/socket is connect-only,
// so the accept loop is plain node:net
import { createServer } from 'node:net'
import { serve } from '@enkaku/server'

const netServer = createServer(async (socket) => {
  const transport = new SocketTransport<ClientMessage, ServerMessage>({
    socket
  })
  const server = serve<MyProtocol>({
    requireAuth: false,
    protocol: myProtocol,
    transport,
    handlers,
  })
})

netServer.listen('/tmp/my-app.sock')
```

`connectSocket(path, { timeoutMs, signal })` bounds the connect attempt (10s by default; `timeoutMs: 0` disables). `SocketTransport` accepts `connectTimeoutMs` when `socket` is a path string, and connects lazily on first read/write.

`transport.dispose()` flushes pending writes, then **destroys** the socket — including one opened by a function source. Do not also destroy it yourself; a second `destroy()` is a no-op, but the transport already owns the release.

**Use case**: IPC, microservices on same host, daemon processes

**Key points**:
- Uses newline-delimited JSON (JSONL) format
- A `socket` **string is an IPC/Unix path only** -- it goes to node's `createConnection(path)`,
  which never parses `host:port`. For TCP, build the `Socket` yourself and pass the instance
- Connect-only: no server/listen API. Bring your own `node:net` accept loop
- Automatic error propagation from socket to stream
- Each socket connection gets its own transport instance

### Pattern 4: MessagePort (Web Workers, Electron)

```typescript
import { MessageTransport } from '@enkaku/message'
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import type { MyProtocol } from './protocol'

// Main thread
const { port1, port2 } = new MessageChannel()
const worker = new Worker('./worker.js')
worker.postMessage({ port: port2 }, [port2])

const transport = new MessageTransport<ToMain, ToWorker>({ port: port1 })
const client = new Client<MyProtocol>({ transport })

// Worker thread (worker.js)
self.addEventListener('message', (event) => {
  const port = event.data.port
  const transport = new MessageTransport<ToWorker, ToMain>({ port })
  const server = serve<MyProtocol>({
    requireAuth: false,
    protocol: myProtocol,
    transport,
    handlers,
  })
})
```

**Use case**: Web Workers, Service Workers, cross-origin iframes

**Key points**:
- Browser-native MessagePort API
- No JSON serialization -- values go through structured clone
- Does **not** transfer transferables: `postMessage` is called with no transfer list, so an
  `ArrayBuffer` is copied, not detached
- Ideal for offloading work to Web Workers
- For Electron, use `@enkaku/electron` -- the main process exposes `MessagePortMain`, not
  `MessagePort`

### Pattern 5: Node Streams (Process Pipes, Custom Streams)

```typescript
import { NodeStreamsTransport } from '@enkaku/node-streams'
import { spawn } from 'node:child_process'

// Parent process communicating with child
const child = spawn('node', ['child.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
})

const transport = new NodeStreamsTransport<FromChild, ToChild>({
  streams: {
    readable: child.stdout,
    writable: child.stdin
  }
})

const client = new Client<MyProtocol>({ transport })

// Child process (child.js)
const transport = new NodeStreamsTransport<ToChild, FromChild>({
  streams: {
    readable: process.stdin,
    writable: process.stdout
  }
})

const server = serve<MyProtocol>({
  requireAuth: false,
  protocol: myProtocol,
  transport,
  handlers,
})
```

**Use case**: Child processes, stdin/stdout pipes, custom Node streams

**Key points**:
- Works with any `{ readable: Readable; writable: Writable }` pair
- Uses JSON Lines format (newline-delimited JSON)
- Perfect for CLI tools and child process communication
- Never write to stdout directly alongside it -- that corrupts the JSONL frame stream. Use
  stderr for logging

## When to Use What

**Use HTTP transports** when:
- Building traditional web applications
- Deploying to serverless (Vercel, Cloudflare Workers, AWS Lambda)
- Need broad compatibility and standard HTTP infrastructure
- Client is a browser or mobile app
- Stateless request-response is your primary pattern

**Use DirectTransports** when:
- Testing your RPC implementation
- Building a monolithic application
- Client and server in same process
- Need maximum performance (no serialization)

**Use SocketTransport** when:
- Building microservices on the same host
- Need IPC between Node processes without an HTTP stack
- Working with daemon processes or background services
- Unix domain sockets are available (Linux/macOS)

**Use MessageTransport** when:
- Offloading work to Web Workers
- Building browser extensions
- Need cross-origin iframe communication
- Want structured clone rather than JSON serialization

**Use `@enkaku/electron`** when:
- Bridging Electron's main and renderer processes (it wraps `MessagePortMain` and `ipcMain`,
  with a `SenderURLAllowlist` for sender validation)

**Use NodeStreamsTransport** when:
- Communicating with child processes via pipes
- Building CLI tools that compose via stdin/stdout
- Working with custom Node.js stream implementations
- Need stream-based data flow between processes

## Related Domains

- See `/sozai:dataflow` for stream utilities and data flow patterns (moved to `@sozai`)
- See `/kokuin:auth` for securing transport connections with identities (moved to `@kokuin`)
- See `/enkaku:core-rpc` for handling messages after the transport layer

## Detailed Reference

For complete API documentation, transport internals, and advanced patterns: `docs/reference/domains/transport.md`
