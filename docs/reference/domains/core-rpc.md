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

**Dependencies**: `@kokuin/token`

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

**Dependencies**: `@enkaku/otel`, `@kokuin/token`, `@sozai/async`, `@sozai/event`, `@sozai/execution`, `@sozai/log`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream`

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

**Dependencies**: `@enkaku/otel`, `@enkaku/protocol`, `@kokuin/capability`, `@kokuin/token`, `@sozai/async`, `@sozai/event`, `@sozai/log`, `@sozai/otel`, `@sozai/runtime`, `@sozai/schema`, `@sozai/stream`

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

**Access control** (`ServerAccessOptions`, a **required** union -- the constructor throws if
neither branch is satisfied):
- `{ requireAuth: false }` - Public access, no authentication. Must be passed explicitly; a
  server without `identity` that omits it throws at construction
- `{ identity }` - Authenticated server. Identities come from `@kokuin/token`
- `{ identity, accessRules }` - Granular per-procedure access control. `AccessRules` is
  `Record<string, AccessRule>`, keyed by procedure-name pattern
- `AccessRule` is `{ allow: true | Array<string> | AllowPredicate; encryption?: EncryptionPolicy }`
  -- note `allow: true`, not `boolean`, plus a predicate form `(ctx: AllowContext) => boolean |
  Promise<boolean>`
- `encryptionPolicy?: 'required' | 'optional' | 'none'` - Global encryption policy, overridable
  per-procedure via a rule's `encryption`

### Standalone Package: @enkaku/standalone

**Purpose**: Combines client and server in same process using direct transport.

**Key exports**:
- `standalone<Protocol>(handlers, options)` - Create client with in-process server
- `StandaloneOptions<Protocol>` - Configuration type

**Dependencies**: `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`, `@sozai/runtime`

**How it works**:
- Creates a `DirectTransports` pair for in-memory communication
- Starts a server with the provided handlers via `serve()`
- Returns a client connected to the other end of the pair
- No network hop

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
import { ClientTransport } from '@enkaku/http-fetch'
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

setTimeout(() => controller.abort('Timed out'), 5000) // Timeout after 5s

try {
  await request
} catch (err) {
  // The rejection value is the signal's abort *reason*, not an AbortSignal.
  // `err instanceof AbortSignal` is always false -- AbortSignal is not an error class.
  if (err === controller.signal.reason) {
    console.log('Request was aborted:', err)
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
- Cancellation surfaces as the signal's abort *reason*, not as an `AbortSignal` instance
- `handleTransportError` enables reconnection: return a replacement transport to adopt it,
  return nothing to abort the client. Its sibling `handleTransportDisposed` does the same when
  the transport is disposed rather than erroring
- `signal` parameter allows per-request cancellation
- Dispose the client to release its transport and abort in-flight calls

### Pattern: Server Stream and Channel Handlers

**Use case**: Implement handlers that push data to clients over time

**Implementation**:

`ProcedureHandlers<Protocol>` is a non-partial mapped type: the handler map must contain an
entry for **every** procedure in the protocol. The example below assumes a `StreamProtocol`
declaring exactly these four.

```typescript
import { serve } from '@enkaku/server'
import type { StreamHandler, ChannelHandler } from '@enkaku/server'

const server = serve<StreamProtocol>({
  requireAuth: false,
  transport,
  handlers: {
    // Stream: Server pushes data to client
    'metrics/live': async ({ writable, signal }) => {
      const writer = writable.getWriter()

      const interval = setInterval(async () => {
        const metric = await collectMetric()
        await writer.write(metric)
      }, 1000)

      signal.addEventListener('abort', () => {
        clearInterval(interval)
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
- Stream handlers write to `writable` stream -- they are not generators
- Channel handlers read from `readable` and write to `writable`
- Closing the writer is optional: once the handler settles, the server drains and closes the
  receive pipe itself. Close explicitly when you want the client's readable to end before the
  handler returns
- Writes after abort are dropped by the server rather than throwing, so a `try/catch` around
  `writer.write` will not detect a disconnect -- use `signal`
- Use `signal` to detect client disconnect
- For infinite streams, wait on signal abort promise
- The handler's return value is the call's *result*, distinct from the data written to
  `writable`

### Pattern: Server with Schema Validation

**Use case**: Validate incoming messages against protocol schema

**Implementation**:

```typescript
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'

const transport = new ServerTransport<MyProtocol>()

const server = serve<MyProtocol>({
  protocol: myProtocol, // Enable validation
  transport,
  requireAuth: false,
  handlers: {
    'math/add': async ({ param }) => {
      // param is guaranteed to match schema
      return param.a + param.b
    }
    // ...plus an entry for every other procedure in MyProtocol
  }
})

// Listen for validation errors
server.events.on('invalidMessage', ({ error, message }) => {
  console.error('Invalid message received:', error)
  console.log('Message:', message)
})

// Listen for handler errors
server.events.on('handlerError', ({ error, payload, category, messageType }) => {
  console.error('Handler error:', error)
  console.log('Procedure:', payload.prc)
  console.log('Category:', category, 'Message type:', messageType)
})
```

**Key points**:
- Providing `protocol` enables JSON Schema validation. Without it the server logs that
  validation is disabled and dispatches unvalidated
- Invalid messages trigger `invalidMessage` event and are rejected before any handler runs
- Handler errors trigger `handlerError` event. Its payload is `{ error, payload, category,
  messageType }` -- there is no `rid` on this event; `rid` appears on `handlerStart`,
  `handlerEnd`, `handlerAbort`, and `handlerTimeout`
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

`Client` is generic over `Protocol`, not over the transport. The transport type is derived from
the protocol, and arrives as the required `transport` constructor field:

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

`Server` is likewise generic over `Protocol` only. Transports arrive as
`transports?: Array<ServerTransportOf<Protocol>>`:

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

Standalone builds on `@enkaku/client`, `@enkaku/server`, and `@enkaku/transport`:

```typescript
// Internally, roughly:
const transports = new DirectTransports<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
>({ signal })

serve<Protocol>({
  handlers,
  protocol,
  runtime,
  signal,
  transport: transports.server,
  requireAuth: false, // or `identity` (+ optional `accessRules`) when one is supplied
})

const client = new Client<Protocol>({
  runtime,
  serverID,
  identity,
  transport: transports.client,
})

return client
```

## API Quick Reference

### Protocol Definition

Schemas below are `Schema` values from `@sozai/schema` -- there is no exported `JSONSchema`
type. `error` is an `ErrorObjectDefinition`, which constrains the shape: `required` must be
`['code', 'message']` or `['code', 'message', 'data']`, and `additionalProperties` must be
`false`.

```typescript
// Event procedure
{
  type: 'event',
  data?: Schema, // Optional event data; must be an object-type schema
  description?: string
}

// Request procedure
{
  type: 'request',
  param?: Schema, // Optional request parameter
  result?: Schema, // Optional result (defaults to void)
  error?: ErrorObjectDefinition, // Optional custom error schema
  description?: string
}

// Stream procedure
{
  type: 'stream',
  param?: Schema,
  receive: Schema, // Required: type of streamed values
  result?: Schema,
  error?: ErrorObjectDefinition,
  description?: string
}

// Channel procedure
{
  type: 'channel',
  param?: Schema,
  send: Schema, // Required: client to server type
  receive: Schema, // Required: server to client type
  result?: Schema,
  error?: ErrorObjectDefinition,
  description?: string
}
```

### Client Class

The call methods take a conditional tuple: when a procedure declares no `param`/`data`, the
config argument is optional; when it declares one, the config **and** its `param`/`data` field
are required. `Identity` comes from `@kokuin/token`.

```typescript
class Client<
  Protocol extends ProtocolDefinition,
  ClientDefinitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
> extends Disposer {
  constructor(params: ClientParams<Protocol>)
  // ClientParams<Protocol> = {
  //   transport: ClientTransportOf<Protocol>   // the only required field
  //   runtime?: Runtime
  //   handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  //   handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  //   logger?: Logger
  //   tracer?: Tracer
  //   serverID?: string
  //   identity?: Identity | Promise<Identity>
  //   now?: () => number
  // }

  // `AnyHeader` is `Record<string, unknown>`. It is not re-exported from
  // `@enkaku/client`, so import it by that structural type rather than by name.
  sendEvent<Procedure>(
    procedure: Procedure,
    // required when the procedure declares `data`
    config?: { data?: Data; header?: AnyHeader },
  ): Promise<void>

  request<Procedure>(
    procedure: Procedure,
    // required when the procedure declares `param`
    config?: { header?: AnyHeader; id?: string; param?: Param; signal?: AbortSignal },
  ): RequestCall<Result> & Promise<Result>

  createStream<Procedure>(
    procedure: Procedure,
    config?: { header?: AnyHeader; id?: string; param?: Param; signal?: AbortSignal },
  ): StreamCall<Receive, Result>

  createChannel<Procedure>(
    procedure: Procedure,
    config?: { header?: AnyHeader; id?: string; param?: Param; signal?: AbortSignal },
  ): ChannelCall<Receive, Send, Result>

  get events(): ClientEmitter

  dispose(reason?: unknown): Promise<void>

  get signal(): AbortSignal
  get disposed(): Promise<void>
}
```

### Server Class

```typescript
class Server<Protocol extends ProtocolDefinition> extends Disposer {
  constructor(params: ServerParams<Protocol>)
  // ServerParams<Protocol> = ServerBaseParams<Protocol> & ServerAccessOptions
  //
  // ServerBaseParams<Protocol> = {
  //   handlers: ProcedureHandlers<Protocol>   // required; non-partial over every procedure
  //   cache?: DIDCache
  //   encryptionPolicy?: EncryptionPolicy     // 'required' | 'optional' | 'none'
  //   limits?: Partial<ResourceLimits>
  //   logger?: Logger
  //   protocol?: Protocol                     // enables message validation
  //   replay?: ReplayOptions
  //   resolver?: DIDResolver
  //   runtime?: Runtime
  //   signal?: AbortSignal
  //   tracer?: Tracer
  //   transports?: Array<ServerTransportOf<Protocol>>
  //   verifyToken?: VerifyTokenHook
  // }
  //
  // ServerAccessOptions =                      // required -- pick a branch
  //   | { identity?: undefined; requireAuth: false; accessRules?: never }
  //   | { identity: Identity; accessRules?: AccessRules }

  handle(
    transport: ServerTransportOf<Protocol>,
    options?: {
      accessRules?: false | AccessRules
      logger?: Logger
      verifyToken?: VerifyTokenHook
    },
  ): Promise<void>

  get events(): ServerEmitter
  get activeTransportsCount(): number

  dispose(reason?: unknown): Promise<void>

  get signal(): AbortSignal
  get disposed(): Promise<void>
}

// Convenience wrapper for the single-transport case
function serve<Protocol extends ProtocolDefinition>(
  params: Omit<ServerBaseParams<Protocol>, 'transports'>
    & { transport: ServerTransportOf<Protocol> }
    & ServerAccessOptions,
): Server<Protocol>
```

### Standalone Function

```typescript
function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = { requireAuth: false },
): Client<Protocol>

// StandaloneOptions<Protocol> = {
//   runtime?: Runtime        // shared by the client and the server
//   protocol?: Protocol
//   signal?: AbortSignal
// } & ServerAccessOptions    // so: `requireAuth: false`, or `{ identity, accessRules? }`
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
import { serve } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-serve'
import { apiProtocol, type ApiProtocol } from './shared/protocol'

const transport = new ServerTransport<ApiProtocol>()

const server = serve<ApiProtocol>({
  protocol: apiProtocol,
  transport,
  requireAuth: false,
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
import { ClientTransport } from '@enkaku/http-fetch'
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
const server = serve<StreamProtocol>({
  requireAuth: false,
  transport,
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

const server = serve<ChatProtocol>({
  requireAuth: false,
  transport,
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
  requireAuth: false,
  handlers: {
    'user/get': async ({ param }) => {
      // Handler implementation
    }
    // Missing 'user/create' handler!
  }
})

// TypeScript will error - add all handlers
const server = new Server<MyProtocol>({
  requireAuth: false,
  handlers: {
    'user/get': async ({ param }) => { ... },
    'user/create': async ({ param }) => { ... }
  }
})

// Check procedure names match exactly
await client.request('user/get', ...) // Correct
await client.request('getUser', ...) // Wrong - no such procedure

// A Server built without transports handles nothing until you attach one
const server = new Server<MyProtocol>({ requireAuth: false, handlers: { ... } })
server.handle(transport) // Don't forget this!

// Or pass them up front
const server = new Server<MyProtocol>({
  requireAuth: false,
  handlers: { ... },
  transports: [transport],
})

// Or use the serve() convenience function for the single-transport case
const server = serve<MyProtocol>({
  requireAuth: false,
  transport,
  handlers: { ... },
})
```

An unhandled procedure does not produce an error reply: the server emits `handlerError` and
sends nothing, so the client call simply never settles. That is the hang.

### Issue: Stream Not Receiving Data

**Symptoms**: Stream created but no data arrives

**Causes**:
- Handler not writing to writable stream
- Handler exiting too early -- the server drains and closes the receive pipe once the handler
  settles, so anything not yet written is never sent

**Solutions**:
```typescript
// Server: Ensure writing to writable
const server = new Server<MyProtocol>({
  requireAuth: false,
  handlers: {
    'data/stream': async ({ writable }) => {
      const writer = writable.getWriter()

      // MUST write data
      await writer.write({ value: 1 })
      await writer.write({ value: 2 })

      // Optional: the server closes the pipe itself once this handler settles.
      // Close explicitly only to end the client's readable before returning.
      await writer.close()

      return 'Done'
    }
  }
})

// Client: consume the readable
const stream = client.createStream('data/stream')

// Option 1: Get reader -- portable everywhere
const reader = stream.readable.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(value)
}

// Option 2: Pipe to a writable
await stream.readable.pipeTo(someWritable)

// Option 3: Async iteration -- convenient, but ReadableStream async iteration is
// not implemented in every browser
for await (const data of stream.readable) {
  console.log(data)
}
```

### Issue: Request Timeout or Hang

**Symptoms**: Client request never resolves

**Causes**:
- Handler never settles -- the result reply is only sent once the handler's promise resolves
- No handler registered for the procedure: the server emits `handlerError` and sends no reply

**Solutions**:
```typescript
// Ensure handler returns
const server = new Server<MyProtocol>({
  requireAuth: false,
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
const client = new Client<MyProtocol>({
  transport,
  handleTransportError: (error) => {
    console.error('Transport error:', error)
    // Return a replacement transport to keep going, or nothing to abort the client
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
- Abandoned calls that are never closed or aborted
- Not disposing client/server

Note the server bounds its own exposure: live controllers and concurrent handlers are capped by
`ResourceLimits` (`EK03`/`EK04`), and expired controllers are evicted on timeout (`EK05`).

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
const server = new Server<MyProtocol>({
  requireAuth: false,
  handlers: {
    'data/stream': async ({ writable, signal }) => {
      const writer = writable.getWriter()
      const interval = setInterval(() => {
        writer.write(getData())
      }, 1000)

      // IMPORTANT: release your own resources on abort. The pipe itself is
      // drained and closed by the server once this handler settles.
      signal.addEventListener('abort', () => {
        clearInterval(interval)
      })

      await new Promise(r => signal.addEventListener('abort', r))
    }
  }
})
```

### Issue: Protocol Changes Break Clients

**Symptoms**: Calls that used to work start failing after a protocol update

**What actually happens**: there is no protocol negotiation or versioning in Enkaku. The
`protocol` server param drives one thing -- message validation. A client sending a message the
server's protocol rejects gets an `EK08` (`INVALID_MESSAGE`) error reply, and the server emits
`invalidMessage`. A procedure the server has no handler for produces no reply at all, so the
call hangs (see *Handler Never Called*).

**Causes**:
- Client and server built against different protocol definitions
- Breaking changes to param schemas -- the server validates *client* messages, so a param that
  no longer matches is rejected
- Removed or renamed procedures

**Solutions**: this is a deployment concern, not a framework feature. Prefer additive changes
(new optional fields, new procedures), and if you need two incompatible protocols live at once,
run two servers on separate endpoints and route to them at your HTTP layer -- Enkaku itself has
no version-routing surface.

```typescript
// Additive change: existing clients keep working, new clients see the new field
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
```
