# Building an RPC Server

## Goal

Learn how to build a complete RPC server with Enkaku by creating a simple user management API that supports listing users, fetching user details, and creating new users. You'll define a protocol, implement request handlers, set up HTTP transport, and test the server with a client.

## Prerequisites

Install the required packages:

```bash
pnpm add @enkaku/protocol @enkaku/server @enkaku/http-server-transport
pnpm add @enkaku/client @enkaku/http-client-transport  # For testing
```

## Step-by-Step Implementation

### Step 1: Define Your Protocol

Create a protocol that defines the contract between client and server. This uses JSON Schema to describe the shape of parameters and results.

```typescript
// shared/protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'

export const userProtocol = {
  'users/list': {
    type: 'request',
    result: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['id', 'name', 'email'],
        additionalProperties: false
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
        email: { type: 'string' },
        createdAt: { type: 'number' }
      },
      required: ['id', 'name', 'email', 'createdAt'],
      additionalProperties: false
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
      required: ['name', 'email'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id'],
      additionalProperties: false
    }
  }
} as const satisfies ProtocolDefinition

export type UserProtocol = typeof userProtocol
```

**Key points:**
- Use `as const satisfies ProtocolDefinition` to preserve literal types while validating structure
- Each procedure has a `type` (request, stream, channel, or event)
- JSON Schema defines the shape of `param` and `result`
- `required` and `additionalProperties: false` ensure strict validation

### Step 2: Implement Server Handlers

Create handlers that implement the business logic for each procedure. Each handler receives a context with the parameter and returns the result.

```typescript
// server/handlers.ts
import type { ProcedureHandlers, RequestHandler } from '@enkaku/server'
import type { UserProtocol } from '../shared/protocol'

// In-memory user store (replace with real database)
type User = {
  id: string
  name: string
  email: string
  createdAt: number
}

const users = new Map<string, User>()

// Seed with example data
users.set('1', { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: Date.now() })
users.set('2', { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: Date.now() })

export const handlers: ProcedureHandlers<UserProtocol> = {
  'users/list': async () => {
    // Return all users as an array
    return Array.from(users.values())
  },

  'users/get': async ({ param }) => {
    // param is typed as string based on protocol
    const user = users.get(param)

    if (!user) {
      // Throw error if user not found
      throw new Error(`User not found: ${param}`)
    }

    return user
  },

  'users/create': async ({ param }) => {
    // param is typed as { name: string, email: string }
    const id = crypto.randomUUID()

    const user: User = {
      id,
      name: param.name,
      email: param.email,
      createdAt: Date.now()
    }

    users.set(id, user)

    // Return just the ID as specified in protocol
    return { id }
  }
}
```

**Key points:**
- Handlers are typed based on the protocol definition
- The `param` argument is automatically inferred from the protocol
- Return types are checked against the protocol's `result` schema
- Handlers can throw errors which are sent back to the client

### Step 3: Set Up HTTP Transport

Configure the HTTP server transport to handle incoming requests over HTTP with Server-Sent Events for streaming.

```typescript
// server/transport.ts
import { ServerTransport } from '@enkaku/http-server-transport'
import type { UserProtocol } from '../shared/protocol'

export const transport = new ServerTransport<UserProtocol>({
  // Configure CORS to allow requests from specific origins
  allowedOrigin: [
    'http://localhost:3000',
    'https://myapp.com'
  ]
  // Or use '*' to allow all origins (not recommended for production)
  // allowedOrigin: '*'
})
```

**Key points:**
- `ServerTransport` handles HTTP requests and responses
- CORS is automatically configured via `allowedOrigin`
- Transport is generic over the protocol type for type safety
- Supports GET, POST, and OPTIONS requests

### Step 4: Start the Server

Combine the handlers and transport to start the RPC server. This example uses Bun's built-in HTTP server.

```typescript
// server/index.ts
import { Server } from '@enkaku/server'
import { userProtocol } from '../shared/protocol'
import { handlers } from './handlers'
import { transport } from './transport'

// Create the server instance
const server = new Server({
  protocol: userProtocol,  // Enable schema validation
  transport,
  handlers,
  public: true  // No authentication required
})

// Start HTTP server (Bun example)
const httpServer = Bun.serve({
  port: 3000,
  fetch: transport.fetch
})

console.log(`RPC server listening on http://localhost:${httpServer.port}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  httpServer.stop()
  await server.dispose()
  process.exit(0)
})
```

**Alternative for Node.js:**
```typescript
import { serve } from '@hono/node-server'

const httpServer = serve({
  port: 3000,
  fetch: transport.fetch
})
```

**Key points:**
- The `Server` class manages handler execution and message routing
- Providing `protocol` enables JSON Schema validation
- `public: true` allows unauthenticated access (set to `false` for token-based auth)
- The transport's `fetch` method handles HTTP requests
- Always dispose the server on shutdown to clean up resources

### Step 5: Test with a Client

Create a client to test your server and verify it works correctly.

```typescript
// client/index.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import type { UserProtocol } from '../shared/protocol'

async function main() {
  // Create HTTP client transport
  const transport = new ClientTransport<UserProtocol>({
    url: 'http://localhost:3000'
  })

  // Create RPC client
  const client = new Client<UserProtocol>({ transport })

  try {
    // List all users
    console.log('Listing users...')
    const allUsers = await client.request('users/list')
    console.log('Users:', allUsers)
    // Output: Users: [{ id: '1', name: 'Alice', ... }, { id: '2', name: 'Bob', ... }]

    // Create a new user
    console.log('\nCreating user...')
    const result = await client.request('users/create', {
      param: {
        name: 'Charlie',
        email: 'charlie@example.com'
      }
    })
    console.log('Created user with ID:', result.id)

    // Get user details
    console.log('\nFetching user details...')
    const user = await client.request('users/get', {
      param: result.id
    })
    console.log('User details:', user)
    // Output: User details: { id: '...', name: 'Charlie', email: 'charlie@example.com', createdAt: ... }

    // Try to get non-existent user (error handling)
    console.log('\nTesting error handling...')
    try {
      await client.request('users/get', { param: 'nonexistent' })
    } catch (error) {
      console.error('Expected error:', error.message)
      // Output: Expected error: User not found: nonexistent
    }

  } finally {
    // Clean up
    await client.dispose()
  }
}

main().catch(console.error)
```

**Key points:**
- Client and server share the same protocol for type safety
- Client methods are fully typed based on the protocol
- Use `try/catch` to handle RPC errors
- Always dispose the client when done to clean up resources

## Complete Example

Here's a minimal, complete example you can run:

```typescript
// example.ts - Complete server + client in one file
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { Server } from '@enkaku/server'

// 1. Define protocol
const protocol = {
  'greet': {
    type: 'request',
    param: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name']
    },
    result: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message']
    }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

// 2. Create server
const serverTransport = new ServerTransport<Protocol>()

const server = new Server<Protocol>({
  protocol,
  transport: serverTransport,
  public: true,
  handlers: {
    greet: async ({ param }) => {
      return { message: `Hello, ${param.name}!` }
    }
  }
})

// 3. Start HTTP server
const httpServer = Bun.serve({
  port: 3001,
  fetch: serverTransport.fetch
})

console.log('Server running on http://localhost:3001')

// 4. Create client and make request
const clientTransport = new ClientTransport<Protocol>({
  url: 'http://localhost:3001'
})

const client = new Client<Protocol>({ transport: clientTransport })

const result = await client.request('greet', {
  param: { name: 'World' }
})

console.log(result.message)  // Output: Hello, World!

// 5. Cleanup
await client.dispose()
httpServer.stop()
await server.dispose()
```

Run with:
```bash
bun example.ts
```

## Extending This Example

### How to Add Streaming

Stream live data from server to client:

```typescript
// Add to protocol
'users/watch': {
  type: 'stream',
  receive: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['created', 'updated', 'deleted'] },
      user: { type: 'object' }
    }
  }
}

// Add handler
'users/watch': async ({ writable, signal }) => {
  const writer = writable.getWriter()

  // Subscribe to user changes
  const unsubscribe = userEvents.on('change', (event) => {
    writer.write(event)
  })

  // Cleanup on disconnect
  signal.addEventListener('abort', () => {
    unsubscribe()
    writer.close()
  })

  // Keep stream open until aborted
  await new Promise((resolve) => {
    signal.addEventListener('abort', resolve)
  })
}

// Client usage
const stream = client.createStream('users/watch')
for await (const event of stream.readable) {
  console.log('User event:', event)
}
```

### How to Add Authentication

Require signed tokens for access:

```typescript
import { TokenSigner } from '@enkaku/token'
import { NodeKeyStore } from '@enkaku/node-keystore'

// Server: Disable public access
const server = new Server({
  protocol,
  transport,
  handlers,
  public: false,  // Require authentication
  id: 'my-server-id'
})

// Client: Sign requests
const keyStore = new NodeKeyStore()
const signer = new TokenSigner({
  id: 'my-client-id',
  keyStore,
  audience: 'my-server-id'
})

const client = new Client({
  transport,
  signer,
  serverID: 'my-server-id'
})
```

### How to Add Error Schemas

Define custom error types in your protocol:

```typescript
'users/create': {
  type: 'request',
  param: { /* ... */ },
  result: { /* ... */ },
  error: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        enum: ['DUPLICATE_EMAIL', 'INVALID_EMAIL', 'VALIDATION_ERROR']
      },
      message: { type: 'string' },
      field: { type: 'string' }
    },
    required: ['code', 'message']
  }
}

// Handler throws with custom error
if (emailExists) {
  throw {
    code: 'DUPLICATE_EMAIL',
    message: 'Email already in use',
    field: 'email'
  }
}

// Client catches typed error
import { RequestError } from '@enkaku/client'

try {
  await client.request('users/create', { param: newUser })
} catch (error) {
  if (error instanceof RequestError) {
    console.log('Error code:', error.data.code)
    console.log('Error field:', error.data.field)
  }
}
```

### How to Add Validation Events

Listen to server events for monitoring:

```typescript
// Listen for validation errors
server.events.on('invalidMessage', ({ error, message }) => {
  console.error('Invalid message received:', error)
  console.log('Message:', message)
})

// Listen for handler errors
server.events.on('handlerError', ({ error, payload, rid }) => {
  console.error('Handler failed:', error)
  console.log('Procedure:', payload.prc)
  console.log('Request ID:', rid)
})

// Listen for transport write failures
transport.events.on('writeFailed', ({ error, rid }) => {
  console.error(`Failed to write response for ${rid}:`, error)
})
```

## Related Capabilities

### Domain Documentation
- [Core RPC](../domains/core-rpc.md) - Deep dive into protocol, client, server, and standalone packages
- [Transport](../domains/transport.md) - Complete transport layer reference including HTTP, sockets, and streams

### Related Use Cases
- Building an RPC client (coming soon)
- Real-time data streaming (coming soon)
- Bidirectional channels (coming soon)
