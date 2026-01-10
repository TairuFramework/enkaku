# Validating Requests

## Goal

Learn how to build type-safe, validated RPC endpoints with Enkaku by implementing a user management API with comprehensive request and response validation. You'll define JSON Schemas for protocols, implement runtime validation, leverage TypeScript type generation, handle validation errors gracefully, and understand the relationship between compile-time and runtime type safety.

## Prerequisites

Install the required packages:

```bash
pnpm add @enkaku/protocol @enkaku/server @enkaku/http-server-transport
pnpm add @enkaku/client @enkaku/http-client-transport
pnpm add @enkaku/schema
```

## Step-by-Step Implementation

### Step 1: Define Protocol with JSON Schemas

Create a protocol that uses JSON Schema to define precise validation rules for parameters and results. This provides both runtime validation and compile-time type safety.

```typescript
// shared/protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'
import type { Schema } from '@enkaku/schema'

export const userProtocol = {
  'users/list': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100 },
        filter: { type: 'string', minLength: 1 }
      },
      additionalProperties: false
    } as const satisfies Schema,
    result: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['id', 'name', 'email'],
            additionalProperties: false
          }
        },
        total: { type: 'number' },
        page: { type: 'number' }
      },
      required: ['users', 'total', 'page'],
      additionalProperties: false
    } as const satisfies Schema
  },

  'users/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 18, maximum: 120 },
        role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
      },
      required: ['name', 'email'],
      additionalProperties: false
    } as const satisfies Schema,
    result: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
        role: { type: 'string' }
      },
      required: ['id', 'name', 'email', 'role'],
      additionalProperties: false
    } as const satisfies Schema,
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
      required: ['code', 'message'],
      additionalProperties: false
    } as const satisfies Schema
  },

  'users/update': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            age: { type: 'number', minimum: 18, maximum: 120 }
          },
          additionalProperties: false
        }
      },
      required: ['id', 'updates'],
      additionalProperties: false
    } as const satisfies Schema,
    result: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      required: ['id', 'name', 'email', 'updatedAt'],
      additionalProperties: false
    } as const satisfies Schema
  }
} as const satisfies ProtocolDefinition

export type UserProtocol = typeof userProtocol
```

**Key points:**
- Use `as const satisfies Schema` on each schema for proper type inference
- `additionalProperties: false` prevents unexpected fields
- `required` array ensures mandatory fields are present
- JSON Schema formats like `email` and `date-time` provide specialized validation
- `minimum`/`maximum` for numeric constraints
- `minLength`/`maxLength` for string length validation
- `pattern` for regex-based string validation
- `enum` for literal union types
- Custom `error` schemas define structured error responses

### Step 2: Enable Server-Side Validation

Configure the server to automatically validate all incoming messages and parameters against the protocol schemas.

```typescript
// server/index.ts
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import { userProtocol, type UserProtocol } from '../shared/protocol'
import { handlers } from './handlers'

// Create transport
const transport = new ServerTransport<UserProtocol>({
  allowedOrigin: ['http://localhost:3000']
})

// Create server with protocol validation enabled
const server = new Server<UserProtocol>({
  protocol: userProtocol,  // Providing protocol enables automatic validation
  transport,
  handlers,
  public: true
})

// Listen for validation errors
server.events.on('invalidMessage', ({ error, message }) => {
  console.error('Validation failed:', error.message)

  // error.cause is the ValidationError with detailed issues
  if (error.cause && 'issues' in error.cause) {
    const validationError = error.cause as { issues: Array<any> }
    for (const issue of validationError.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      console.error(`  × ${path}: ${issue.message}`)
    }
  }
})

// Start HTTP server
const httpServer = Bun.serve({
  port: 3000,
  fetch: transport.fetch
})

console.log(`RPC server listening on http://localhost:${httpServer.port}`)
```

**Key points:**
- Passing `protocol` to Server constructor enables automatic schema validation
- Invalid messages are rejected before reaching handlers
- `invalidMessage` event provides detailed validation error information
- Validation happens on the raw message before token verification
- Protects handlers from malformed data

### Step 3: Implement Type-Safe Handlers with Custom Validation

Create handlers that leverage inferred types and add custom business logic validation on top of schema validation.

```typescript
// server/handlers.ts
import type { ProcedureHandlers } from '@enkaku/server'
import type { UserProtocol } from '../shared/protocol'
import { createValidator, assertType, ValidationError } from '@enkaku/schema'

// In-memory user store
type User = {
  id: string
  name: string
  email: string
  age?: number
  role: string
  createdAt: Date
  updatedAt: Date
}

const users = new Map<string, User>()
const emailIndex = new Map<string, string>() // email -> id

// Create custom validators for additional validation
const emailValidator = createValidator({
  type: 'string',
  format: 'email'
} as const)

export const handlers: ProcedureHandlers<UserProtocol> = {
  'users/list': async ({ param }) => {
    // param is typed as { page?: number, limit?: number, filter?: string }
    const page = param?.page ?? 1
    const limit = param?.limit ?? 10
    const filter = param?.filter

    let userList = Array.from(users.values())

    // Apply filter if provided
    if (filter) {
      const lowerFilter = filter.toLowerCase()
      userList = userList.filter(
        user =>
          user.name.toLowerCase().includes(lowerFilter) ||
          user.email.toLowerCase().includes(lowerFilter)
      )
    }

    // Pagination
    const start = (page - 1) * limit
    const paginatedUsers = userList.slice(start, start + limit)

    return {
      users: paginatedUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email
      })),
      total: userList.length,
      page
    }
  },

  'users/create': async ({ param }) => {
    // param is typed based on schema: { name: string, email: string, age?: number, role?: string }

    // Check for duplicate email (business logic validation)
    if (emailIndex.has(param.email)) {
      throw {
        code: 'DUPLICATE_EMAIL',
        message: 'Email address already in use',
        field: 'email'
      }
    }

    // Validate email format with additional validator
    const emailResult = emailValidator(param.email)
    if (emailResult instanceof ValidationError) {
      throw {
        code: 'INVALID_EMAIL',
        message: 'Invalid email format',
        field: 'email'
      }
    }

    const id = crypto.randomUUID()
    const now = new Date()

    const user: User = {
      id,
      name: param.name,
      email: param.email,
      age: param.age,
      role: param.role ?? 'user',
      createdAt: now,
      updatedAt: now
    }

    users.set(id, user)
    emailIndex.set(param.email, id)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      role: user.role
    }
  },

  'users/update': async ({ param }) => {
    // param is typed as { id: string, updates: { name?: string, email?: string, age?: number } }
    const user = users.get(param.id)

    if (!user) {
      throw new Error(`User not found: ${param.id}`)
    }

    // Check email uniqueness if updating email
    if (param.updates.email && param.updates.email !== user.email) {
      if (emailIndex.has(param.updates.email)) {
        throw new Error('Email address already in use')
      }

      // Remove old email index
      emailIndex.delete(user.email)
      // Add new email index
      emailIndex.set(param.updates.email, user.id)
    }

    // Apply updates
    if (param.updates.name !== undefined) {
      user.name = param.updates.name
    }
    if (param.updates.email !== undefined) {
      user.email = param.updates.email
    }
    if (param.updates.age !== undefined) {
      user.age = param.updates.age
    }

    user.updatedAt = new Date()

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      updatedAt: user.updatedAt.toISOString()
    }
  }
}
```

**Key points:**
- Handler parameters are automatically typed from protocol schemas
- TypeScript enforces that returned values match result schema shape
- Combine automatic schema validation with custom business logic validation
- Use `createValidator` for additional field-specific validation
- Throw structured errors matching the error schema
- Optional fields are properly typed (e.g., `age?: number`)
- Enum values become literal union types (e.g., `'user' | 'admin' | 'moderator'`)

### Step 4: Implement Client-Side Validation

Create a type-safe client that validates responses from the server.

```typescript
// client/index.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import type { UserProtocol } from '../shared/protocol'
import { createValidator, assertType, ValidationError } from '@enkaku/schema'
import { userProtocol } from '../shared/protocol'

async function main() {
  // Create transport
  const transport = new ClientTransport<UserProtocol>({
    url: 'http://localhost:3000'
  })

  // Create client
  const client = new Client<UserProtocol>({ transport })

  try {
    // Example 1: Valid request
    console.log('Creating user with valid data...')
    const newUser = await client.request('users/create', {
      param: {
        name: 'Alice Smith',
        email: 'alice@example.com',
        age: 28,
        role: 'admin'
      }
    })
    console.log('Created user:', newUser)
    // Output: Created user: { id: '...', name: 'Alice Smith', email: 'alice@example.com', ... }

    // Example 2: Schema validation error (caught by server)
    console.log('\nAttempting to create user with invalid email...')
    try {
      await client.request('users/create', {
        param: {
          name: 'Bob',
          email: 'not-an-email', // Invalid email format
          age: 25
        }
      })
    } catch (error) {
      console.error('Expected error:', error.message)
      // Server rejects this before handler runs
    }

    // Example 3: Business logic error (caught by handler)
    console.log('\nAttempting to create duplicate user...')
    try {
      await client.request('users/create', {
        param: {
          name: 'Alice Clone',
          email: 'alice@example.com', // Duplicate email
          age: 30
        }
      })
    } catch (error) {
      console.error('Business logic error:', error)
      // Handler throws custom error: { code: 'DUPLICATE_EMAIL', message: '...', field: 'email' }
    }

    // Example 4: List users with validation
    console.log('\nListing users with pagination...')
    const listResult = await client.request('users/list', {
      param: {
        page: 1,
        limit: 10
      }
    })
    console.log(`Found ${listResult.total} users on page ${listResult.page}`)
    listResult.users.forEach(user => {
      console.log(`  - ${user.name} <${user.email}>`)
    })

    // Example 5: Client-side response validation
    console.log('\nValidating server response...')

    // Create validator for result schema
    const createUserResultValidator = createValidator(
      userProtocol['users/create'].result
    )

    const response = await client.request('users/create', {
      param: {
        name: 'Charlie',
        email: 'charlie@example.com'
      }
    })

    // Explicitly validate the response
    const validationResult = createUserResultValidator(response)
    if (validationResult instanceof ValidationError) {
      console.error('Server returned invalid response!')
      for (const issue of validationResult.issues) {
        console.error(`  × ${issue.path.join('.')}: ${issue.message}`)
      }
    } else {
      console.log('Response is valid:', validationResult.value)
    }

  } finally {
    await client.dispose()
  }
}

main().catch(console.error)
```

**Key points:**
- Client automatically gets type safety from protocol definition
- Server validates requests before handlers execute
- Client can optionally validate responses for extra safety
- Use `createValidator` with protocol schemas for explicit validation
- Structured error responses are type-safe
- Validation errors provide detailed field-level information

### Step 5: Advanced Validation Patterns

Implement more sophisticated validation scenarios including nested objects, conditional validation, and validation monitoring.

```typescript
// shared/advanced-protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'
import type { Schema } from '@enkaku/schema'

export const advancedProtocol = {
  'documents/create': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        content: { type: 'string' },
        metadata: {
          type: 'object',
          properties: {
            author: { type: 'string' },
            tags: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 1,
              maxItems: 10,
              uniqueItems: true
            },
            visibility: { type: 'string', enum: ['public', 'private', 'unlisted'] },
            // Nested object validation
            settings: {
              type: 'object',
              properties: {
                allowComments: { type: 'boolean' },
                allowSharing: { type: 'boolean' },
                expiresAt: { type: 'string', format: 'date-time' }
              },
              additionalProperties: false
            }
          },
          required: ['author', 'tags', 'visibility'],
          additionalProperties: false
        }
      },
      required: ['title', 'content', 'metadata'],
      additionalProperties: false
    } as const satisfies Schema,
    result: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      },
      required: ['id', 'title', 'createdAt'],
      additionalProperties: false
    } as const satisfies Schema
  }
} as const satisfies ProtocolDefinition

export type AdvancedProtocol = typeof advancedProtocol
```

**Advanced validation in handlers:**

```typescript
// server/advanced-handlers.ts
import type { ProcedureHandlers } from '@enkaku/server'
import type { AdvancedProtocol } from '../shared/advanced-protocol'
import { createValidator, assertType, ValidationError } from '@enkaku/schema'

export const advancedHandlers: ProcedureHandlers<AdvancedProtocol> = {
  'documents/create': async ({ param }) => {
    // param has deeply nested type inference:
    // {
    //   title: string,
    //   content: string,
    //   metadata: {
    //     author: string,
    //     tags: Array<string>,
    //     visibility: 'public' | 'private' | 'unlisted',
    //     settings?: {
    //       allowComments?: boolean,
    //       allowSharing?: boolean,
    //       expiresAt?: string
    //     }
    //   }
    // }

    // Custom validation: expiry date must be in future
    if (param.metadata.settings?.expiresAt) {
      const expiryDate = new Date(param.metadata.settings.expiresAt)
      if (expiryDate <= new Date()) {
        throw new Error('Expiry date must be in the future')
      }
    }

    // Custom validation: private documents can't allow sharing
    if (param.metadata.visibility === 'private' &&
        param.metadata.settings?.allowSharing) {
      throw new Error('Private documents cannot be shared')
    }

    const id = crypto.randomUUID()
    const now = new Date()

    // Store document (implementation omitted)

    return {
      id,
      title: param.title,
      createdAt: now.toISOString()
    }
  }
}
```

**Validation monitoring and metrics:**

```typescript
// server/monitoring.ts
import { Server } from '@enkaku/server'
import type { UserProtocol } from '../shared/protocol'

export function setupValidationMonitoring(server: Server<UserProtocol>) {
  let validationErrorCount = 0
  let handlerErrorCount = 0

  // Track validation errors
  server.events.on('invalidMessage', ({ error, message }) => {
    validationErrorCount++

    console.error('Validation error #', validationErrorCount)
    console.error('Error:', error.message)

    if (error.cause && 'issues' in error.cause) {
      const validationError = error.cause as { issues: Array<any> }
      console.error('Issues:', validationError.issues.length)

      // Group errors by field
      const errorsByField = new Map<string, number>()
      for (const issue of validationError.issues) {
        const field = issue.path.join('.')
        errorsByField.set(field, (errorsByField.get(field) ?? 0) + 1)
      }

      console.error('Errors by field:', Object.fromEntries(errorsByField))
    }
  })

  // Track handler errors
  server.events.on('handlerError', ({ error, payload, rid }) => {
    handlerErrorCount++

    console.error('Handler error #', handlerErrorCount)
    console.error('Procedure:', payload.prc)
    console.error('Request ID:', rid)
    console.error('Error:', error.message)
  })

  // Periodic metrics
  setInterval(() => {
    console.log('Validation metrics:', {
      validationErrors: validationErrorCount,
      handlerErrors: handlerErrorCount,
      total: validationErrorCount + handlerErrorCount
    })
  }, 60000) // Every minute
}
```

**Key points:**
- Nested objects are fully validated with deep type inference
- Array validation includes `minItems`, `maxItems`, and `uniqueItems`
- Combine schema validation with custom business logic validation
- Monitor validation errors for debugging and metrics
- Use validation events to track problematic fields or endpoints
- TypeScript infers exact types for nested structures and enums

## Understanding Compile-Time vs Runtime Type Safety

### Compile-Time Type Safety

TypeScript provides compile-time guarantees based on your protocol definition:

```typescript
import { Client } from '@enkaku/client'
import type { UserProtocol } from '../shared/protocol'

const client = new Client<UserProtocol>({ transport })

// ✅ TypeScript knows the exact parameter type
await client.request('users/create', {
  param: {
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin' // TypeScript knows this must be 'user' | 'admin' | 'moderator'
  }
})

// ❌ TypeScript compilation error: unknown property
await client.request('users/create', {
  param: {
    name: 'Alice',
    email: 'alice@example.com',
    unknownField: 'value' // Error: Object literal may only specify known properties
  }
})

// ❌ TypeScript compilation error: wrong type
await client.request('users/create', {
  param: {
    name: 'Alice',
    email: 123 // Error: Type 'number' is not assignable to type 'string'
  }
})
```

### Runtime Type Safety

JSON Schema validation provides runtime guarantees that protect against:
- Malicious clients bypassing TypeScript
- Data from external systems (webhooks, integrations)
- Corrupted or manipulated network requests
- Version mismatches between client and server

```typescript
// Even if a malicious client sends this at runtime:
const maliciousRequest = {
  param: {
    name: 'Alice',
    email: 'alice@example.com',
    role: 'super-admin' // Not in enum!
  }
}

// The server's schema validation will reject it before the handler runs:
// ValidationError: must be equal to one of the allowed values
```

### The Two-Layer Defense

```typescript
// Layer 1: TypeScript (Compile-time)
// - Catches errors during development
// - Provides autocomplete and type checking
// - No runtime overhead

// Layer 2: JSON Schema (Runtime)
// - Validates actual data at runtime
// - Protects against malicious clients
// - Ensures data integrity across boundaries

// Together they provide:
// ✅ Developer experience (TypeScript)
// ✅ Security (JSON Schema)
// ✅ Type safety at compile time AND runtime
```

## Validation Error Handling

### Structured Error Responses

Define custom error schemas for type-safe error handling:

```typescript
// In protocol definition
error: {
  type: 'object',
  properties: {
    code: { type: 'string', enum: ['DUPLICATE_EMAIL', 'INVALID_EMAIL'] },
    message: { type: 'string' },
    field: { type: 'string' }
  },
  required: ['code', 'message'],
  additionalProperties: false
} as const satisfies Schema
```

### Client-Side Error Handling

```typescript
import { RequestError } from '@enkaku/client'

try {
  await client.request('users/create', { param: userData })
} catch (error) {
  if (error instanceof RequestError) {
    // error.data is typed based on error schema
    console.log('Error code:', error.data.code) // 'DUPLICATE_EMAIL' | 'INVALID_EMAIL'
    console.log('Field:', error.data.field)
    console.log('Message:', error.data.message)

    // Show user-friendly message
    if (error.data.code === 'DUPLICATE_EMAIL') {
      alert(`The email address is already in use`)
    }
  }
}
```

## Complete Example

Here's a minimal, complete example demonstrating validation:

```typescript
// example.ts - Complete validated server + client
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { Server } from '@enkaku/server'

// 1. Define protocol with validation
const protocol = {
  'greet': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 50 }
      },
      required: ['name'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message'],
      additionalProperties: false
    }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

// 2. Create server with validation
const serverTransport = new ServerTransport<Protocol>()

const server = new Server<Protocol>({
  protocol, // Enables automatic validation
  transport: serverTransport,
  public: true,
  handlers: {
    greet: async ({ param }) => {
      return { message: `Hello, ${param.name}!` }
    }
  }
})

// 3. Monitor validation errors
server.events.on('invalidMessage', ({ error }) => {
  console.error('Validation failed:', error.message)
})

// 4. Start HTTP server
const httpServer = Bun.serve({
  port: 3001,
  fetch: serverTransport.fetch
})

console.log('Server running on http://localhost:3001')

// 5. Create client and test
const clientTransport = new ClientTransport<Protocol>({
  url: 'http://localhost:3001'
})

const client = new Client<Protocol>({ transport: clientTransport })

// Valid request
const result = await client.request('greet', {
  param: { name: 'World' }
})
console.log(result.message) // Output: Hello, World!

// Invalid request (will be rejected by server)
try {
  await client.request('greet', {
    param: { name: '' } // Fails minLength validation
  })
} catch (error) {
  console.error('Expected error:', error.message)
}

// Cleanup
await client.dispose()
httpServer.stop()
await server.dispose()
```

Run with:
```bash
bun example.ts
```

## Related Capabilities

### Domain Documentation
- [Schema & Validation](../domains/validation.md) - Deep dive into JSON Schema, validators, and encoding
- [Core RPC](../domains/core-rpc.md) - Protocol definitions, client, and server architecture
- [Transport](../domains/transport.md) - Transport layer message validation

### Related Use Cases
- [Building an RPC Server](building-rpc-server.md) - Foundation for RPC servers
- [Securing Endpoints](securing-endpoints.md) - Add authentication to validated endpoints
- [Real-time Communication](real-time-communication.md) - Validate streaming and channel data
- [Handling Streaming Data](handling-streaming-data.md) - Schema validation for streams
