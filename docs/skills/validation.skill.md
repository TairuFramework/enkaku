---
name: enkaku:validation
description: Schema validation, type generation, and encoding/decoding patterns
---

# Enkaku Schema & Validation

## Packages in This Domain

**JSON Schema Validation**: `@enkaku/schema`

**Encoding/Decoding**: `@enkaku/codec`

## Key Patterns

### Pattern 1: Define Schema with Type Generation

```typescript
import type { Schema, FromSchema } from '@enkaku/schema'

// Define schema with type safety
const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 18, maximum: 120 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['admin', 'user', 'guest'] },
  },
  required: ['name', 'email'],
  additionalProperties: false,
} as const satisfies Schema

// Generate TypeScript type from schema
type User = FromSchema<typeof userSchema>
// Result: { name: string; age?: number; email: string; role?: 'admin' | 'user' | 'guest' }
```

**Use case**: Define data shapes once, use everywhere with compile-time and runtime safety

**Key points**:
- `Schema` type ensures valid JSON Schema definition
- `as const` assertion required for type inference
- `FromSchema` generates TypeScript type from schema
- Supports all JSON Schema features: required, optional, enums, formats
- Type generation respects constraints (enums become literal unions)

### Pattern 2: Runtime Validation with Validators

```typescript
import { createValidator, assertType, isType, asType } from '@enkaku/schema'
import type { Schema, FromSchema } from '@enkaku/schema'

const configSchema = {
  type: 'object',
  properties: {
    port: { type: 'number', minimum: 1, maximum: 65535 },
    host: { type: 'string' },
    debug: { type: 'boolean' },
  },
  required: ['port', 'host'],
  additionalProperties: false,
} as const satisfies Schema

type Config = FromSchema<typeof configSchema>

// Create validator function
const validateConfig = createValidator<typeof configSchema, Config>(configSchema)

// Three validation approaches:

// 1. Type guard: Returns boolean
const data1: unknown = { port: 3000, host: 'localhost', debug: true }
if (isType(validateConfig, data1)) {
  // data1 is now typed as Config
  console.log(data1.port) // TypeScript knows this exists
}

// 2. Assertion: Throws on failure
const data2: unknown = { port: 8080, host: '0.0.0.0' }
assertType(validateConfig, data2)
// data2 is now asserted as Config
console.log(data2.host)

// 3. Convert and assert: Returns typed value
const data3: unknown = { port: 5000, host: 'example.com' }
const config: Config = asType(validateConfig, data3)
```

**Use case**: Validate untrusted input, parse configuration, enforce data contracts

**Key points**:
- `createValidator()` builds reusable validator from schema
- Returns Standard Schema v1 Result type
- `isType()` for type guards (non-throwing)
- `assertType()` for assertions (throws ValidationError)
- `asType()` combines assertion with return
- Validates and narrows types simultaneously

### Pattern 3: Validation Error Handling

```typescript
import { createValidator, ValidationError, ValidationErrorObject } from '@enkaku/schema'
import type { Schema } from '@enkaku/schema'

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[A-Z0-9-]+$' },
    price: { type: 'number', minimum: 0 },
    inStock: { type: 'boolean' },
  },
  required: ['id', 'price', 'inStock'],
  additionalProperties: false,
} as const satisfies Schema

const validateProduct = createValidator(productSchema)

const invalidData = {
  id: 'invalid id!', // Contains invalid characters
  price: -10,        // Below minimum
  extra: 'field',    // Not allowed
}

const result = validateProduct(invalidData)

if (result instanceof ValidationError) {
  console.log('Schema:', result.schema.$id || result.schema.type)
  console.log('Invalid value:', result.value)

  // Iterate through all validation issues
  for (const issue of result.issues) {
    console.log('Path:', issue.path.join('.'))
    console.log('Message:', issue.message)
    console.log('Details:', issue.details)
  }

  // Access AJV error details
  const firstIssue = result.issues[0] as ValidationErrorObject
  console.log('Keyword:', firstIssue.details.keyword)
  console.log('Schema path:', firstIssue.details.schemaPath)
}
```

**Use case**: Detailed error reporting, API validation responses, debugging

**Key points**:
- `ValidationError` is AggregateError with multiple issues
- Each issue is `ValidationErrorObject` implementing Standard Schema Issue
- Includes path to invalid field (e.g., `['user', 'address', 'zip']`)
- Exposes AJV ErrorObject details for schema keywords
- Schema and value preserved for debugging
- All errors collected (not fail-fast)

### Pattern 4: Base64 Encoding for Binary Data

```typescript
import { toB64, fromB64, toB64U, fromB64U } from '@enkaku/codec'
import { fromUTF, toUTF, b64uFromUTF, b64uToUTF } from '@enkaku/codec'

// Standard Base64 encoding
const data = new Uint8Array([104, 101, 108, 108, 111]) // "hello"
const encoded = toB64(data)  // "aGVsbG8="
const decoded = fromB64(encoded) // Uint8Array([104, 101, 108, 108, 111])

// URL-safe Base64 encoding (no padding, URL-safe chars)
const urlEncoded = toB64U(data)  // "aGVsbG8" (no padding)
const urlDecoded = fromB64U(urlEncoded)

// UTF-8 string to bytes and back
const text = "Hello, world!"
const bytes = fromUTF(text)  // Uint8Array
const recovered = toUTF(bytes) // "Hello, world!"

// Direct UTF-8 to Base64URL
const encoded64 = b64uFromUTF("Hello!") // "SGVsbG8h"
const decoded64 = b64uToUTF(encoded64)   // "Hello!"
```

**Use case**: JWT tokens, binary data in JSON, URL-safe encoding, cryptographic signatures

**Key points**:
- `toB64/fromB64` for standard Base64 with padding
- `toB64U/fromB64U` for URL-safe Base64 (RFC 4648 §5)
- `fromUTF/toUTF` for UTF-8 ↔ Uint8Array conversion
- `b64uFromUTF/b64uToUTF` for direct string ↔ Base64URL
- Handles Unicode correctly via TextEncoder/TextDecoder
- Used extensively in token package

### Pattern 5: JSON Canonicalization and Encoding

```typescript
import { b64uFromJSON, b64uToJSON } from '@enkaku/codec'
import { canonicalStringify } from '@enkaku/codec'

type Payload = {
  iss: string
  sub: string
  exp: number
  data: Record<string, unknown>
}

// Encode JSON to Base64URL with canonical ordering
const payload: Payload = {
  sub: 'user123',
  iss: 'https://auth.example.com',
  exp: 1234567890,
  data: { role: 'admin' }
}

// Canonical encoding (keys sorted, deterministic)
const canonical = b64uFromJSON(payload, true)
// Result is deterministic - same input always produces same output

// Non-canonical encoding (fast, order not guaranteed)
const fast = b64uFromJSON(payload, false)

// Decode back to object
const decoded = b64uToJSON<Payload>(canonical)
console.log(decoded.iss) // "https://auth.example.com"

// Direct canonical stringify (for signatures)
const canonicalJson = canonicalStringify(payload)
// Always produces same string for same data
```

**Use case**: JWT token payloads, cryptographic signatures, content addressing

**Key points**:
- `b64uFromJSON()` encodes object to Base64URL string
- Canonical mode uses RFC 8785 (deterministic JSON)
- Canonical ensures same data = same encoding (critical for signatures)
- `b64uToJSON()` decodes and parses in one step
- Generic type parameter for type-safe decoding
- Used by token package for signed payloads

## When to Use What

**Use @enkaku/schema** when:
- Validating untrusted input (API requests, user input, config files)
- Defining protocol message shapes
- Need compile-time AND runtime type safety
- Generating TypeScript types from schemas
- Building type-safe APIs with validation
- Integrating with Standard Schema ecosystem

**Use @enkaku/codec** when:
- Encoding binary data for JSON/URLs
- Building JWT-like token systems
- Need deterministic JSON encoding for signatures
- Converting between UTF-8 strings and bytes
- Working with cryptographic operations
- Transmitting binary data over text protocols

## Related Domains

- See `/enkaku:protocol` for protocol schema definitions
- See `/enkaku:security` for token validation using schemas
- See `/enkaku:transport` for message validation
- See `/enkaku:execution` for handler parameter validation

## Detailed Reference

For complete API documentation, Standard Schema integration, and advanced patterns: `docs/capabilities/domains/validation.md`
