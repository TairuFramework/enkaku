---
name: enkaku:transport
description: Transport layer patterns, packages, and usage examples
---

# Enkaku Transport Layer

## Packages in This Domain

**Core**: `@enkaku/transport`

**Implementations**: `@enkaku/http-client-transport`, `@enkaku/http-server-transport`, `@enkaku/socket-transport`, `@enkaku/node-streams-transport`, `@enkaku/message-transport`

## Key Patterns

### Pattern 1: HTTP Request-Response (Client-Server)

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { MyProtocol } from './protocol'

// Client side
const transport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})
const client = new Client({ protocol: myProtocol, transport })

// Server side
const serverTransport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://example.com']
})
const server = new Server({ protocol: myProtocol, transport: serverTransport })

// Use with Bun/Deno/Node HTTP server
Bun.serve({
  port: 3000,
  fetch: serverTransport.fetch
})
```

**Use case**: Traditional web apps, serverless functions, REST-like RPC

**Key points**:
- HTTP client handles SSE for streams/channels automatically
- Server bridge manages CORS and session state
- Compatible with standard HTTP servers (Bun, Deno, Node)
- Request-response uses immediate responses, streams use Server-Sent Events
- No persistent connection needed for simple requests

### Pattern 2: In-Process Communication (Direct Transport)

```typescript
import { Client } from '@enkaku/client'
import { Server } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import type { MyProtocol } from './protocol'

const transports = new DirectTransports<ToClient, ToServer>()

const client = new Client({
  protocol: myProtocol,
  transport: transports.client
})

const server = new Server({
  protocol: myProtocol,
  transport: transports.server
})

// Perfect for testing or same-process scenarios
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
import { SocketTransport, connectSocket } from '@enkaku/socket-transport'
import type { MyProtocol } from './protocol'

// Client connecting to Unix socket
const clientTransport = new SocketTransport<
  ServerMessage,
  ClientMessage
>({
  socket: '/tmp/my-app.sock'
})

// Server accepting socket connections
import { createServer } from 'node:net'
import { Server } from '@enkaku/server'

const netServer = createServer(async (socket) => {
  const transport = new SocketTransport<ClientMessage, ServerMessage>({
    socket
  })
  const server = new Server({ protocol: myProtocol, transport })
  // Server will handle messages from this socket
})

netServer.listen('/tmp/my-app.sock')
```

**Use case**: IPC, microservices on same host, daemon processes

**Key points**:
- Uses newline-delimited JSON (JSONL) format
- Works with Unix domain sockets or TCP sockets
- Lower latency than HTTP for local communication
- Automatic connection management and error handling
- Each socket connection gets its own transport instance

### Pattern 4: MessagePort (Web Workers, Electron)

```typescript
import { MessageTransport } from '@enkaku/message-transport'
import { Client } from '@enkaku/client'
import type { MyProtocol } from './protocol'

// Main thread
const { port1, port2 } = new MessageChannel()
const worker = new Worker('./worker.js')
worker.postMessage({ port: port2 }, [port2])

const transport = new MessageTransport<ToMain, ToWorker>({ port: port1 })
const client = new Client({ protocol: myProtocol, transport })

// Worker thread (worker.js)
self.addEventListener('message', (event) => {
  const port = event.data.port
  const transport = new MessageTransport<ToWorker, ToMain>({ port })
  const server = new Server({ protocol: myProtocol, transport })
})
```

**Use case**: Web Workers, Service Workers, Electron IPC, cross-origin iframes

**Key points**:
- Browser-native MessagePort API
- Zero serialization overhead (structured clone)
- Works in all modern browsers
- Ideal for offloading work to Web Workers
- Supports transferable objects

### Pattern 5: Node Streams (Process Pipes, Custom Streams)

```typescript
import { NodeStreamsTransport } from '@enkaku/node-streams-transport'
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

const client = new Client({ protocol: myProtocol, transport })

// Child process (child.js)
const transport = new NodeStreamsTransport<ToChild, FromChild>({
  streams: {
    readable: process.stdin,
    writable: process.stdout
  }
})

const server = new Server({ protocol: myProtocol, transport })
```

**Use case**: Child processes, stdin/stdout pipes, custom Node streams

**Key points**:
- Works with any Node.js Readable/Writable streams
- Uses JSON Lines format (newline-delimited JSON)
- Perfect for CLI tools and child process communication
- Automatic backpressure handling
- Compatible with process.stdin/stdout

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
- Need low-latency IPC between Node processes
- Working with daemon processes or background services
- Unix domain sockets are available (Linux/macOS)

**Use MessageTransport** when:
- Offloading work to Web Workers
- Building browser extensions or Electron apps
- Need cross-origin iframe communication
- Want zero-copy structured clone transfer

**Use NodeStreamsTransport** when:
- Communicating with child processes via pipes
- Building CLI tools that compose via stdin/stdout
- Working with custom Node.js stream implementations
- Need stream-based data flow between processes

## Related Domains

- See `/enkaku:streaming` for stream utilities and data flow patterns
- See `/enkaku:auth` for securing transport connections
- See `/enkaku:execution` for handling messages after transport layer

## Detailed Reference

For complete API documentation, transport internals, and advanced patterns: `docs/capabilities/domains/transport.md`
