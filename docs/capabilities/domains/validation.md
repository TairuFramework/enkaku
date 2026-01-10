# Schema & Validation - Detailed Reference

## Overview

The Schema & Validation domain in Enkaku provides runtime data validation and encoding/decoding utilities that work seamlessly with TypeScript's type system. Built on industry standards (JSON Schema, Standard Schema v1, RFC 4648, RFC 8785), these packages enable type-safe data handling across runtime boundaries while maintaining zero-trust validation principles.

This domain handles two core concerns: schema-based validation with type generation (`@enkaku/schema`) and binary/text encoding for data transmission (`@enkaku/codec`). Together, they form the foundation for protocol definitions, token systems, and transport message validation throughout Enkaku.

## Package Ecosystem

### JSON Schema Validation: @enkaku/schema

**Purpose**: Runtime validation with compile-time type generation from JSON Schema definitions.

**Key exports**:
- `Schema` - Type for JSON Schema (excludes boolean schemas)
- `FromSchema<S>` - Type utility to generate TypeScript types from schemas
- `Validator<T>` - Function type for validation (returns Standard Schema Result)
- `createValidator<S, T>(schema)` - Create validator from schema
- `createStandardValidator<S, T>(schema)` - Create Standard Schema v1 validator
- `toStandardValidator<T>(validator)` - Wrap validator in Standard Schema
- `assertType<T>(validator, value)` - Assert value matches type (throws)
- `asType<T>(validator, value)` - Assert and return typed value
- `isType<T>(validator, value)` - Type guard (boolean check)
- `ValidationError` - Aggregate error with all validation issues
- `ValidationErrorObject` - Individual validation issue
- `resolveReference(root, ref)` - Resolve JSON Schema $ref
- `resolveSchema(root, schema)` - Resolve schema or reference
- `StandardSchemaV1` - Re-exported from `@standard-schema/spec`

**Dependencies**:
- `ajv` - JSON Schema validation engine (draft-07)
- `ajv-formats` - Additional format validators (email, uri, date-time, etc.)
- `json-schema-to-ts` - Compile-time type generation
- `@standard-schema/spec` - Standard Schema v1 specification

**Core concepts**:
- JSON Schema for validation rules
- AJV for runtime validation with all errors collected
- Type generation via TypeScript conditional types
- Standard Schema v1 Result type: `{ value: T } | ValidationError`
- Formats enabled: date-time, date, time, email, hostname, ipv4, ipv6, uri, uri-reference, etc.
- Default values applied during validation
- Schema caching disabled to prevent memory leaks

**Platform support**: All JavaScript runtimes (browsers, Node.js, Deno, Bun)

### Encoding/Decoding: @enkaku/codec

**Purpose**: Binary encoding, Base64 encoding, and canonical JSON for data transmission.

**Key exports**:
- `toB64(bytes)` - Encode Uint8Array to Base64 string
- `fromB64(base64)` - Decode Base64 string to Uint8Array
- `toB64U(bytes)` - Encode Uint8Array to Base64URL (URL-safe, no padding)
- `fromB64U(base64url)` - Decode Base64URL to Uint8Array
- `fromUTF(string)` - Encode UTF-8 string to Uint8Array
- `toUTF(bytes)` - Decode Uint8Array to UTF-8 string
- `b64uFromUTF(string)` - Encode UTF-8 string directly to Base64URL
- `b64uToUTF(base64url)` - Decode Base64URL directly to UTF-8 string
- `b64uFromJSON(object, canonical?)` - Encode JSON object to Base64URL
- `b64uToJSON<T>(base64url)` - Decode Base64URL to JSON object
- `canonicalStringify(value)` - Canonical JSON serialization (RFC 8785)

**Dependencies**:
- `canonicalize` - RFC 8785 canonical JSON implementation

**Core concepts**:
- Base64 encoding per RFC 4648 §4 (standard alphabet with padding)
- Base64URL encoding per RFC 4648 §5 (URL-safe alphabet, no padding)
- UTF-8 encoding via TextEncoder/TextDecoder (handles all Unicode)
- Canonical JSON per RFC 8785 (deterministic key ordering)
- Canonical JSON critical for cryptographic signatures (same data = same bytes)
- Used by token package for JWT-style tokens

**Platform support**: All JavaScript runtimes with TextEncoder/TextDecoder support

## Common Patterns

### Pattern: Protocol Definition with Type Safety

**Use case**: Define RPC protocol with schemas that generate both runtime validators and TypeScript types

**Implementation**:

```typescript
import type { Schema, FromSchema } from '@enkaku/schema'
import { createValidator } from '@enkaku/schema'

// Define parameter schema
const getUserParamSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', pattern: '^[0-9]+$' },
    includeProfile: { type: 'boolean' },
  },
  required: ['userId'],
  additionalProperties: false,
} as const satisfies Schema

// Define result schema
const getUserResultSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    profile: {
      type: 'object',
      properties: {
        bio: { type: 'string' },
        avatar: { type: 'string', format: 'uri' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'name', 'email'],
  additionalProperties: false,
} as const satisfies Schema

// Define error schema
const getUserErrorSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', enum: ['NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL_ERROR'] },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        reason: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['code', 'message'],
  additionalProperties: false,
} as const satisfies Schema

// Generate TypeScript types
type GetUserParam = FromSchema<typeof getUserParamSchema>
type GetUserResult = FromSchema<typeof getUserResultSchema>
type GetUserError = FromSchema<typeof getUserErrorSchema>

// Create validators
const validateGetUserParam = createValidator<typeof getUserParamSchema, GetUserParam>(
  getUserParamSchema
)
const validateGetUserResult = createValidator<typeof getUserResultSchema, GetUserResult>(
  getUserResultSchema
)
const validateGetUserError = createValidator<typeof getUserErrorSchema, GetUserError>(
  getUserErrorSchema
)

// Use in handler (server-side)
async function handleGetUser(rawParams: unknown): Promise<GetUserResult> {
  // Validate and narrow type
  assertType(validateGetUserParam, rawParams)

  // rawParams is now typed as GetUserParam
  const user = await fetchUser(rawParams.userId)

  if (!user) {
    const error: GetUserError = {
      code: 'NOT_FOUND',
      message: 'User not found',
      data: {
        userId: rawParams.userId,
        reason: 'User does not exist in database',
      },
    }
    throw error
  }

  const result: GetUserResult = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: rawParams.includeProfile ? user.profile : undefined,
  }

  // Validate result before returning
  assertType(validateGetUserResult, result)
  return result
}

// Use in client (type-safe calls)
async function getUser(params: GetUserParam): Promise<GetUserResult> {
  const response = await rpcCall('getUser', params)
  assertType(validateGetUserResult, response)
  return response
}
```

**Why this works**:
- Single source of truth for data shapes (the schema)
- Compile-time types match runtime validation exactly
- Server validates incoming params and outgoing results
- Client validates responses before using
- Enums in schemas become TypeScript literal unions
- Optional/required fields correctly typed
- Catches protocol mismatches at runtime

### Pattern: Configuration File Validation

**Use case**: Load and validate configuration with helpful error messages

**Implementation**:

```typescript
import { createValidator, ValidationError, assertType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'
import { readFile } from 'node:fs/promises'

const configSchema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        host: { type: 'string' },
        tls: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            cert: { type: 'string' },
            key: { type: 'string' },
          },
          required: ['enabled'],
          additionalProperties: false,
        },
      },
      required: ['port', 'host'],
      additionalProperties: false,
    },
    database: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        maxConnections: { type: 'number', minimum: 1, maximum: 100 },
        timeout: { type: 'number', minimum: 0 },
      },
      required: ['url'],
      additionalProperties: false,
    },
    logging: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
        format: { type: 'string', enum: ['json', 'text'] },
      },
      required: ['level'],
      additionalProperties: false,
    },
  },
  required: ['server', 'database', 'logging'],
  additionalProperties: false,
} as const satisfies Schema

type Config = FromSchema<typeof configSchema>

const validateConfig = createValidator<typeof configSchema, Config>(configSchema)

async function loadConfig(path: string): Promise<Config> {
  const content = await readFile(path, 'utf-8')
  const data = JSON.parse(content)

  const result = validateConfig(data)

  if (result instanceof ValidationError) {
    console.error('Configuration validation failed:')
    console.error(`  File: ${path}`)
    console.error('')

    for (const issue of result.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      console.error(`  × ${fieldPath}`)
      console.error(`    ${issue.message}`)

      if (issue.details.params) {
        console.error(`    Details:`, issue.details.params)
      }
      console.error('')
    }

    throw new Error(`Invalid configuration in ${path}`)
  }

  return result.value
}

// Usage
try {
  const config = await loadConfig('./config.json')

  // TypeScript knows exact shape
  console.log(`Starting server on ${config.server.host}:${config.server.port}`)

  if (config.server.tls?.enabled) {
    console.log('TLS enabled')
  }

  console.log(`Database: ${config.database.url}`)
  console.log(`Log level: ${config.logging.level}`)

} catch (error) {
  console.error('Failed to load configuration:', error)
  process.exit(1)
}
```

**Why this works**:
- Validates entire config structure in one pass
- Collects all validation errors (not fail-fast)
- User-friendly error messages with field paths
- Type-safe access to config values after validation
- Format validators (uri, email) via ajv-formats
- Required/optional fields enforced
- Catches typos in field names (additionalProperties: false)

### Pattern: JWT-Style Token Creation and Verification

**Use case**: Create signed tokens with type-safe payloads and deterministic encoding

**Implementation**:

```typescript
import { createValidator, assertType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'
import { b64uFromJSON, b64uToJSON, fromB64U, toB64U } from '@enkaku/codec'

// Define token header schema
const tokenHeaderSchema = {
  type: 'object',
  properties: {
    alg: { type: 'string', enum: ['ES256', 'ES384', 'ES512'] },
    typ: { type: 'string', const: 'JWT' },
  },
  required: ['alg', 'typ'],
  additionalProperties: false,
} as const satisfies Schema

// Define token payload schema
const tokenPayloadSchema = {
  type: 'object',
  properties: {
    iss: { type: 'string', format: 'uri' }, // Issuer
    sub: { type: 'string' },                 // Subject
    aud: { type: 'string', format: 'uri' },  // Audience
    exp: { type: 'number', minimum: 0 },     // Expiration (Unix timestamp)
    nbf: { type: 'number', minimum: 0 },     // Not before
    iat: { type: 'number', minimum: 0 },     // Issued at
    jti: { type: 'string' },                 // JWT ID
    data: { type: 'object' },                // Custom data
  },
  required: ['iss', 'sub', 'exp', 'iat'],
  additionalProperties: false,
} as const satisfies Schema

type TokenHeader = FromSchema<typeof tokenHeaderSchema>
type TokenPayload = FromSchema<typeof tokenPayloadSchema>

const validateTokenHeader = createValidator(tokenHeaderSchema)
const validateTokenPayload = createValidator(tokenPayloadSchema)

// Sign token
async function createToken(
  payload: TokenPayload,
  signFunc: (data: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  // Validate payload
  assertType(validateTokenPayload, payload)

  const header: TokenHeader = {
    alg: 'ES256',
    typ: 'JWT',
  }

  // Encode with canonical JSON (deterministic)
  const encodedHeader = b64uFromJSON(header, true)
  const encodedPayload = b64uFromJSON(payload, true)

  // Create signing input
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await signFunc(new TextEncoder().encode(signingInput))

  // Encode signature
  const encodedSignature = toB64U(signature)

  return `${signingInput}.${encodedSignature}`
}

// Verify token
async function verifyToken(
  token: string,
  verifyFunc: (signature: Uint8Array, data: Uint8Array) => Promise<boolean>
): Promise<TokenPayload> {
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  // Decode and validate header
  const header = b64uToJSON(encodedHeader)
  assertType(validateTokenHeader, header)

  // Decode and validate payload
  const payload = b64uToJSON<TokenPayload>(encodedPayload)
  assertType(validateTokenPayload, payload)

  // Verify signature
  const signature = fromB64U(encodedSignature)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const isValid = await verifyFunc(signature, new TextEncoder().encode(signingInput))

  if (!isValid) {
    throw new Error('Invalid signature')
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    throw new Error('Token expired')
  }

  if (payload.nbf && payload.nbf > now) {
    throw new Error('Token not yet valid')
  }

  return payload
}

// Usage
const payload: TokenPayload = {
  iss: 'https://auth.example.com',
  sub: 'user123',
  aud: 'https://api.example.com',
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  iat: Math.floor(Date.now() / 1000),
  jti: crypto.randomUUID(),
  data: { role: 'admin', permissions: ['read', 'write'] },
}

const token = await createToken(payload, signWithKey)
const verified = await verifyToken(token, verifyWithKey)

console.log('Verified payload:', verified)
console.log('User role:', verified.data?.role)
```

**Why this works**:
- Canonical JSON ensures same payload = same signature
- Type-safe header and payload structures
- Validation before signing and after verification
- Base64URL encoding is URL-safe (no escaping needed)
- Handles all JWT standard claims (iss, sub, exp, etc.)
- Custom data field for application-specific claims
- Expiration and not-before checks built-in

### Pattern: API Request/Response Validation Middleware

**Use case**: Validate all API requests and responses in middleware layer

**Implementation**:

```typescript
import { createValidator, ValidationError, assertType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'

// Define route schemas
type RouteDefinition = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  paramSchema?: Schema
  bodySchema?: Schema
  responseSchema: Schema
}

const routes: Array<RouteDefinition> = [
  {
    method: 'POST',
    path: '/users',
    bodySchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 18 },
      },
      required: ['name', 'email'],
      additionalProperties: false,
    } as const,
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'name', 'email', 'createdAt'],
      additionalProperties: false,
    } as const,
  },
  {
    method: 'GET',
    path: '/users/:id',
    paramSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' },
      },
      required: ['id'],
      additionalProperties: false,
    } as const,
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
        createdAt: { type: 'string' },
      },
      required: ['id', 'name', 'email', 'createdAt'],
      additionalProperties: false,
    } as const,
  },
]

// Create validators for each route
const routeValidators = new Map<string, {
  paramValidator?: ReturnType<typeof createValidator>
  bodyValidator?: ReturnType<typeof createValidator>
  responseValidator: ReturnType<typeof createValidator>
}>()

for (const route of routes) {
  const key = `${route.method} ${route.path}`
  routeValidators.set(key, {
    paramValidator: route.paramSchema ? createValidator(route.paramSchema) : undefined,
    bodyValidator: route.bodySchema ? createValidator(route.bodySchema) : undefined,
    responseValidator: createValidator(route.responseSchema),
  })
}

// Validation middleware
async function validateRequest(
  method: string,
  path: string,
  params: unknown,
  body: unknown
): Promise<void> {
  const validators = routeValidators.get(`${method} ${path}`)

  if (!validators) {
    throw new Error(`Unknown route: ${method} ${path}`)
  }

  // Validate params
  if (validators.paramValidator) {
    const result = validators.paramValidator(params)
    if (result instanceof ValidationError) {
      throw new Error(`Invalid params: ${formatValidationErrors(result)}`)
    }
  }

  // Validate body
  if (validators.bodyValidator) {
    const result = validators.bodyValidator(body)
    if (result instanceof ValidationError) {
      throw new Error(`Invalid body: ${formatValidationErrors(result)}`)
    }
  }
}

async function validateResponse(
  method: string,
  path: string,
  response: unknown
): Promise<void> {
  const validators = routeValidators.get(`${method} ${path}`)

  if (!validators) {
    throw new Error(`Unknown route: ${method} ${path}`)
  }

  const result = validators.responseValidator(response)
  if (result instanceof ValidationError) {
    console.error('Response validation failed:', formatValidationErrors(result))
    throw new Error('Internal server error: invalid response format')
  }
}

function formatValidationErrors(error: ValidationError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    .join(', ')
}

// Usage in handler
async function handleCreateUser(body: unknown) {
  await validateRequest('POST', '/users', {}, body)

  // Body is validated, but TypeScript doesn't know
  // In real implementation, use assertType directly
  const user = await createUser(body as { name: string; email: string; age?: number })

  const response = {
    id: user.id,
    name: user.name,
    email: user.email,
    age: user.age,
    createdAt: new Date().toISOString(),
  }

  await validateResponse('POST', '/users', response)
  return response
}
```

**Why this works**:
- Single definition of route schemas
- Validation runs on every request/response
- Catches malformed requests before handler execution
- Validates responses before sending to client
- Helpful error messages for debugging
- Can be generated from OpenAPI specs
- Prevents invalid responses from reaching clients

## Package Interactions

### Schema + Protocol Integration

Protocol definitions are built entirely on schemas:

```typescript
import type { Schema, FromSchema } from '@enkaku/schema'
import { createValidator } from '@enkaku/schema'

// Protocol package exports schemas for message types
import {
  eventProcedureDefinition,
  requestProcedureDefinition,
  streamProcedureDefinition,
  channelProcedureDefinition,
} from '@enkaku/protocol/schemas'

// These are Schema objects used to validate protocol definitions
const validateEventProcedure = createValidator(eventProcedureDefinition)
const validateRequestProcedure = createValidator(requestProcedureDefinition)

// Protocol definitions include schemas for parameters and results
type ProtocolDefinition = {
  [procedureName: string]: {
    type: 'event' | 'request' | 'stream' | 'channel'
    param?: Schema
    result?: Schema
    error?: Schema
    // ... other fields
  }
}

// Example protocol
const myProtocol = {
  getUser: {
    type: 'request',
    param: {
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: ['userId'],
    } as const satisfies Schema,
    result: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    } as const satisfies Schema,
  },
} as const satisfies ProtocolDefinition

// Server/client use validators from these schemas
```

### Schema + Token Integration

Token package uses schemas for header and payload validation:

```typescript
import { assertType, isType, createValidator } from '@enkaku/schema'
import { b64uToJSON, fromB64U } from '@enkaku/codec'
import {
  validateSignedHeader,
  validateSignedPayload,
  validateUnsignedHeader,
} from '@enkaku/token/schemas'

// Token package defines schemas for JWT-like tokens
const signedHeaderSchema = {
  type: 'object',
  properties: {
    alg: { type: 'string', enum: ['ES256', 'ES384', 'ES512'] },
    typ: { type: 'string', const: 'JWT' },
  },
  required: ['alg', 'typ'],
} as const

const validateSignedHeader = createValidator(signedHeaderSchema)

// Used in token verification
function parseToken(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split('.')

  const header = b64uToJSON(encodedHeader)

  if (isType(validateSignedHeader, header)) {
    // Handle signed token
    return { type: 'signed', header, payload: encodedPayload, signature }
  }

  if (isType(validateUnsignedHeader, header)) {
    // Handle unsigned token
    return { type: 'unsigned', header, payload: encodedPayload }
  }

  throw new Error('Invalid token header')
}
```

### Codec + Token Integration

Codec package provides encoding for token components:

```typescript
import { b64uFromJSON, b64uToJSON, toB64U, fromB64U } from '@enkaku/codec'

// Token creation uses canonical JSON encoding
function createTokenString(header: object, payload: object, signature: Uint8Array): string {
  // Canonical encoding ensures deterministic signatures
  const encodedHeader = b64uFromJSON(header, true)    // canonical: true
  const encodedPayload = b64uFromJSON(payload, true)  // canonical: true
  const encodedSignature = toB64U(signature)

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

// Token parsing uses codec for decoding
function parseTokenString(token: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')

  return {
    header: b64uToJSON(encodedHeader),
    payload: b64uToJSON(encodedPayload),
    signature: fromB64U(encodedSignature),
    data: `${encodedHeader}.${encodedPayload}`, // For signature verification
  }
}
```

### Schema + Server Integration

Server uses schemas to validate incoming messages:

```typescript
import { createValidator, assertType } from '@enkaku/schema'
import type { ProtocolDefinition } from '@enkaku/protocol'

// Server validates messages against protocol schemas
function createHandlers(protocol: ProtocolDefinition) {
  const validators = new Map()

  for (const [name, definition] of Object.entries(protocol)) {
    if (definition.param) {
      validators.set(`${name}:param`, createValidator(definition.param))
    }
    if (definition.result) {
      validators.set(`${name}:result`, createValidator(definition.result))
    }
  }

  return {
    validateParam(procedureName: string, param: unknown) {
      const validator = validators.get(`${procedureName}:param`)
      if (validator) {
        assertType(validator, param)
      }
    },
    validateResult(procedureName: string, result: unknown) {
      const validator = validators.get(`${procedureName}:result`)
      if (validator) {
        assertType(validator, result)
      }
    },
  }
}
```

## API Quick Reference

### @enkaku/schema

```typescript
// Types
type Schema = Exclude<JSONSchema, boolean>
type FromSchema<S extends Schema> = /* inferred type */
type Validator<T> = (value: unknown) => StandardSchemaV1.Result<T>

// Validator creation
createValidator<S extends Schema, T = FromSchema<S>>(schema: S): Validator<T>
createStandardValidator<S extends Schema, T = FromSchema<S>>(schema: S): StandardSchemaV1<T>
toStandardValidator<T>(validator: Validator<T>): StandardSchemaV1<T>

// Validation functions
assertType<T>(validator: Validator<T>, value: unknown): asserts value is T
asType<T>(validator: Validator<T>, value: unknown): T
isType<T>(validator: Validator<T>, value: unknown): value is T

// Schema utilities
resolveReference(root: Schema, ref: string): Schema
resolveSchema(root: Schema, schema: Schema): Schema

// Error types
class ValidationError extends AggregateError implements StandardSchemaV1.FailureResult {
  schema: Schema
  value: unknown
  issues: ReadonlyArray<ValidationErrorObject>
}

class ValidationErrorObject extends Error implements StandardSchemaV1.Issue {
  path: ReadonlyArray<string>
  details: ErrorObject // AJV error details
}

// Standard Schema types
type StandardSchemaV1<T> = {
  '~standard': {
    version: 1
    vendor: 'enkaku'
    validate: Validator<T>
  }
}

type StandardSchemaV1.Result<T> =
  | { value: T }
  | ValidationError

type StandardSchemaV1.Issue = {
  path: ReadonlyArray<string>
  message: string
}
```

### @enkaku/codec

```typescript
// Base64 encoding (standard with padding)
toB64(bytes: Uint8Array): string
fromB64(base64: string): Uint8Array

// Base64URL encoding (URL-safe, no padding)
toB64U(bytes: Uint8Array): string
fromB64U(base64url: string): Uint8Array

// UTF-8 encoding
fromUTF(value: string): Uint8Array
toUTF(bytes: Uint8Array): string

// Combined UTF-8 + Base64URL
b64uFromUTF(value: string): string
b64uToUTF(base64url: string): string

// JSON encoding
b64uFromJSON(value: Record<string, unknown>, canonicalize?: boolean): string
b64uToJSON<T = Record<string, unknown>>(base64url: string): T

// Canonical JSON
canonicalStringify(value: unknown): string
```

## Scenarios

### Scenario 1: Type-Safe API Gateway

**Goal**: Build API gateway that validates all requests/responses with type safety

```typescript
import { createValidator, ValidationError, assertType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'

// Define service schema
type ServiceSchema = {
  [endpoint: string]: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: Schema
    body?: Schema
    response: Schema
  }
}

const userServiceSchema = {
  '/users': {
    method: 'GET',
    query: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100 },
        filter: { type: 'string' },
      },
      additionalProperties: false,
    } as const,
    response: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['id', 'name', 'email'],
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['users', 'total', 'page'],
      additionalProperties: false,
    } as const,
  },
  '/users/:id': {
    method: 'GET',
    response: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'name', 'email', 'createdAt'],
      additionalProperties: false,
    } as const,
  },
  '/users': {
    method: 'POST',
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
      },
      required: ['name', 'email', 'password'],
      additionalProperties: false,
    } as const,
    response: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id', 'name', 'email'],
      additionalProperties: false,
    } as const,
  },
} as const satisfies ServiceSchema

// Build validator registry
type ValidatorRegistry = Map<string, {
  queryValidator?: ReturnType<typeof createValidator>
  bodyValidator?: ReturnType<typeof createValidator>
  responseValidator: ReturnType<typeof createValidator>
}>

function buildValidators(schema: ServiceSchema): ValidatorRegistry {
  const registry: ValidatorRegistry = new Map()

  for (const [endpoint, definition] of Object.entries(schema)) {
    const key = `${definition.method} ${endpoint}`

    registry.set(key, {
      queryValidator: definition.query ? createValidator(definition.query) : undefined,
      bodyValidator: definition.body ? createValidator(definition.body) : undefined,
      responseValidator: createValidator(definition.response),
    })
  }

  return registry
}

const validators = buildValidators(userServiceSchema)

// Gateway middleware
type Request = {
  method: string
  path: string
  query: Record<string, unknown>
  body: unknown
}

type Response = {
  status: number
  body: unknown
}

async function gatewayHandler(request: Request): Promise<Response> {
  const key = `${request.method} ${request.path}`
  const validator = validators.get(key)

  if (!validator) {
    return { status: 404, body: { error: 'Endpoint not found' } }
  }

  // Validate query
  if (validator.queryValidator) {
    const result = validator.queryValidator(request.query)
    if (result instanceof ValidationError) {
      return {
        status: 400,
        body: {
          error: 'Invalid query parameters',
          details: result.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      }
    }
  }

  // Validate body
  if (validator.bodyValidator) {
    const result = validator.bodyValidator(request.body)
    if (result instanceof ValidationError) {
      return {
        status: 400,
        body: {
          error: 'Invalid request body',
          details: result.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      }
    }
  }

  try {
    // Forward to service
    const serviceResponse = await forwardToService(request)

    // Validate response
    const result = validator.responseValidator(serviceResponse)
    if (result instanceof ValidationError) {
      console.error('Service returned invalid response:', result)
      return {
        status: 500,
        body: { error: 'Internal server error' },
      }
    }

    return { status: 200, body: result.value }
  } catch (error) {
    console.error('Service error:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
}

// Type-safe client
type ExtractResponse<T extends ServiceSchema, K extends keyof T> =
  T[K] extends { response: infer R extends Schema } ? FromSchema<R> : never

async function getUsers(
  query: FromSchema<typeof userServiceSchema['/users']['query']>
): Promise<ExtractResponse<typeof userServiceSchema, '/users'>> {
  const response = await fetch(`/users?${new URLSearchParams(query as any)}`)
  const data = await response.json()

  const validator = validators.get('GET /users')?.responseValidator
  assertType(validator!, data)

  return data
}

// Usage with type safety
const usersData = await getUsers({ page: 1, limit: 20 })
console.log(`Found ${usersData.total} users`)
usersData.users.forEach((user) => {
  console.log(`${user.name} <${user.email}>`)
})
```

### Scenario 2: Configuration Management System

**Goal**: Multi-environment configuration with validation and type safety

```typescript
import { createValidator, ValidationError, assertType, isType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'

// Base config schema
const baseConfigSchema = {
  type: 'object',
  properties: {
    appName: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    environment: { type: 'string', enum: ['development', 'staging', 'production'] },
  },
  required: ['appName', 'version', 'environment'],
  additionalProperties: false,
} as const satisfies Schema

// Server config schema
const serverConfigSchema = {
  type: 'object',
  properties: {
    port: { type: 'number', minimum: 1, maximum: 65535 },
    host: { type: 'string' },
    workers: { type: 'number', minimum: 1, maximum: 64 },
    timeout: { type: 'number', minimum: 0 },
  },
  required: ['port', 'host'],
  additionalProperties: false,
} as const satisfies Schema

// Database config schema with environment-specific validation
const databaseConfigSchema = {
  type: 'object',
  properties: {
    host: { type: 'string' },
    port: { type: 'number', minimum: 1, maximum: 65535 },
    database: { type: 'string', minLength: 1 },
    user: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
    ssl: { type: 'boolean' },
    pool: {
      type: 'object',
      properties: {
        min: { type: 'number', minimum: 0 },
        max: { type: 'number', minimum: 1 },
        idle: { type: 'number', minimum: 0 },
      },
      required: ['min', 'max'],
      additionalProperties: false,
    },
  },
  required: ['host', 'port', 'database', 'user', 'password'],
  additionalProperties: false,
} as const satisfies Schema

// Complete config schema
const configSchema = {
  type: 'object',
  properties: {
    base: baseConfigSchema,
    server: serverConfigSchema,
    database: databaseConfigSchema,
  },
  required: ['base', 'server', 'database'],
  additionalProperties: false,
} as const satisfies Schema

type Config = FromSchema<typeof configSchema>
type Environment = 'development' | 'staging' | 'production'

const validateConfig = createValidator(configSchema)

// Environment-specific validation rules
function validateEnvironmentRules(config: Config): void {
  const env = config.base.environment

  // Production-specific rules
  if (env === 'production') {
    if (!config.database.ssl) {
      throw new Error('Production environment requires SSL for database')
    }

    if (config.database.pool.max < 10) {
      throw new Error('Production requires minimum pool size of 10')
    }

    if (config.server.port === 3000) {
      throw new Error('Production should not use default port 3000')
    }
  }

  // Development-specific rules
  if (env === 'development') {
    if (config.server.host !== 'localhost' && config.server.host !== '127.0.0.1') {
      console.warn('Development environment should typically use localhost')
    }
  }
}

// Load config from multiple sources
async function loadConfig(environment: Environment): Promise<Config> {
  // Load base config
  const baseConfig = await loadJSONFile(`./config/base.json`)

  // Load environment-specific overrides
  const envConfig = await loadJSONFile(`./config/${environment}.json`)

  // Merge configs
  const merged = deepMerge(baseConfig, envConfig)

  // Validate structure
  const result = validateConfig(merged)

  if (result instanceof ValidationError) {
    console.error(`Configuration validation failed for ${environment}:`)

    for (const issue of result.issues) {
      const path = issue.path.join('.')
      console.error(`  × ${path}: ${issue.message}`)
    }

    throw new Error('Invalid configuration')
  }

  const config = result.value

  // Validate environment-specific rules
  validateEnvironmentRules(config)

  return config
}

// Type-safe config access
class ConfigManager {
  private config: Config

  constructor(config: Config) {
    this.config = config
  }

  get appName(): string {
    return this.config.base.appName
  }

  get version(): string {
    return this.config.base.version
  }

  get environment(): Environment {
    return this.config.base.environment as Environment
  }

  get serverPort(): number {
    return this.config.server.port
  }

  get serverHost(): string {
    return this.config.server.host
  }

  get databaseURL(): string {
    const db = this.config.database
    const protocol = db.ssl ? 'postgresql+ssl' : 'postgresql'
    return `${protocol}://${db.user}:${db.password}@${db.host}:${db.port}/${db.database}`
  }

  get databasePoolConfig() {
    return this.config.database.pool
  }

  isProduction(): boolean {
    return this.environment === 'production'
  }

  isDevelopment(): boolean {
    return this.environment === 'development'
  }
}

// Usage
const config = await loadConfig('production')
const manager = new ConfigManager(config)

console.log(`Starting ${manager.appName} v${manager.version}`)
console.log(`Environment: ${manager.environment}`)
console.log(`Server: ${manager.serverHost}:${manager.serverPort}`)
console.log(`Database: ${manager.databaseURL}`)

if (manager.isProduction()) {
  console.log('Running in production mode')
}
```

### Scenario 3: Data Migration Pipeline

**Goal**: Validate data transformations in multi-step migration pipeline

```typescript
import { createValidator, ValidationError, assertType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'

// Legacy data format
const legacyUserSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'number' },
    full_name: { type: 'string' },
    email_address: { type: 'string' },
    signup_date: { type: 'string' },
    is_active: { type: 'number', enum: [0, 1] },
    user_type: { type: 'string', enum: ['regular', 'premium', 'admin'] },
  },
  required: ['user_id', 'full_name', 'email_address'],
  additionalProperties: true, // Legacy data may have extra fields
} as const satisfies Schema

// New data format
const newUserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^user_[0-9]+$' },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
    active: { type: 'boolean' },
    role: { type: 'string', enum: ['user', 'premium', 'admin'] },
    metadata: {
      type: 'object',
      properties: {
        migratedAt: { type: 'string', format: 'date-time' },
        legacyId: { type: 'number' },
      },
      required: ['migratedAt', 'legacyId'],
      additionalProperties: false,
    },
  },
  required: ['id', 'name', 'email', 'createdAt', 'active', 'role', 'metadata'],
  additionalProperties: false,
} as const satisfies Schema

type LegacyUser = FromSchema<typeof legacyUserSchema>
type NewUser = FromSchema<typeof newUserSchema>

const validateLegacyUser = createValidator(legacyUserSchema)
const validateNewUser = createValidator(newUserSchema)

// Migration transformation
function transformUser(legacy: LegacyUser): NewUser {
  return {
    id: `user_${legacy.user_id}`,
    name: legacy.full_name,
    email: legacy.email_address,
    createdAt: new Date(legacy.signup_date || Date.now()).toISOString(),
    active: legacy.is_active === 1,
    role: legacy.user_type === 'regular' ? 'user' : legacy.user_type,
    metadata: {
      migratedAt: new Date().toISOString(),
      legacyId: legacy.user_id,
    },
  }
}

// Migration pipeline
type MigrationStats = {
  total: number
  success: number
  validationFailed: number
  transformFailed: number
  errors: Array<{
    legacyId?: number
    phase: 'validation' | 'transform' | 'output'
    error: string
  }>
}

async function migrateUsers(
  legacyUsers: Array<unknown>
): Promise<{ users: Array<NewUser>; stats: MigrationStats }> {
  const stats: MigrationStats = {
    total: legacyUsers.length,
    success: 0,
    validationFailed: 0,
    transformFailed: 0,
    errors: [],
  }

  const migratedUsers: Array<NewUser> = []

  for (const rawUser of legacyUsers) {
    try {
      // Step 1: Validate legacy format
      const validationResult = validateLegacyUser(rawUser)

      if (validationResult instanceof ValidationError) {
        stats.validationFailed++
        stats.errors.push({
          legacyId: (rawUser as any).user_id,
          phase: 'validation',
          error: validationResult.issues.map((i) => i.message).join(', '),
        })
        continue
      }

      const legacyUser = validationResult.value

      // Step 2: Transform to new format
      let newUser: NewUser
      try {
        newUser = transformUser(legacyUser)
      } catch (error) {
        stats.transformFailed++
        stats.errors.push({
          legacyId: legacyUser.user_id,
          phase: 'transform',
          error: error instanceof Error ? error.message : 'Unknown transform error',
        })
        continue
      }

      // Step 3: Validate new format
      const outputResult = validateNewUser(newUser)

      if (outputResult instanceof ValidationError) {
        stats.transformFailed++
        stats.errors.push({
          legacyId: legacyUser.user_id,
          phase: 'output',
          error: outputResult.issues.map((i) => i.message).join(', '),
        })
        continue
      }

      migratedUsers.push(outputResult.value)
      stats.success++

    } catch (error) {
      stats.transformFailed++
      stats.errors.push({
        legacyId: (rawUser as any).user_id,
        phase: 'transform',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { users: migratedUsers, stats }
}

// Batch migration with progress
async function runMigration() {
  console.log('Starting user migration...')

  // Load legacy users from database
  const legacyUsers = await loadLegacyUsers()

  console.log(`Loaded ${legacyUsers.length} legacy users`)

  // Run migration
  const { users, stats } = await migrateUsers(legacyUsers)

  // Report results
  console.log('\nMigration completed:')
  console.log(`  Total: ${stats.total}`)
  console.log(`  Success: ${stats.success}`)
  console.log(`  Validation failed: ${stats.validationFailed}`)
  console.log(`  Transform failed: ${stats.transformFailed}`)

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    for (const error of stats.errors.slice(0, 10)) {
      console.log(`  User ${error.legacyId || 'unknown'} (${error.phase}): ${error.error}`)
    }

    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`)
    }
  }

  // Save migrated users
  if (users.length > 0) {
    console.log(`\nSaving ${users.length} migrated users...`)
    await saveNewUsers(users)
    console.log('Migration successful!')
  }

  // Save error report
  if (stats.errors.length > 0) {
    await saveErrorReport(stats.errors)
    console.log('Error report saved to migration-errors.json')
  }
}

async function loadLegacyUsers(): Promise<Array<unknown>> {
  // Load from database
  return []
}

async function saveNewUsers(users: Array<NewUser>): Promise<void> {
  // Save to new database
}

async function saveErrorReport(errors: MigrationStats['errors']): Promise<void> {
  // Save error report
}

// Run migration
runMigration().catch(console.error)
```

## Troubleshooting

### Schema validation failing unexpectedly

**Problem**: Valid data failing validation

**Solution**: Check schema constraints and AJV formats

```typescript
import { createValidator, ValidationError } from '@enkaku/schema'

const schema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' }, // Requires ajv-formats
    date: { type: 'string', format: 'date-time' },
  },
} as const

const validate = createValidator(schema)

const data = {
  email: 'user@example.com',
  date: '2024-01-01T00:00:00Z', // Must be valid ISO 8601
}

const result = validate(data)

if (result instanceof ValidationError) {
  // Check which field failed
  for (const issue of result.issues) {
    console.log('Field:', issue.path.join('.'))
    console.log('Keyword:', issue.details.keyword)
    console.log('Message:', issue.message)

    // Check if format validation failed
    if (issue.details.keyword === 'format') {
      console.log('Invalid format:', issue.details.params)
    }
  }
}
```

### FromSchema type not inferring correctly

**Problem**: Generated TypeScript type doesn't match schema

**Solution**: Use `as const` assertion and satisfies

```typescript
import type { Schema, FromSchema } from '@enkaku/schema'

// BAD: No type inference
const schema1 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
}
type Type1 = FromSchema<typeof schema1> // Doesn't work well

// GOOD: Use as const
const schema2 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
} as const satisfies Schema

type Type2 = FromSchema<typeof schema2> // { name?: string }

// Enum support
const schema3 = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ['admin', 'user'] },
  },
} as const satisfies Schema

type Type3 = FromSchema<typeof schema3> // { role?: 'admin' | 'user' }
```

### Base64 decoding errors

**Problem**: fromB64 or fromB64U throwing errors

**Solution**: Ensure correct encoding format

```typescript
import { toB64, fromB64, toB64U, fromB64U } from '@enkaku/codec'

const data = new Uint8Array([1, 2, 3])

// Standard Base64 has padding
const base64 = toB64(data)  // "AQID"
fromB64(base64) // OK

// Base64URL has no padding
const base64url = toB64U(data)  // "AQID" (no padding)
fromB64U(base64url) // OK

// Don't mix formats
fromB64(base64url) // May fail
fromB64U(base64)   // May fail

// URL-safe chars
const dataWithSpecial = new Uint8Array([255, 255, 255])
const std = toB64(dataWithSpecial)  // Contains + or /
const url = toB64U(dataWithSpecial) // Uses - and _ instead
```

### Canonical JSON not deterministic

**Problem**: Same object producing different canonical strings

**Solution**: Ensure no undefined values or functions

```typescript
import { canonicalStringify } from '@enkaku/codec'

// GOOD: Plain data
const data1 = { b: 2, a: 1, c: 3 }
const canonical1 = canonicalStringify(data1)
// Always: {"a":1,"b":2,"c":3}

// BAD: undefined values
const data2 = { b: 2, a: undefined, c: 3 }
const canonical2 = canonicalStringify(data2)
// undefined is omitted, may cause inconsistency

// BAD: Functions
const data3 = { b: 2, a: () => {}, c: 3 }
// Functions not supported

// SOLUTION: Clean data before canonicalizing
function cleanForCanonical(obj: any): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj)) // Removes undefined, functions
}

const cleaned = cleanForCanonical(data2)
const canonical = canonicalStringify(cleaned)
```

### Validation errors not descriptive enough

**Problem**: Hard to understand what validation failed

**Solution**: Use issue details and path

```typescript
import { createValidator, ValidationError } from '@enkaku/schema'

const validate = createValidator({
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        age: { type: 'number', minimum: 18 },
      },
      required: ['name', 'age'],
    },
  },
  required: ['user'],
})

const result = validate({ user: { name: '', age: 15 } })

if (result instanceof ValidationError) {
  // Format detailed error message
  const errors = result.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
    const params = issue.details.params

    let message = `${path}: ${issue.message}`

    // Add parameter details
    if (params) {
      if (params.limit !== undefined) {
        message += ` (limit: ${params.limit})`
      }
      if (params.comparison !== undefined) {
        message += ` (${params.comparison})`
      }
    }

    return message
  })

  console.error('Validation failed:')
  errors.forEach((err) => console.error(`  - ${err}`))
}

// Output:
// Validation failed:
//   - user.name: must NOT have fewer than 1 characters (limit: 1)
//   - user.age: must be >= 18 (limit: 18)
```

### Memory leak with validator creation

**Problem**: Creating validators in loops causes memory issues

**Solution**: Reuse validators, don't recreate

```typescript
import { createValidator } from '@enkaku/schema'

const schema = {
  type: 'object',
  properties: {
    value: { type: 'number' },
  },
} as const

// BAD: Creating validator in loop
function processItems(items: Array<unknown>) {
  for (const item of items) {
    const validate = createValidator(schema) // Creates new AJV instance each time
    validate(item)
  }
}

// GOOD: Create validator once
const validate = createValidator(schema)

function processItemsCorrectly(items: Array<unknown>) {
  for (const item of items) {
    validate(item) // Reuses validator
  }
}

// BETTER: Create validators at module level
const VALIDATORS = {
  item: createValidator(schema),
  // ... other validators
}

function processItemsBest(items: Array<unknown>) {
  for (const item of items) {
    VALIDATORS.item(item)
  }
}
```
