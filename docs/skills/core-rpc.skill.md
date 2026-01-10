---
name: enkaku:core-rpc
description: Core RPC patterns - protocol definitions, client/server setup, and type-safe calls
---

# Enkaku Core RPC

## Packages in This Domain

**Protocol**: `@enkaku/protocol`

**Client**: `@enkaku/client`

**Server**: `@enkaku/server`

**Standalone**: `@enkaku/standalone`

## Key Patterns

### Pattern 1: Defining a Protocol

```typescript
import type { ProtocolDefinition } from '@enkaku/protocol'

const myProtocol = {
  'user/greet': {
    type: 'request',
    param: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
      additionalProperties: false
    }
  },
  'data/stream': {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' },
    result: { type: 'string' }
  },
  'chat/channel': {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'null' }
  },
  'user/logout': {
    type: 'event',
    data: {
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: ['userId']
    }
  }
} as const satisfies ProtocolDefinition

type MyProtocol = typeof myProtocol
```

**Use case**: Define the contract between client and server using JSON Schema

**Key points**:
- Protocol is defined as a plain object with procedure definitions
- Four procedure types: `request`, `stream`, `channel`, `event`
- Each procedure uses JSON Schema to describe data shapes
- `as const satisfies ProtocolDefinition` ensures type safety
- Protocol drives TypeScript inference for client and server
- Requests have `param` and `result`, streams add `receive`, channels add `send`

### Pattern 2: Creating and Using a Client

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'

const myProtocol = {
  greet: {
    type: 'request',
    param: { type: 'object', properties: { name: { type: 'string' } } },
    result: { type: 'string' }
  },
  numbers: {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' }
  }
} as const satisfies ProtocolDefinition

type MyProtocol = typeof myProtocol

const transport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})

const client = new Client<MyProtocol>({ transport })

// Type-safe request
const result = await client.request('greet', {
  param: { name: 'Alice' }
})
console.log(result) // Typed as string

// Type-safe stream
const stream = client.createStream('numbers', { param: 10 })
for await (const num of stream.readable) {
  console.log(num) // Typed as number
}
await stream // Wait for completion

// Cleanup
await client.dispose()
```

**Use case**: Make type-safe RPC calls from client applications

**Key points**:
- Client is generic over protocol type
- TypeScript infers param and result types from protocol
- Request returns `Promise<Result>` with abort support
- Streams return `StreamCall` with readable stream and result promise
- Client handles message routing and error handling automatically
- Always dispose client to clean up resources

### Pattern 3: Creating a Server with Handlers

```typescript
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'

const myProtocol = {
  greet: {
    type: 'request',
    param: { type: 'object', properties: { name: { type: 'string' } } },
    result: { type: 'string' }
  },
  countdown: {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' },
    result: { type: 'string' }
  }
} as const satisfies ProtocolDefinition

type MyProtocol = typeof myProtocol

const transport = new ServerTransport<MyProtocol>({
  allowedOrigin: ['https://example.com']
})

const server = new Server<MyProtocol>({
  protocol: myProtocol,
  transport,
  public: true,
  handlers: {
    greet: async ({ param }) => {
      return `Hello, ${param.name}!`
    },
    countdown: async ({ param, writable }) => {
      const writer = writable.getWriter()
      for (let i = param; i >= 0; i--) {
        await writer.write(i)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      await writer.close()
      return 'Done!'
    }
  }
})

// For Bun/Deno/Cloudflare Workers
Bun.serve({
  port: 3000,
  fetch: transport.fetch
})
```

**Use case**: Implement RPC handlers on the server side

**Key points**:
- Handlers are type-checked against protocol definitions
- Request handlers receive `{ param, signal, message }` context
- Stream handlers add `writable` stream for sending data to client
- Handlers return the result value or throw errors
- Server validates messages against protocol schema when provided
- `public: true` disables authentication (use for public APIs)

### Pattern 4: Standalone Client/Server (Same Process)

```typescript
import { standalone } from '@enkaku/standalone'
import type { ProtocolDefinition } from '@enkaku/protocol'

const myProtocol = {
  add: {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      }
    },
    result: { type: 'number' }
  },
  fibonacci: {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' }
  }
} as const satisfies ProtocolDefinition

type MyProtocol = typeof myProtocol

const client = standalone<MyProtocol>({
  add: async ({ param }) => {
    return param.a + param.b
  },
  fibonacci: async ({ param, writable }) => {
    const writer = writable.getWriter()
    let a = 0, b = 1
    for (let i = 0; i < param; i++) {
      await writer.write(a)
      ;[a, b] = [b, a + b]
    }
    await writer.close()
  }
})

// Use like regular client
const sum = await client.request('add', { param: { a: 5, b: 3 } })
console.log(sum) // 8

const fib = client.createStream('fibonacci', { param: 10 })
for await (const num of fib.readable) {
  console.log(num) // 0, 1, 1, 2, 3, 5, 8, 13, 21, 34
}
```

**Use case**: Testing, monolithic apps, local computation without network

**Key points**:
- Creates client and server in same process with direct transport
- Perfect for unit testing handlers without network overhead
- Same API as remote client - easy to swap implementations
- Zero serialization cost - uses in-memory streams
- Automatically creates DirectTransports internally
- Ideal for testing business logic before adding transport layer

### Pattern 5: Handling Different Procedure Types

```typescript
import { Server } from '@enkaku/server'
import type { ProtocolDefinition } from '@enkaku/protocol'

const protocol = {
  // Event: Fire-and-forget, no response
  'user/logout': {
    type: 'event',
    data: { type: 'object', properties: { userId: { type: 'string' } } }
  },
  // Request: Single param -> single result
  'user/profile': {
    type: 'request',
    param: { type: 'string' }, // userId
    result: { type: 'object', properties: { name: { type: 'string' } } }
  },
  // Stream: Param -> stream of values from server
  'logs/tail': {
    type: 'stream',
    param: { type: 'number' }, // lines
    receive: { type: 'string' },
    result: { type: 'null' }
  },
  // Channel: Bidirectional streaming
  'chat/room': {
    type: 'channel',
    param: { type: 'string' }, // roomId
    send: { type: 'string' }, // Client -> Server
    receive: { type: 'string' }, // Server -> Client
    result: { type: 'null' }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

const server = new Server<Protocol>({
  public: true,
  handlers: {
    'user/logout': ({ data }) => {
      console.log('User logged out:', data.userId)
      // No return value for events
    },
    'user/profile': async ({ param }) => {
      const user = await db.getUser(param)
      return { name: user.name }
    },
    'logs/tail': async ({ param, writable }) => {
      const writer = writable.getWriter()
      const lines = await getLogs(param)
      for (const line of lines) {
        await writer.write(line)
      }
      await writer.close()
      return null
    },
    'chat/room': async ({ param, readable, writable, signal }) => {
      const room = joinRoom(param)
      const writer = writable.getWriter()

      // Send messages from room to client
      room.onMessage((msg) => writer.write(msg))

      // Read messages from client
      for await (const msg of readable) {
        room.broadcast(msg)
      }

      // Cleanup on abort
      signal.addEventListener('abort', () => room.leave())
      return null
    }
  }
})
```

**Use case**: Understanding the four procedure types and their use cases

**Key points**:
- Events: One-way notifications, no acknowledgment needed
- Requests: Traditional RPC - send param, get result
- Streams: Server pushes multiple values to client over time
- Channels: Bidirectional - both sides can send/receive
- Stream/channel handlers must write to `writable` stream
- Channel handlers read from `readable` stream for client messages
- Use `signal` to detect when client aborts or disconnects

## When to Use What

**Use Protocol** when:
- Starting any new Enkaku RPC project
- Defining the contract between client and server
- Need type safety across client/server boundary
- Want schema validation of messages

**Use Client** when:
- Building the client side of an RPC system
- Need to call remote procedures from browser/Node.js
- Want type-safe procedure calls with IntelliSense
- Working with any transport (HTTP, sockets, workers)

**Use Server** when:
- Implementing RPC handlers on the backend
- Need to handle multiple transports simultaneously
- Want schema validation and access control
- Building production RPC services

**Use Standalone** when:
- Writing unit tests for RPC handlers
- Building monolithic apps (no network needed)
- Prototyping RPC logic before adding transport
- Need same-process client/server communication

## Related Domains

- See `/enkaku:transport` for HTTP, socket, and other transport implementations
- See `/enkaku:streaming` for advanced stream manipulation patterns
- See `/enkaku:auth` for token signing and access control

## Detailed Reference

For complete API documentation, advanced patterns, and troubleshooting: `docs/capabilities/domains/core-rpc.md`
