# Securing Endpoints

## Goal

Learn how to secure your Enkaku RPC endpoints with token-based authentication by implementing a protected API service. You'll set up server-side key management with keystores, generate and verify tokens, implement access control rules, sign client requests, and protect sensitive endpoints from unauthorized access.

## Prerequisites

Install the required packages:

```bash
pnpm add @enkaku/protocol @enkaku/server @enkaku/http-server-transport
pnpm add @enkaku/client @enkaku/http-client-transport
pnpm add @enkaku/token @enkaku/node-keystore @enkaku/browser-keystore
```

## Step-by-Step Implementation

### Step 1: Set Up Server Key Management

Configure secure key storage for the server using the platform-appropriate keystore. This key will be used to verify client tokens.

```typescript
// server/keystore.ts
import { NodeKeyStore, provideFullIdentityAsync } from '@enkaku/node-keystore'

// Open keystore (uses OS credential manager)
// macOS: Keychain, Windows: Credential Manager, Linux: Secret Service
const keystore = NodeKeyStore.open('my-secure-app')

// Get or create server's identity
// This creates a persistent key that survives server restart
export const serverIdentity = await provideFullIdentityAsync(keystore, 'server-key')

// Server's DID (Decentralized Identifier) - share with clients
export const serverDID = serverIdentity.id
console.log('Server DID:', serverDID)
// Example output: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

**Key points:**
- `NodeKeyStore.open()` creates or opens a keystore with a service name
- Keys are stored securely in OS-level credential storage
- `provideFullIdentityAsync()` retrieves existing key or generates new one
- Server's DID contains its public key - clients use this for `aud` field
- Same key persists across server restarts

### Step 2: Define Protected Protocol

Create a protocol with a mix of public and protected endpoints.

```typescript
// shared/protocol.ts
import type { ProtocolDefinition } from '@enkaku/protocol'

export const apiProtocol = {
  // Public endpoint - no authentication required
  'public/status': {
    type: 'request',
    result: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        version: { type: 'string' }
      },
      required: ['status', 'version'],
      additionalProperties: false
    }
  },

  // Protected endpoint - requires authentication
  'user/profile': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' }
      },
      required: ['userId', 'name', 'email', 'role'],
      additionalProperties: false
    }
  },

  // Admin-only endpoint - requires specific DID
  'admin/deleteUser': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        userId: { type: 'string' }
      },
      required: ['userId'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      },
      required: ['success', 'message'],
      additionalProperties: false
    }
  },

  // Resource-specific access
  'documents/get': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        documentId: { type: 'string' }
      },
      required: ['documentId'],
      additionalProperties: false
    },
    result: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        ownerId: { type: 'string' }
      },
      required: ['documentId', 'title', 'content', 'ownerId'],
      additionalProperties: false
    }
  }
} as const satisfies ProtocolDefinition

export type ApiProtocol = typeof apiProtocol
```

**Key points:**
- Mix of public and protected endpoints in single protocol
- Access control defined at server level, not in protocol
- Use descriptive procedure names to indicate access level
- Protocol defines data structure, not security rules

### Step 3: Implement Server with Access Control

Set up the server with authentication and define which endpoints require which level of access.

```typescript
// server/index.ts
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import { apiProtocol, type ApiProtocol } from '../shared/protocol'
import { serverIdentity, serverDID } from './keystore'

// Admin DIDs - only these can call admin endpoints
const ADMIN_DIDS = [
  'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  // Add more admin DIDs here
]

// Mock database
type User = {
  userId: string
  name: string
  email: string
  role: string
}

const users = new Map<string, User>([
  ['user-1', { userId: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'user' }],
  ['user-2', { userId: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'admin' }]
])

const documents = new Map([
  ['doc-1', { documentId: 'doc-1', title: 'Public Doc', content: 'Content', ownerId: 'user-1' }],
  ['doc-2', { documentId: 'doc-2', title: 'Private Doc', content: 'Secret', ownerId: 'user-2' }]
])

// Create transport
const transport = new ServerTransport<ApiProtocol>({
  allowedOrigin: ['http://localhost:3000', 'https://myapp.com']
})

// Create server with authentication
const server = new Server<ApiProtocol>({
  protocol: apiProtocol,
  transport,
  identity: serverIdentity, // Server's identity for verification

  // Access control configuration
  access: {
    '*': false, // Default: all endpoints require authentication
    'public/status': true, // Public endpoint - no auth required
    'admin/deleteUser': ADMIN_DIDS, // Only specific DIDs allowed
    // 'user/profile' and 'documents/get' require auth but allow any authenticated user
  },

  handlers: {
    // Public handler - no token verification
    'public/status': async () => {
      return {
        status: 'ok',
        version: '1.0.0'
      }
    },

    // Protected handler - token verified automatically
    'user/profile': async ({ param, message }) => {
      // message.token contains the verified token
      const clientDID = message.token?.payload.iss

      if (!clientDID) {
        throw new Error('Authentication required')
      }

      console.log(`User profile requested by: ${clientDID}`)

      const user = users.get(param.userId)

      if (!user) {
        throw new Error(`User not found: ${param.userId}`)
      }

      return user
    },

    // Admin handler - only called if client DID is in ADMIN_DIDS
    'admin/deleteUser': async ({ param, message }) => {
      const adminDID = message.token?.payload.iss

      console.log(`Delete user requested by admin: ${adminDID}`)

      const deleted = users.delete(param.userId)

      return {
        success: deleted,
        message: deleted
          ? `User ${param.userId} deleted successfully`
          : `User ${param.userId} not found`
      }
    },

    // Resource-level authorization
    'documents/get': async ({ param, message }) => {
      const clientDID = message.token?.payload.iss

      if (!clientDID) {
        throw new Error('Authentication required')
      }

      const document = documents.get(param.documentId)

      if (!document) {
        throw new Error(`Document not found: ${param.documentId}`)
      }

      // Custom authorization: Check if client owns the document
      // In real app, maintain mapping of DID to userId
      const userMapping = new Map([
        ['did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', 'user-1'],
        ['did:key:z6MkuBLrjSGt1PPADAvuv6rmKRAmnfwyZvuD6Peo4pCYhVdK', 'user-2']
      ])

      const userId = userMapping.get(clientDID)

      if (userId !== document.ownerId) {
        throw new Error('Access denied: You do not own this document')
      }

      return document
    }
  }
})

// Start HTTP server
const httpServer = Bun.serve({
  port: 3000,
  fetch: transport.fetch
})

console.log(`Secure RPC server running on http://localhost:${httpServer.port}`)
console.log(`Server DID: ${serverDID}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  httpServer.stop()
  await server.dispose()
  process.exit(0)
})
```

**Key points:**
- `identity` parameter enables token verification
- `access` map defines per-procedure access rules
- `true` = public (no auth), `false` = any authenticated user
- Array of DIDs = only those specific identities allowed
- Server DID automatically allowed on all endpoints
- Verified token available in handler via `message.token`
- Can implement custom resource-level authorization in handlers

### Step 4: Create Authenticated Client (Node.js)

Set up a Node.js client that signs all requests with a persistent identity.

```typescript
// client/node-client.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { provideFullIdentityAsync } from '@enkaku/node-keystore'
import type { ApiProtocol } from '../shared/protocol'

async function main() {
  // Server's DID (get from server on startup or environment variable)
  const SERVER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'

  // Get or create client's identity
  const clientIdentity = await provideFullIdentityAsync('my-secure-app', 'client-key')
  console.log('Client DID:', clientIdentity.id)

  // Create transport
  const transport = new ClientTransport<ApiProtocol>({
    url: 'http://localhost:3000'
  })

  // Create authenticated client
  const client = new Client<ApiProtocol>({
    transport,
    identity: clientIdentity, // Sign all requests automatically
    serverID: SERVER_DID // Server's DID for token audience
  })

  try {
    // Call public endpoint (no auth required but still signed)
    console.log('\n1. Calling public endpoint...')
    const status = await client.request('public/status')
    console.log('Status:', status)

    // Call protected endpoint
    console.log('\n2. Calling protected endpoint...')
    const profile = await client.request('user/profile', {
      param: { userId: 'user-1' }
    })
    console.log('Profile:', profile)

    // Try to get protected document
    console.log('\n3. Accessing protected document...')
    try {
      const document = await client.request('documents/get', {
        param: { documentId: 'doc-1' }
      })
      console.log('Document:', document)
    } catch (error) {
      console.error('Access denied:', error.message)
    }

    // Try admin endpoint (will fail if not admin)
    console.log('\n4. Attempting admin action...')
    try {
      const result = await client.request('admin/deleteUser', {
        param: { userId: 'user-1' }
      })
      console.log('Admin result:', result)
    } catch (error) {
      console.error('Admin access denied:', error.message)
    }

  } finally {
    await client.dispose()
  }
}

main().catch(console.error)
```

**Key points:**
- Client stores persistent key using `NodeKeyStore`
- Same key used across all requests (stable identity)
- `identity` parameter enables automatic request signing
- `serverID` sets the audience field in tokens
- All requests signed even if endpoint is public
- Server verifies signature before calling handler

### Step 5: Create Authenticated Client (Browser)

Set up a browser client with persistent identity stored in IndexedDB.

```typescript
// client/browser-client.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { provideSigningIdentity } from '@enkaku/browser-keystore'
import type { ApiProtocol } from '../shared/protocol'

async function initClient() {
  // Server's DID (from config or API call)
  const SERVER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'

  // Get or create browser identity (stored in IndexedDB)
  const clientIdentity = await provideSigningIdentity('user-session')
  console.log('Browser Client DID:', clientIdentity.id)

  const transport = new ClientTransport<ApiProtocol>({
    url: 'https://api.example.com/rpc'
  })

  const client = new Client<ApiProtocol>({
    transport,
    identity: clientIdentity,
    serverID: SERVER_DID
  })

  return { client, clientDID: clientIdentity.id }
}

// Initialize and use client
async function main() {
  const { client, clientDID } = await initClient()

  // Display client identity
  document.getElementById('client-did')!.textContent = clientDID

  // Fetch user profile
  async function loadProfile() {
    try {
      const profile = await client.request('user/profile', {
        param: { userId: 'user-1' }
      })

      document.getElementById('profile-name')!.textContent = profile.name
      document.getElementById('profile-email')!.textContent = profile.email
      document.getElementById('profile-role')!.textContent = profile.role
    } catch (error) {
      console.error('Failed to load profile:', error)
      showError('Failed to load profile')
    }
  }

  // Load document with access control
  async function loadDocument(documentId: string) {
    try {
      const doc = await client.request('documents/get', {
        param: { documentId }
      })

      displayDocument(doc)
    } catch (error) {
      if (error.message.includes('Access denied')) {
        showError('You do not have permission to view this document')
      } else {
        showError('Failed to load document')
      }
      console.error('Document load error:', error)
    }
  }

  // Set up UI event handlers
  document.getElementById('load-profile')!.addEventListener('click', loadProfile)
  document.getElementById('load-doc-1')!.addEventListener('click', () => loadDocument('doc-1'))
  document.getElementById('load-doc-2')!.addEventListener('click', () => loadDocument('doc-2'))

  // Logout: Clear identity
  document.getElementById('logout')!.addEventListener('click', async () => {
    await client.dispose()

    // Remove key from browser keystore
    const { BrowserKeyStore } = await import('@enkaku/browser-keystore')
    const store = await BrowserKeyStore.open()
    await store.entry('user-session').removeAsync()

    location.reload()
  })
}

main().catch(console.error)
```

**Key points:**
- Browser keystore uses IndexedDB (persists across sessions)
- ES256 algorithm (P-256) for Web Crypto API compatibility
- Identity survives page refresh
- Can clear identity on logout by removing key
- Same API as Node.js client
- Keys isolated per origin (browser security)

### Step 6: Token Generation and Verification

Understand how tokens are created and verified under the hood.

```typescript
// server/token-details.ts
import { verifyToken, type SigningIdentity } from '@enkaku/token'

// Example: Manual token creation (client does this automatically)
async function createManualToken(identity: SigningIdentity, serverDID: string) {
  const token = await identity.signToken({
    aud: serverDID, // Audience: server's DID
    sub: 'user-123', // Subject: user identifier (optional)
    exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    iat: Math.floor(Date.now() / 1000), // Issued at
  })

  console.log('Token structure:')
  console.log('- Issuer (iss):', token.payload.iss) // Client's DID
  console.log('- Audience (aud):', token.payload.aud) // Server's DID
  console.log('- Subject (sub):', token.payload.sub) // User ID
  console.log('- Expires (exp):', token.payload.exp)
  console.log('- Signature:', token.signature.substring(0, 20) + '...')

  return token
}

// Example: Manual token verification (server does this automatically)
async function verifyManualToken(tokenString: string, expectedAudience: string) {
  try {
    // Verify signature using public key from token's iss (DID)
    const verified = await verifyToken(tokenString)

    console.log('Token verified successfully!')
    console.log('- Issuer:', verified.payload.iss)
    console.log('- Audience:', verified.payload.aud)

    // Check audience matches server
    if (verified.payload.aud !== expectedAudience) {
      throw new Error('Token audience does not match server ID')
    }

    // Check expiration
    if (verified.payload.exp && verified.payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired')
    }

    // Check not-before
    if (verified.payload.nbf && verified.payload.nbf > Math.floor(Date.now() / 1000)) {
      throw new Error('Token not yet valid')
    }

    return verified
  } catch (error) {
    console.error('Token verification failed:', error.message)
    throw error
  }
}
```

**Key points:**
- Tokens use JWT structure: `header.payload.signature`
- DID contains public key for verification (no key distribution needed)
- `iss` field is client's DID (issuer)
- `aud` field is server's DID (audience)
- `exp` field is expiration timestamp (seconds since epoch)
- Signature verifies token hasn't been tampered with
- Server automatically handles verification when `identity` is provided

### Step 7: Advanced Authorization Patterns

Implement complex authorization logic based on token claims and application state.

```typescript
// server/advanced-auth.ts
import type { RequestHandler } from '@enkaku/server'
import type { ApiProtocol } from '../shared/protocol'

// Map client DIDs to application user IDs
const userRegistry = new Map<string, { userId: string; role: string }>([
  ['did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
   { userId: 'user-1', role: 'admin' }],
  ['did:key:z6MkuBLrjSGt1PPADAvuv6rmKRAmnfwyZvuD6Peo4pCYhVdK',
   { userId: 'user-2', role: 'user' }]
])

// Helper: Get user from token
function getUserFromToken(message: any): { userId: string; role: string } | null {
  const clientDID = message.token?.payload.iss
  if (!clientDID) return null
  return userRegistry.get(clientDID) || null
}

// Pattern 1: Role-based access control
const roleProtectedHandler: RequestHandler<ApiProtocol, 'admin/deleteUser'> =
  async ({ param, message }) => {
    const user = getUserFromToken(message)

    if (!user) {
      throw new Error('Authentication required')
    }

    if (user.role !== 'admin') {
      throw new Error('Admin role required')
    }

    // Proceed with admin action
    console.log(`Admin ${user.userId} deleting user ${param.userId}`)
    return { success: true, message: 'User deleted' }
  }

// Pattern 2: Resource ownership check
const documentHandler: RequestHandler<ApiProtocol, 'documents/get'> =
  async ({ param, message }) => {
    const user = getUserFromToken(message)

    if (!user) {
      throw new Error('Authentication required')
    }

    const document = await getDocument(param.documentId)

    // Check ownership or admin override
    if (document.ownerId !== user.userId && user.role !== 'admin') {
      throw new Error('You do not have permission to access this document')
    }

    return document
  }

// Pattern 3: Time-based access with token expiration
const timeRestrictedHandler: RequestHandler<ApiProtocol, 'user/profile'> =
  async ({ param, message }) => {
    const token = message.token

    if (!token) {
      throw new Error('Authentication required')
    }

    // Check token expiration
    if (token.payload.exp && token.payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired - please re-authenticate')
    }

    // Check business hours (example)
    const hour = new Date().getHours()
    if (hour < 9 || hour > 17) {
      throw new Error('Service only available during business hours (9AM-5PM)')
    }

    return await getUserProfile(param.userId)
  }

// Pattern 4: Rate limiting per DID
const rateLimiters = new Map<string, { count: number; resetAt: number }>()

const rateLimitedHandler: RequestHandler<ApiProtocol, 'user/profile'> =
  async ({ param, message }) => {
    const clientDID = message.token?.payload.iss

    if (!clientDID) {
      throw new Error('Authentication required')
    }

    const now = Date.now()
    const limit = rateLimiters.get(clientDID)

    // Reset rate limit every minute
    if (!limit || limit.resetAt < now) {
      rateLimiters.set(clientDID, { count: 1, resetAt: now + 60000 })
    } else if (limit.count >= 10) {
      throw new Error('Rate limit exceeded - please try again later')
    } else {
      limit.count++
    }

    return await getUserProfile(param.userId)
  }

// Helpers
async function getDocument(documentId: string) {
  // Fetch from database
  return {
    documentId,
    title: 'Document',
    content: 'Content',
    ownerId: 'user-1'
  }
}

async function getUserProfile(userId: string) {
  // Fetch from database
  return {
    userId,
    name: 'Alice',
    email: 'alice@example.com',
    role: 'user'
  }
}
```

**Key points:**
- Map client DIDs to application user accounts
- Implement role-based access control (RBAC)
- Check resource ownership in handlers
- Use token expiration for session management
- Implement rate limiting per client identity
- Combine multiple authorization checks
- Authorization logic is flexible and application-specific

## Complete Example

Here's a minimal, complete secured RPC example:

```typescript
// complete-secure-example.ts
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { Server } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'

// 1. Define protocol
const protocol = {
  'public/hello': {
    type: 'request',
    result: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message']
    }
  },
  'protected/data': {
    type: 'request',
    result: {
      type: 'object',
      properties: { secret: { type: 'string' } },
      required: ['secret']
    }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

// 2. Create server with authentication
const serverIdentity = randomIdentity()
const serverTransport = new ServerTransport<Protocol>()

const server = new Server<Protocol>({
  protocol,
  transport: serverTransport,
  identity: serverIdentity,
  access: {
    '*': false, // Require auth by default
    'public/hello': true // Public endpoint
  },
  handlers: {
    'public/hello': async () => {
      return { message: 'Hello, World!' }
    },
    'protected/data': async ({ message }) => {
      const clientDID = message.token?.payload.iss
      console.log('Protected data accessed by:', clientDID)
      return { secret: 'Top Secret Information' }
    }
  }
})

// 3. Start server
const httpServer = Bun.serve({
  port: 3001,
  fetch: serverTransport.fetch
})

console.log('Secure server running on http://localhost:3001')
console.log('Server DID:', serverIdentity.id)

// 4. Create authenticated client
const clientIdentity = randomIdentity()
const clientTransport = new ClientTransport<Protocol>({
  url: 'http://localhost:3001'
})

const client = new Client<Protocol>({
  transport: clientTransport,
  identity: clientIdentity,
  serverID: serverIdentity.id
})

console.log('Client DID:', clientIdentity.id)

// 5. Test endpoints
const publicResult = await client.request('public/hello')
console.log('Public endpoint:', publicResult.message)

const protectedResult = await client.request('protected/data')
console.log('Protected endpoint:', protectedResult.secret)

// 6. Test without authentication (should fail)
const unauthClient = new Client<Protocol>({
  transport: new ClientTransport<Protocol>({ url: 'http://localhost:3001' })
  // No identity provided
})

try {
  await unauthClient.request('protected/data')
} catch (error) {
  console.log('Unauthenticated access blocked:', error.message)
}

// 7. Cleanup
await client.dispose()
await unauthClient.dispose()
httpServer.stop()
await server.dispose()
```

Run with:
```bash
bun complete-secure-example.ts
```

Output:
```
Secure server running on http://localhost:3001
Server DID: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
Client DID: did:key:z6MkuBLrjSGt1PPADAvuv6rmKRAmnfwyZvuD6Peo4pCYhVdK
Public endpoint: Hello, World!
Protected data accessed by: did:key:z6MkuBLrjSGt1PPADAvuv6rmKRAmnfwyZvuD6Peo4pCYhVdK
Protected endpoint: Top Secret Information
Unauthenticated access blocked: Access denied
```

## Extending This Example

### How to Add Device Registration

Allow users to register multiple devices with a single account:

```typescript
// Map user accounts to authorized DIDs
const userAccounts = new Map<string, Set<string>>()

// Registration endpoint (requires existing device or password)
handlers: {
  'auth/register-device': async ({ param, message }) => {
    const { userId, existingToken, newDeviceDID } = param

    // Verify request from existing device
    if (existingToken) {
      const verified = await verifyToken(existingToken)

      if (!userAccounts.get(userId)?.has(verified.payload.iss)) {
        throw new Error('Existing device not authorized')
      }
    }

    // Add new device DID to user account
    if (!userAccounts.has(userId)) {
      userAccounts.set(userId, new Set())
    }
    userAccounts.get(userId)!.add(newDeviceDID)

    return { success: true }
  }
}

// Check authorization in handlers
'user/profile': async ({ param, message }) => {
  const clientDID = message.token?.payload.iss
  const authorizedDIDs = userAccounts.get(param.userId)

  if (!authorizedDIDs?.has(clientDID)) {
    throw new Error('Device not registered for this user')
  }

  return await getUserProfile(param.userId)
}
```

### How to Implement Key Rotation

Rotate server keys periodically:

```typescript
import { NodeKeyStore } from '@enkaku/node-keystore'

const keystore = NodeKeyStore.open('my-app')

// Generate new server key
const newKeyID = `server-key-${Date.now()}`
const newIdentity = await provideFullIdentityAsync(keystore, newKeyID)

console.log('New server DID:', newIdentity.id)

// Update server to use new identity
server.updateIdentity(newIdentity)

// Keep old key for grace period to verify old tokens
const oldKeyEntry = keystore.entry('server-key-old')
const oldKey = await oldKeyEntry.getAsync()

if (oldKey) {
  // After grace period, remove old key
  setTimeout(async () => {
    await oldKeyEntry.removeAsync()
    console.log('Old server key removed')
  }, 7 * 24 * 60 * 60 * 1000) // 7 days
}

// Notify clients of new server DID (via config endpoint or broadcast)
```

### How to Add Capability Delegation

Grant limited access rights to third parties:

```typescript
import { createCapability } from '@enkaku/capability'
import { stringifyToken } from '@enkaku/token'

// Service owner delegates read access to third party
const capability = await serviceOwnerIdentity.signToken({
  aud: thirdPartyDID, // Delegate to this DID
  sub: serviceOwnerDID, // Resource owner
  cap: {
    act: 'enkaku:data/read', // Only read action
    res: serviceOwnerDID // Resource
  },
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
})

// Third party includes capability in requests
const token = await thirdPartyIdentity.signToken({
  aud: serverDID,
  cap: stringifyToken(capability) // Include capability
})

// Server verifies both token and capability
'data/read': async ({ message }) => {
  const token = message.token
  const capability = token?.payload.cap

  if (!capability) {
    throw new Error('Capability required')
  }

  // Verify capability allows this action
  const cap = await verifyToken(capability)
  if (cap.payload.act !== 'enkaku:data/read') {
    throw new Error('Invalid capability')
  }

  return await getData()
}
```

### How to Add Token Refresh

Implement long-lived refresh tokens:

```typescript
// Store refresh tokens (in production: use secure database)
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>()

handlers: {
  // Login: Issue access and refresh tokens
  'auth/login': async ({ param }) => {
    const { username, password } = param
    const user = await verifyCredentials(username, password)

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Short-lived access token (15 minutes)
    const accessToken = await serverIdentity.signToken({
      sub: user.userId,
      exp: Math.floor(Date.now() / 1000) + 900
    })

    // Long-lived refresh token (7 days)
    const refreshToken = crypto.randomUUID()
    refreshTokens.set(refreshToken, {
      userId: user.userId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    })

    return {
      accessToken: stringifyToken(accessToken),
      refreshToken
    }
  },

  // Refresh: Issue new access token
  'auth/refresh': async ({ param }) => {
    const { refreshToken } = param
    const stored = refreshTokens.get(refreshToken)

    if (!stored || stored.expiresAt < Date.now()) {
      throw new Error('Invalid or expired refresh token')
    }

    const accessToken = await serverIdentity.signToken({
      sub: stored.userId,
      exp: Math.floor(Date.now() / 1000) + 900
    })

    return { accessToken: stringifyToken(accessToken) }
  }
}
```

## Related Capabilities

### Domain Documentation
- [Authentication & Security](../domains/authentication.md) - Complete reference for token system, keystores, and DID-based authentication
- [Core RPC](../domains/core-rpc.md) - Protocol definitions, client/server architecture, and message handling

### Related Use Cases
- [Building an RPC Server](building-rpc-server.md) - Basic server setup and handler implementation
- [Real-Time Communication](real-time-communication.md) - Streaming and bidirectional channels with authentication
