# Core RPC - Detailed Reference

## Overview

The Core RPC domain provides the fundamental building blocks for creating type-safe, schema-validated RPC systems in Enkaku. It consists of four packages that work together: `@enkaku/protocol` defines the contract between client and server, `@enkaku/client` makes procedure calls, `@enkaku/server` handles requests, and `@enkaku/standalone` combines both for same-process communication.

The core design philosophy is **protocol-first**: you define a protocol object using JSON Schema, and TypeScript automatically infers all the types for client calls and server handlers. This ensures compile-time type safety while also enabling runtime validation.

## Package Ecosystem

### Core Package: @enkaku/protocol

**Purpose**: Protocol definitions, message schemas, and type utilities for RPC communication.

**Key exports**:
- `ProtocolDefinition` - Type for protocol objects
- `EventProcedureDefinition` - Schema for event procedures
- `RequestProcedureDefinition` - Schema for request procedures
- `StreamProcedureDefinition` - Schema for stream procedures
- `ChannelProcedureDefinition` - Schema for channel procedures
- `createClientMessageSchema()` - Generate validation schema for client messages
- `createServerMessageSchema()` - Generate validation schema for server messages
- Type utilities: `DataOf<T>`, `ReturnOf<T>`, `AnyClientMessageOf<P>`, `AnyServerMessageOf<P>`

**Dependencies**: `@enkaku/token`

**Core concepts**:
- Protocol is a plain object mapping procedure names to definitions
- Four procedure types: event (fire-and-forget), request (param->result), stream (param->receive stream), channel (bidirectional)
- All data shapes defined using JSON Schema
- Protocol types drive inference for client and server implementations

**Example protocol**:
```typescript
const protocol = {
  'user/get': {
    type: 'request',
    param: { type: 'string' }, // userId
    result: {
      type: 'object',
      properties: { name: { type: 'string' }, email: { type: 'string' } }
    }
  },
  'metrics/live': {
    type: 'stream',
    receive: { type: 'number' }
  }
} as const satisfies ProtocolDefinition
```

### Client Package: @enkaku/client

**Purpose**: Type-safe RPC client with support for requests, streams, channels, and events.

**Key exports**:
- `Client<Protocol>` - Main RPC client class
- `RequestCall<Result>` - Return type for requests with abort support
- `StreamCall<Receive, Result>` - Return type for streams
- `ChannelCall<Receive, Send, Result>` - Return type for channels
- `RequestError` - Error class for RPC errors
- Type utilities: `ClientDefinitionsType<P>`, `RequestDefinitionsType<P>`, etc.

**Dependencies**: `@enkaku/async`, `@enkaku/execution`, `@enkaku/stream`, `@enkaku/token`

**How it works**:
- Client reads from transport and routes messages to active procedure calls
- Each request/stream/channel gets a unique request ID (rid)
- Supports abort signals for cancellation
- Handles transport disconnection and errors
- Can sign messages with Identity for authentication

**Key methods**:
- `sendEvent(procedure, data)` - Send fire-and-forget event
- `request(procedure, config)` - Make request-response call
- `createStream(procedure, config)` - Open server->client stream
- `createChannel(procedure, config)` - Open bidirectional channel

**Type inference**:
```typescript
const client = new Client<MyProtocol>({ transport })

// TypeScript knows param type and result type from protocol
const result = await client.request('greet', {
  param: { name: 'Alice' } // Type-checked
})
// result is typed based on protocol definition
```

### Server Package: @enkaku/server

**Purpose**: RPC server that dispatches incoming messages to typed handlers.

**Key exports**:
- `Server<Protocol>` - Main RPC server class
- `serve<Protocol>(params)` - Convenience function for single transport
- Handler types: `RequestHandler`, `StreamHandler`, `ChannelHandler`, `EventHandler`
- Context types: `RequestHandlerContext`, `StreamHandlerContext`, etc.
- `ProcedureHandlers<Protocol>` - Type for handler map
- `ServerEvents` - Event types for server lifecycle

**Dependencies**: `@enkaku/async`, `@enkaku/capability`, `@enkaku/event`, `@enkaku/protocol`, `@enkaku/schema`, `@enkaku/stream`, `@enkaku/token`

**How it works**:
- Server reads from transport and dispatches to handlers
- Validates incoming messages against protocol schema (optional)
- Manages handler lifecycle with abort signals
- Supports access control with signed tokens
- Emits events for errors, invalid messages, etc.

**Handler contexts**:
- Request: `{ param, signal, message }`
- Stream: `{ param, signal, message, writable }`
- Channel: `{ param, signal, message, readable, writable }`
- Event: `{ data, message }`

**Access control**:
- `public: true` - No authentication required
- `public: false` - Requires signed tokens with server ID
- Per-procedure access rules via `access` parameter

### Standalone Package: @enkaku/standalone

**Purpose**: Combines client and server in same process using direct transport.

**Key exports**:
- `standalone<Protocol>(handlers, options)` - Create client with in-process server
- `StandaloneOptions<Protocol>` - Configuration type

**Dependencies**: `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`

**How it works**:
- Creates DirectTransports for in-memory communication
- Starts server with provided handlers
- Returns client connected via direct transport
- Zero network overhead - perfect for testing

**Use cases**:
- Unit testing RPC handlers
- Monolithic applications
- Prototyping before adding network layer
- Local computation tasks

## Common Patterns

### Pattern: Defining Type-Safe Protocols

**Use case**: Create a protocol with strong typing and schema validation

**Implementation**:

```typescript
import type { ProtocolDefinition } from '@enkaku/protocol'

// Define protocol with const assertion
const myProtocol = {
  // Simple request
  'math/add': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b'],
      additionalProperties: false
    },
    result: { type: 'number' }
  },

  // Request with optional param
  'user/list': {
    type: 'request',
    // param is optional if not specified
    result: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  },

  // Stream with param
  'logs/tail': {
    type: 'stream',
    param: {
      type: 'object',
      properties: {
        lines: { type: 'number' },
        filter: { type: 'string' }
      }
    },
    receive: { type: 'string' },
    result: { type: 'null' }
  },

  // Channel for bidirectional communication
  'chat/connect': {
    type: 'channel',
    param: {
      type: 'object',
      properties: { roomId: { type: 'string' } }
    },
    send: { // Client to server
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'number' }
      }
    },
    receive: { // Server to client
      type: 'object',
      properties: {
        userId: { type: 'string' },
        message: { type: 'string' }
      }
    }
  },

  // Event (no response)
  'analytics/track': {
    type: 'event',
    data: {
      type: 'object',
      properties: {
        event: { type: 'string' },
        properties: { type: 'object' }
      }
    }
  },

  // Custom error type
  'user/authenticate': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' }
      }
    },
    result: {
      type: 'object',
      properties: { token: { type: 'string' } }
    },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', enum: ['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED'] },
        message: { type: 'string' }
      },
      required: ['code', 'message'],
      additionalProperties: false
    }
  }
} as const satisfies ProtocolDefinition

// Extract type for use in client/server
type MyProtocol = typeof myProtocol
```

**Key points**:
- `as const` preserves literal types for exact inference
- `satisfies ProtocolDefinition` validates structure without widening types
- JSON Schema `additionalProperties: false` prevents extra fields
- `required` array specifies mandatory fields
- Custom error schemas allow specific error codes per procedure
- Omitting `param` makes it optional in client calls

**Type extraction**:
```typescript
import type { DataOf, ReturnOf } from '@enkaku/protocol'

// Get param type
type AddParam = DataOf<MyProtocol['math/add']['param']>
// { a: number; b: number }

// Get result type
type AddResult = ReturnOf<MyProtocol['math/add']['result']>
// number
```

### Pattern: Client Error Handling

**Use case**: Handle errors from server, transport failures, and timeouts

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { RequestError } from '@enkaku/client'

const transport = new ClientTransport<MyProtocol>({
  url: 'https://api.example.com/rpc'
})

const client = new Client<MyProtocol>({ transport })

// Handle RPC errors
try {
  const result = await client.request('user/authenticate', {
    param: { username: 'alice', password: 'wrong' }
  })
} catch (err) {
  if (err instanceof RequestError) {
    // Server returned an error response
    console.log('Error code:', err.code) // 'INVALID_CREDENTIALS'
    console.log('Error message:', err.message)
    console.log('Error data:', err.data) // Custom error data if provided
  } else {
    // Network error, timeout, or other failure
    console.error('Request failed:', err)
  }
}

// Abort a long-running request
const controller = new AbortController()
const request = client.request('longOperation', {
  signal: controller.signal
})

setTimeout(() => controller.abort(), 5000) // Timeout after 5s

try {
  await request
} catch (err) {
  if (err instanceof AbortSignal) {
    console.log('Request was aborted')
  }
}

// Handle transport errors with reconnection
const clientWithRecovery = new Client<MyProtocol>({
  transport,
  handleTransportError: (error) => {
    console.error('Transport error:', error)
    // Return new transport to reconnect
    return new ClientTransport<MyProtocol>({
      url: 'https://api.example.com/rpc'
    })
  }
})

// Listen to client lifecycle
client.disposed.then(() => {
  console.log('Client has been disposed')
})
```

**Key points**:
- `RequestError` indicates server returned error response
- Other errors (network, serialization) are standard Error objects
- AbortSignal errors indicate cancellation
- `handleTransportError` enables automatic reconnection
- `signal` parameter allows per-request cancellation
- Always dispose client to clean up resources

### Pattern: Server Stream and Channel Handlers

**Use case**: Implement handlers that push data to clients over time

**Implementation**:

```typescript
import { Server } from '@enkaku/server'
import type { StreamHandler, ChannelHandler } from '@enkaku/server'

const server = new Server<MyProtocol>({
  public: true,
  handlers: {
    // Stream: Server pushes data to client
    'metrics/live': async ({ writable, signal }) => {
      const writer = writable.getWriter()

      const interval = setInterval(async () => {
        const metric = await collectMetric()
        try {
          await writer.write(metric)
        } catch (err) {
          clearInterval(interval)
        }
      }, 1000)

      // Cleanup when client disconnects
      signal.addEventListener('abort', () => {
        clearInterval(interval)
        writer.close()
      })

      // Keep streaming until aborted
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve)
      })

      return null
    },

    // Stream: Generate sequence
    'fibonacci': async ({ param, writable }) => {
      const writer = writable.getWriter()
      let a = 0, b = 1

      for (let i = 0; i < param.count; i++) {
        await writer.write(a)
        ;[a, b] = [b, a + b]
      }

      await writer.close()
      return 'Sequence complete'
    },

    // Channel: Bidirectional chat
    'chat/connect': async ({ param, readable, writable, signal }) => {
      const room = chatRooms.get(param.roomId)
      const writer = writable.getWriter()

      // Send messages from room to client
      const unsubscribe = room.subscribe((msg) => {
        writer.write({
          userId: msg.userId,
          message: msg.text
        })
      })

      // Read messages from client and broadcast
      try {
        for await (const msg of readable) {
          room.broadcast({
            userId: 'current-user',
            text: msg.message,
            timestamp: msg.timestamp
          })
        }
      } finally {
        unsubscribe()
        await writer.close()
      }

      return null
    },

    // Channel: Transform stream
    'text/uppercase': async ({ readable, writable }) => {
      const reader = readable.getReader()
      const writer = writable.getWriter()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value.toUpperCase())
        }
      } finally {
        await writer.close()
      }

      return 'Done'
    }
  }
})
```

**Key points**:
- Stream handlers write to `writable` stream
- Channel handlers read from `readable` and write to `writable`
- Always close writer when done or on abort
- Use `signal` to detect client disconnect
- For infinite streams, wait on signal abort promise
- Handle backpressure with `writer.ready` if needed

### Pattern: Server with Schema Validation

**Use case**: Validate incoming messages against protocol schema

**Implementation**:

```typescript
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'

const transport = new ServerTransport<MyProtocol>()

const server = new Server<MyProtocol>({
  protocol: myProtocol, // Enable validation
  transport,
  public: true,
  handlers: {
    'math/add': async ({ param }) => {
      // param is guaranteed to match schema
      return param.a + param.b
    }
  }
})

// Listen for validation errors
server.events.on('invalidMessage', ({ error, message }) => {
  console.error('Invalid message received:', error)
  console.log('Message:', message)
})

// Listen for handler errors
server.events.on('handlerError', ({ error, payload, rid }) => {
  console.error('Handler error:', error)
  console.log('Procedure:', payload.prc)
  console.log('Request ID:', rid)
})
```

**Key points**:
- Providing `protocol` enables JSON Schema validation
- Invalid messages trigger `invalidMessage` event
- Handler errors trigger `handlerError` event
- Validation happens before handlers are called
- Invalid messages are rejected automatically
- Events allow custom logging/monitoring

### Pattern: Using Standalone for Testing

**Use case**: Unit test RPC handlers without network overhead

**Implementation**:

```typescript
import { describe, it, expect } from 'vitest'
import { standalone } from '@enkaku/standalone'
import type { ProtocolDefinition } from '@enkaku/protocol'

const protocol = {
  'user/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    },
    result: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  },
  'events/stream': {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'string' }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

describe('User handlers', () => {
  it('creates user', async () => {
    const client = standalone<Protocol>({
      'user/create': async ({ param }) => {
        // Test handler logic
        const id = await db.createUser(param)
        return { id }
      },
      'events/stream': async () => {} // Stub unused handlers
    })

    const result = await client.request('user/create', {
      param: { name: 'Alice', email: 'alice@example.com' }
    })

    expect(result.id).toBeDefined()
  })

  it('streams events', async () => {
    const client = standalone<Protocol>({
      'user/create': async () => ({ id: '1' }),
      'events/stream': async ({ param, writable }) => {
        const writer = writable.getWriter()
        for (let i = 0; i < param; i++) {
          await writer.write(`Event ${i}`)
        }
        await writer.close()
      }
    })

    const stream = client.createStream('events/stream', { param: 3 })
    const events: Array<string> = []

    for await (const event of stream.readable) {
      events.push(event)
    }

    expect(events).toEqual(['Event 0', 'Event 1', 'Event 2'])
  })
})
```

**Key points**:
- Standalone creates client and server in same process
- Zero network latency - perfect for testing
- Test handler logic without transport complexity
- Same client API as production code
- Can stub unused handlers with no-op functions
- Easy to test error cases and edge conditions

## Package Interactions

### Protocol and Client

The protocol definition drives client type inference:

```typescript
import type { ClientDefinitionsType } from '@enkaku/client'

type Definitions = ClientDefinitionsType<MyProtocol>

// Definitions has structure:
// {
//   Events: { [eventName]: { Data: ... } }
//   Requests: { [requestName]: { Param: ..., Result: ... } }
//   Streams: { [streamName]: { Param: ..., Receive: ..., Result: ... } }
//   Channels: { [channelName]: { Param: ..., Send: ..., Receive: ..., Result: ... } }
// }
```

Client methods use these definitions for type checking:
- `sendEvent<Procedure>` - validates against `Events[Procedure]`
- `request<Procedure>` - validates param and types result
- `createStream<Procedure>` - types readable stream and result
- `createChannel<Procedure>` - types readable, writable, and result

### Protocol and Server

The protocol drives handler type inference:

```typescript
import type { ProcedureHandlers } from '@enkaku/server'

// Handlers must match protocol
const handlers: ProcedureHandlers<MyProtocol> = {
  'math/add': async ({ param }) => {
    // param type inferred from protocol
    return param.a + param.b
    // return type checked against protocol
  }
}
```

Handler contexts are typed based on procedure type:
- Event handlers: `EventHandlerContext<Protocol, Procedure>`
- Request handlers: `RequestHandlerContext<Protocol, Procedure>`
- Stream handlers: `StreamHandlerContext<Protocol, Procedure>`
- Channel handlers: `ChannelHandlerContext<Protocol, Procedure>`

### Client and Transport

Client is generic over transport type:

```typescript
import type { ClientTransportOf } from '@enkaku/protocol'

type MyClientTransport = ClientTransportOf<MyProtocol>
// = TransportType<
//     AnyServerMessageOf<MyProtocol>,
//     AnyClientMessageOf<MyProtocol>
//   >
```

Client reads `ServerMessage` and writes `ClientMessage`:
- Reads: `result`, `receive`, `error` payloads
- Writes: `request`, `stream`, `channel`, `event`, `send`, `abort` payloads

### Server and Transport

Server is generic over transport type:

```typescript
import type { ServerTransportOf } from '@enkaku/protocol'

type MyServerTransport = ServerTransportOf<MyProtocol>
// = TransportType<
//     AnyClientMessageOf<MyProtocol>,
//     AnyServerMessageOf<MyProtocol>
//   >
```

Server reads `ClientMessage` and writes `ServerMessage`:
- Reads: `request`, `stream`, `channel`, `event`, `send`, `abort` payloads
- Writes: `result`, `receive`, `error` payloads

### Standalone Integration

Standalone combines all packages:

```typescript
// Internally creates:
const transports = new DirectTransports<ServerMessage, ClientMessage>()

const server = new Server({
  transport: transports.server,
  handlers
})

const client = new Client({
  transport: transports.client
})

return client
```

## API Quick Reference

### Protocol Definition

```typescript
// Event procedure
{
  type: 'event',
  data?: JSONSchema, // Optional event data
  description?: string
}

// Request procedure
{
  type: 'request',
  param?: JSONSchema, // Optional request parameter
  result?: JSONSchema, // Optional result (defaults to void)
  error?: ErrorSchema, // Optional custom error schema
  description?: string
}

// Stream procedure
{
  type: 'stream',
  param?: JSONSchema,
  receive: JSONSchema, // Required: type of streamed values
  result?: JSONSchema,
  error?: ErrorSchema,
  description?: string
}

// Channel procedure
{
  type: 'channel',
  param?: JSONSchema,
  send: JSONSchema, // Required: client to server type
  receive: JSONSchema, // Required: server to client type
  result?: JSONSchema,
  error?: ErrorSchema,
  description?: string
}
```

### Client Class

```typescript
class Client<Protocol extends ProtocolDefinition> {
  constructor(params: {
    transport: ClientTransportOf<Protocol>
    getRandomID?: () => string
    handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
    handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
    serverID?: string
    identity?: SigningIdentity | Promise<SigningIdentity>
  })

  sendEvent<Procedure>(
    procedure: Procedure,
    data?: Data
  ): Promise<void>

  request<Procedure>(
    procedure: Procedure,
    config?: { id?: string; param?: Param; signal?: AbortSignal }
  ): RequestCall<Result>

  createStream<Procedure>(
    procedure: Procedure,
    config?: { id?: string; param?: Param; signal?: AbortSignal }
  ): StreamCall<Receive, Result>

  createChannel<Procedure>(
    procedure: Procedure,
    config?: { id?: string; param?: Param; signal?: AbortSignal }
  ): ChannelCall<Receive, Send, Result>

  dispose(reason?: unknown): Promise<void>

  get signal(): AbortSignal
  get disposed(): Promise<void>
}
```

### Server Class

```typescript
class Server<Protocol extends ProtocolDefinition> {
  constructor(params: {
    handlers: ProcedureHandlers<Protocol>
    access?: ProcedureAccessRecord
    identity?: SigningIdentity
    protocol?: Protocol
    public?: boolean
    signal?: AbortSignal
    transports?: Array<ServerTransportOf<Protocol>>
  })

  handle(
    transport: ServerTransportOf<Protocol>,
    options?: { public?: boolean; access?: ProcedureAccessRecord }
  ): Promise<void>

  get events(): ServerEmitter

  dispose(): Promise<void>

  get signal(): AbortSignal
  get disposed(): Promise<void>
}
```

### Standalone Function

```typescript
function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options?: {
    access?: ProcedureAccessRecord
    getRandomID?: () => string
    protocol?: Protocol
    signal?: AbortSignal
    identity?: SigningIdentity
  }
): Client<Protocol>
```

## Examples by Scenario

### Scenario 1: Simple API Client/Server

**Goal**: Create a basic API with a few request endpoints

```typescript
// shared/protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'

export const apiProtocol = {
  'users/list': {
    type: 'request',
    result: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  },
  'users/get': {
    type: 'request',
    param: { type: 'string' }, // userId
    result: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  },
  'users/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['name', 'email']
    },
    result: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
} as const satisfies ProtocolDefinition

export type ApiProtocol = typeof apiProtocol

// server.ts
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import { apiProtocol, type ApiProtocol } from './shared/protocol'

const transport = new ServerTransport<ApiProtocol>()

const server = new Server<ApiProtocol>({
  protocol: apiProtocol,
  transport,
  public: true,
  handlers: {
    'users/list': async () => {
      return await db.users.findMany()
    },
    'users/get': async ({ param }) => {
      return await db.users.findById(param)
    },
    'users/create': async ({ param }) => {
      const user = await db.users.create(param)
      return { id: user.id }
    }
  }
})

Bun.serve({
  port: 3000,
  fetch: transport.fetch
})

// client.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import type { ApiProtocol } from './shared/protocol'

const transport = new ClientTransport<ApiProtocol>({
  url: 'http://localhost:3000/rpc'
})

const client = new Client<ApiProtocol>({ transport })

// Use the API
const users = await client.request('users/list')
console.log('All users:', users)

const newUser = await client.request('users/create', {
  param: { name: 'Alice', email: 'alice@example.com' }
})
console.log('Created user:', newUser.id)

const user = await client.request('users/get', { param: newUser.id })
console.log('User details:', user)
```

**Key aspects**:
- Shared protocol definition ensures type safety
- Server handlers are simple async functions
- Client automatically has correct types for all calls
- Schema validation on server (via `protocol` param)

### Scenario 2: Real-Time Data Streaming

**Goal**: Stream live data from server to client

```typescript
// protocol.ts
const streamProtocol = {
  'stock/watch': {
    type: 'stream',
    param: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        interval: { type: 'number' }
      }
    },
    receive: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        price: { type: 'number' },
        timestamp: { type: 'number' }
      }
    }
  },
  'logs/tail': {
    type: 'stream',
    param: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        level: { type: 'string', enum: ['info', 'warn', 'error'] }
      }
    },
    receive: {
      type: 'object',
      properties: {
        timestamp: { type: 'number' },
        level: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
} as const satisfies ProtocolDefinition

type StreamProtocol = typeof streamProtocol

// server.ts
const server = new Server<StreamProtocol>({
  public: true,
  handlers: {
    'stock/watch': async ({ param, writable, signal }) => {
      const writer = writable.getWriter()

      const interval = setInterval(async () => {
        const price = await getStockPrice(param.symbol)
        try {
          await writer.write({
            symbol: param.symbol,
            price,
            timestamp: Date.now()
          })
        } catch (err) {
          clearInterval(interval)
        }
      }, param.interval)

      signal.addEventListener('abort', () => {
        clearInterval(interval)
        writer.close()
      })

      await new Promise((resolve) => signal.addEventListener('abort', resolve))
    },

    'logs/tail': async ({ param, writable, signal }) => {
      const writer = writable.getWriter()

      const unsubscribe = logService.subscribe(param.service, (log) => {
        if (log.level === param.level || param.level === 'info') {
          writer.write({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message
          })
        }
      })

      signal.addEventListener('abort', () => {
        unsubscribe()
        writer.close()
      })

      await new Promise((resolve) => signal.addEventListener('abort', resolve))
    }
  }
})

// client.ts
const stream = client.createStream('stock/watch', {
  param: { symbol: 'AAPL', interval: 1000 }
})

for await (const quote of stream.readable) {
  console.log(`${quote.symbol}: $${quote.price}`)
  updateChart(quote)
}

// Cleanup after 1 minute
setTimeout(() => stream.close(), 60000)
```

**Architecture benefits**:
- Server pushes updates as they happen
- Client uses async iteration for simple consumption
- Automatic cleanup on client disconnect
- Type-safe stream data

### Scenario 3: Bidirectional Chat

**Goal**: Implement a chat system with bidirectional communication

```typescript
// protocol.ts
const chatProtocol = {
  'chat/room': {
    type: 'channel',
    param: {
      type: 'object',
      properties: {
        roomId: { type: 'string' },
        username: { type: 'string' }
      }
    },
    send: { // Client to server
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['message', 'typing', 'read'] },
        content: { type: 'string' }
      }
    },
    receive: { // Server to client
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['message', 'join', 'leave', 'typing'] },
        username: { type: 'string' },
        content: { type: 'string' },
        timestamp: { type: 'number' }
      }
    }
  }
} as const satisfies ProtocolDefinition

type ChatProtocol = typeof chatProtocol

// server.ts
const rooms = new Map<string, Set<WritableStreamDefaultWriter>>()

const server = new Server<ChatProtocol>({
  public: true,
  handlers: {
    'chat/room': async ({ param, readable, writable, signal }) => {
      const writer = writable.getWriter()

      // Get or create room
      if (!rooms.has(param.roomId)) {
        rooms.set(param.roomId, new Set())
      }
      const room = rooms.get(param.roomId)!

      // Add user to room
      room.add(writer)

      // Broadcast join message
      const joinMsg = {
        type: 'join' as const,
        username: param.username,
        content: `${param.username} joined`,
        timestamp: Date.now()
      }
      for (const w of room) {
        if (w !== writer) {
          w.write(joinMsg)
        }
      }

      // Handle incoming messages from client
      try {
        for await (const msg of readable) {
          const broadcast = {
            type: msg.type,
            username: param.username,
            content: msg.content,
            timestamp: Date.now()
          }

          // Send to all users in room
          for (const w of room) {
            if (w !== writer || msg.type !== 'message') {
              w.write(broadcast)
            }
          }
        }
      } finally {
        // Cleanup on disconnect
        room.delete(writer)

        const leaveMsg = {
          type: 'leave' as const,
          username: param.username,
          content: `${param.username} left`,
          timestamp: Date.now()
        }
        for (const w of room) {
          w.write(leaveMsg)
        }

        await writer.close()
      }
    }
  }
})

// client.ts
const channel = client.createChannel('chat/room', {
  param: { roomId: 'general', username: 'Alice' }
})

// Receive messages
for await (const msg of channel.readable) {
  if (msg.type === 'message') {
    displayMessage(msg.username, msg.content)
  } else if (msg.type === 'join') {
    showNotification(msg.content)
  } else if (msg.type === 'typing') {
    showTypingIndicator(msg.username)
  }
}

// Send messages
async function sendMessage(content: string) {
  await channel.send({
    type: 'message',
    content
  })
}

// Send typing indicator
async function sendTyping() {
  await channel.send({
    type: 'typing',
    content: ''
  })
}
```

**Key aspects**:
- Channel enables bidirectional communication
- Server broadcasts to all connected clients
- Client reads and writes simultaneously
- Automatic cleanup on disconnect

## Troubleshooting

### Issue: Type Errors - Param Not Assignable

**Symptoms**: TypeScript error when calling client methods

```
Argument of type '{ name: string }' is not assignable to parameter of type '{ param: { name: string, email: string } }'
```

**Causes**:
- Missing required fields in param
- Protocol definition doesn't match usage
- Incorrect type assertion in protocol

**Solutions**:
```typescript
// Check protocol definition
const protocol = {
  'user/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['name', 'email'] // Both required
    }
  }
} as const satisfies ProtocolDefinition

// Provide all required fields
await client.request('user/create', {
  param: {
    name: 'Alice',
    email: 'alice@example.com' // Don't forget this!
  }
})

// Or make fields optional in protocol
const protocol = {
  'user/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['name'] // Only name required
    }
  }
}
```

### Issue: Handler Never Called

**Symptoms**: Client request hangs, server handler doesn't execute

**Causes**:
- Handler not registered for procedure
- Procedure name mismatch (typo)
- Server not handling transport
- Transport not connected

**Solutions**:
```typescript
// Ensure handler exists for all procedures
const server = new Server<MyProtocol>({
  handlers: {
    'user/get': async ({ param }) => {
      // Handler implementation
    }
    // Missing 'user/create' handler!
  }
})

// TypeScript will error - add all handlers
const server = new Server<MyProtocol>({
  handlers: {
    'user/get': async ({ param }) => { ... },
    'user/create': async ({ param }) => { ... }
  }
})

// Check procedure names match exactly
await client.request('user/get', ...) // Correct
await client.request('getUser', ...) // Wrong - no such procedure

// Ensure server is handling transport
const server = new Server({ ... })
server.handle(transport) // Don't forget this!

// Or use serve() convenience function
const server = serve({
  transport,
  handlers: { ... }
})
```

### Issue: Stream Not Receiving Data

**Symptoms**: Stream created but no data arrives

**Causes**:
- Handler not writing to writable stream
- Writer not flushed or closed
- Handler exiting too early
- Client not reading from readable

**Solutions**:
```typescript
// Server: Ensure writing to writable
const server = new Server<MyProtocol>({
  handlers: {
    'data/stream': async ({ writable }) => {
      const writer = writable.getWriter()

      // MUST write data
      await writer.write({ value: 1 })
      await writer.write({ value: 2 })

      // MUST close when done
      await writer.close()

      return 'Done'
    }
  }
})

// Client: Must consume readable
const stream = client.createStream('data/stream')

// Option 1: Async iteration
for await (const data of stream.readable) {
  console.log(data)
}

// Option 2: Pipe to writable
await stream.readable.pipeTo(someWritable)

// Option 3: Get reader
const reader = stream.readable.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(value)
}
```

### Issue: Request Timeout or Hang

**Symptoms**: Client request never resolves

**Causes**:
- Handler not returning or throwing
- Handler awaiting aborted signal
- Network connection lost
- Server crashed

**Solutions**:
```typescript
// Ensure handler returns
const server = new Server<MyProtocol>({
  handlers: {
    'compute': async ({ param }) => {
      const result = await heavyComputation(param)
      return result // MUST return!
    }
  }
})

// Add timeout to client calls
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10000)

try {
  const result = await client.request('compute', {
    param: data,
    signal: controller.signal
  })
} finally {
  clearTimeout(timeout)
}

// Handle transport errors
const client = new Client({
  transport,
  handleTransportError: (error) => {
    console.error('Transport error:', error)
    // Return new transport or abort
  }
})

// Check server errors
server.events.on('handlerError', ({ error, payload }) => {
  console.error('Handler error:', error)
  console.log('Procedure:', payload.prc)
})
```

### Issue: Memory Leak with Streams

**Symptoms**: Memory usage grows over time

**Causes**:
- Not closing streams after use
- Not disposing client/server
- Accumulating abandoned streams
- Event listeners not removed

**Solutions**:
```typescript
// Always close streams when done
const stream = client.createStream('data/stream')
try {
  for await (const data of stream.readable) {
    processData(data)
  }
} finally {
  stream.close() // Clean up
}

// Or use abort signal
const controller = new AbortController()
const stream = client.createStream('data/stream', {
  signal: controller.signal
})

// Later: abort to cleanup
controller.abort()

// Dispose client when done
await client.dispose()

// Dispose server on shutdown
process.on('SIGTERM', async () => {
  await server.dispose()
  process.exit(0)
})

// Server: Clean up on abort
const server = new Server({
  handlers: {
    'data/stream': async ({ writable, signal }) => {
      const writer = writable.getWriter()
      const interval = setInterval(() => {
        writer.write(getData())
      }, 1000)

      // IMPORTANT: Cleanup on abort
      signal.addEventListener('abort', () => {
        clearInterval(interval)
        writer.close()
      })

      await new Promise(r => signal.addEventListener('abort', r))
    }
  }
})
```

### Issue: Protocol Changes Break Clients

**Symptoms**: Runtime errors after protocol update

**Causes**:
- Client using old protocol definition
- Server using new protocol definition
- Breaking changes to param/result schemas
- Removed or renamed procedures

**Solutions**:
```typescript
// Versioned protocols
const protocolV1 = {
  'user/get': {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'object', properties: { name: { type: 'string' } } }
  }
} as const satisfies ProtocolDefinition

const protocolV2 = {
  'user/get': {
    type: 'request',
    param: { type: 'string' },
    result: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' } // Added field
      }
    }
  }
} as const satisfies ProtocolDefinition

// Server supports both versions
const serverV1 = new Server<typeof protocolV1>({
  handlers: {
    'user/get': async ({ param }) => {
      const user = await db.getUser(param)
      return { name: user.name }
    }
  }
})

const serverV2 = new Server<typeof protocolV2>({
  handlers: {
    'user/get': async ({ param }) => {
      const user = await db.getUser(param)
      return { name: user.name, email: user.email }
    }
  }
})

// Deploy both, route by version header
// Or: Use additive changes only (new optional fields, new procedures)
// Or: Deprecation warnings before removal
```
