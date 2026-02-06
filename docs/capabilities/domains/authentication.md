# Authentication & Security - Detailed Reference

## Overview

The Authentication & Security domain in Enkaku provides a complete JWT-like token system with platform-specific secure key storage. The design centers around **DIDs (Decentralized Identifiers)** that encode both the signature algorithm and public key, eliminating the need for separate key distribution. Combined with platform-specific keystores, this enables secure, type-safe authentication across all environments from servers to browsers to mobile apps.

The token system uses standard JWT structure (header.payload.signature) but with DID-based issuers (`iss` field) that allow signature verification without prior key exchange. Keystores provide secure, persistent storage of private keys using OS-level encryption on each platform.

## Package Ecosystem

### Core Package: @enkaku/token

**Purpose**: JWT-like token generation and verification with DID-based identity.

**Key exports**:
- `randomIdentity()` - Generate identity with random private key (returns `OwnIdentity`)
- `createSigningIdentity(privateKey)` - Create signing-only identity from Ed25519 key
- `createDecryptingIdentity(privateKey)` - Create decryption-only identity from Ed25519 key
- `createFullIdentity(privateKey)` - Create identity with signing + decryption from Ed25519 key
- `isSigningIdentity(identity)` / `isDecryptingIdentity(identity)` / `isFullIdentity(identity)` - Type guards
- `verifyToken(token)` - Verify token signature and return verified token
- `createUnsignedToken(payload)` - Create unsigned token object
- `signToken(identity, token)` - Sign an unsigned token
- `isSignedToken(token)` / `isUnsignedToken(token)` / `isVerifiedToken(token)` - Type guards
- `createTokenEncrypter(recipient)` - Create encrypter targeting a DID or public key
- `encryptToken(encrypter, plaintext)` / `decryptToken(decrypter, jwe)` - JWE encrypt/decrypt
- `wrapEnvelope(mode, payload, options)` / `unwrapEnvelope(message, options)` - Envelope operations
- `getDID(codec, publicKey)` - Create DID from public key
- `getSignatureInfo(did)` - Extract algorithm and public key from DID
- `randomPrivateKey()` - Generate random Ed25519 private key
- `encodePrivateKey(key)` / `decodePrivateKey(encoded)` - Base64 encode/decode

**Dependencies**: `@enkaku/codec`, `@enkaku/schema`, `@noble/curves`, `@noble/ciphers`

**Core concepts**:
- **DID format**: `did:key:z<base58-multicodec-pubkey>`
- **Supported algorithms**: EdDSA (Ed25519), ES256 (P-256)
- **Token structure**: `{ header, payload, signature, data }`
- **Verification**: Extract public key from DID in `iss` claim, verify signature
- **Capabilities**: Tokens can contain capability delegations in `cap` field
- **JWE encryption**: ECDH-ES (X25519) + A256GCM content encryption for message confidentiality
- **Envelope modes**: `plain`, `jws`, `jws-in-jwe`, `jwe-in-jws` for different security levels

**Type system**:
```typescript
// Identity hierarchy (composable via intersection types)
type Identity = { readonly id: string }

type SigningIdentity = Identity & {
  signToken: <Payload, Header>(
    payload: Payload,
    header?: Header,
  ) => Promise<SignedToken<Payload, Header>>
}

type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

type FullIdentity = SigningIdentity & DecryptingIdentity

type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

// Token encrypter (targets a recipient, not your own identity)
type TokenEncrypter = {
  recipientID?: string
  encrypt(plaintext: Uint8Array): Promise<string>
}

// Envelope modes
type EnvelopeMode = 'plain' | 'jws' | 'jws-in-jwe' | 'jwe-in-jws'

// Token types
type SignedToken<Payload, Header> = {
  data: string
  header: SignedHeader & Header
  payload: SignedPayload & Payload
  signature: string
}

type VerifiedToken<Payload, Header> = SignedToken<Payload, Header> & {
  verifiedPublicKey: Uint8Array
}

type SignedPayload = {
  iss: string
  sub?: string
  aud?: string
  cap?: string | Array<string>
  exp?: number
  nbf?: number
  iat?: number
}
```

### Node Keystore: @enkaku/node-keystore

**Purpose**: Secure key storage for Node.js using OS credential managers.

**Key exports**:
- `NodeKeyStore` - Keystore class for managing keys
- `NodeKeyEntry` - Individual key entry with get/set/provide/remove
- `provideFullIdentity(store, keyID)` - Get Identity from keystore
- `provideFullIdentityAsync(store, keyID)` - Async version

**Dependencies**: `@napi-rs/keyring`, `@enkaku/token`, `@enkaku/protocol`

**How it works**:
- Uses `@napi-rs/keyring` for native OS credential access
- macOS: Stores in Keychain
- Windows: Stores in Credential Manager
- Linux: Stores in Secret Service (libsecret)
- Keys stored as base64-encoded Ed25519 private keys
- Service name groups related keys together
- Each entry identified by unique keyID

**Storage locations**:
- macOS: `~/Library/Keychains/login.keychain-db`
- Windows: Credential Manager (encrypted by DPAPI)
- Linux: Secret Service keyring (encrypted)

**Thread safety**: Native credential managers handle synchronization

**Example usage**:
```typescript
import { NodeKeyStore, provideFullIdentityAsync } from '@enkaku/node-keystore'

const store = NodeKeyStore.open('my-app')
const entry = store.entry('server-key')

// Get or create key
const key = await entry.provideAsync()

// Get identity
const identity = await provideFullIdentityAsync(store, 'server-key')

// List all keys
const entries = await store.listAsync()

// Remove key
await entry.removeAsync()
```

### Browser Keystore: @enkaku/browser-keystore

**Purpose**: Secure key storage for browsers using IndexedDB and Web Crypto API.

**Key exports**:
- `BrowserKeyStore` - Keystore using IndexedDB
- `BrowserKeyEntry` - Key entry with async operations
- `provideSigningIdentity(keyID, store?)` - Get SigningIdentity (creates key if needed)
- `randomKeyPair()` - Generate ES256 CryptoKeyPair
- `getPublicKey(keyPair)` - Extract compressed public key

**Dependencies**: `@enkaku/token`, `@enkaku/protocol`, `@enkaku/async`

**How it works**:
- Uses IndexedDB for persistent storage (survives page reload)
- Keys are CryptoKeyPair objects (non-exportable for security)
- Uses Web Crypto API for key generation and signing
- ES256 algorithm (P-256 curve with SHA-256)
- Database name defaults to `enkaku:key-store`
- Object store name: `keys`

**Browser compatibility**: All modern browsers (Chrome, Firefox, Safari, Edge)

**Storage characteristics**:
- Per-origin isolation (keys not shared across domains)
- Persists across browser restart
- Not synced across devices
- User can clear via browser settings

**Example usage**:
```typescript
import { BrowserKeyStore, provideSigningIdentity } from '@enkaku/browser-keystore'

// Open keystore (returns promise)
const store = await BrowserKeyStore.open('my-app-keys')

// Get identity
const identity = await provideSigningIdentity('user-session', store)

// Use with client
import { Client } from '@enkaku/client'
const client = new Client({ transport, identity })

// Clean up
await store.entry('user-session').removeAsync()
```

### Expo Keystore: @enkaku/expo-keystore

**Purpose**: Secure key storage for React Native apps using Expo SecureStore.

**Key exports**:
- `ExpoKeyStore` - Simple keystore for Expo apps
- `ExpoKeyEntry` - Key entry with sync and async operations
- `provideFullIdentity(keyID)` - Sync version
- `provideFullIdentityAsync(keyID)` - Async version
- `randomPrivateKey()` / `randomPrivateKeyAsync()` - Generate keys using Expo Crypto

**Dependencies**: `expo-secure-store`, `expo-crypto`, `@enkaku/token`, `@enkaku/protocol`

**How it works**:
- Uses Expo SecureStore for encrypted storage
- iOS: Stores in iOS Keychain (kSecAttrAccessibleAfterFirstUnlock)
- Android: EncryptedSharedPreferences backed by Android Keystore
- Keys stored as base64-encoded Ed25519 private keys
- Uses Expo Crypto for cryptographically secure random generation

**Platform differences**:
- iOS: Hardware encryption when available, backed up by default
- Android: Software-backed keystore, not backed up by default
- Both: Automatic encryption, survives app restart

**Example usage**:
```typescript
import { ExpoKeyStore, provideFullIdentityAsync } from '@enkaku/expo-keystore'

// Get identity (creates key if doesn't exist)
const identity = await provideFullIdentityAsync('device-identity')

// Use with client
import { Client } from '@enkaku/client'
const client = new Client({ transport, identity })

// Access entry for manual operations
const entry = ExpoKeyStore.entry('device-identity')
const key = await entry.getAsync()

// Remove on logout
await entry.removeAsync()
```

### Electron Keystore: @enkaku/electron-keystore

**Purpose**: Secure key storage for Electron apps using safeStorage and electron-store.

**Key exports**:
- `ElectronKeyStore` - Keystore for Electron main process
- `ElectronKeyEntry` - Key entry with sync and async operations
- `provideFullIdentity(store, keyID)` - Sync version
- `provideFullIdentityAsync(store, keyID)` - Async version

**Dependencies**: `electron` (safeStorage), `electron-store`, `@enkaku/token`, `@enkaku/protocol`

**How it works**:
- Uses Electron's `safeStorage` API for encryption
- Stores encrypted keys in electron-store (JSON file)
- macOS: Encrypted with Keychain key
- Windows: Encrypted with DPAPI
- Linux: Encrypted with libsecret key (fallback to basic encryption)
- Keys stored as base64 strings (encrypted before storage)

**Important constraints**:
- Main process only (safeStorage not available in renderer)
- Requires app to be packaged for production encryption
- Development mode may use basic encryption (platform-dependent)

**Storage location**: `electron-store` default location
- macOS: `~/Library/Application Support/<app-name>/config.json`
- Windows: `%APPDATA%\<app-name>\config.json`
- Linux: `~/.config/<app-name>/config.json`

**Example usage**:
```typescript
import { ElectronKeyStore, provideFullIdentityAsync } from '@enkaku/electron-keystore'

// Open keystore
const store = ElectronKeyStore.open('my-app-keystore')

// Get identity
const identity = await provideFullIdentityAsync(store, 'main-process-key')

// Use for IPC authentication
const token = await identity.signToken({
  sub: 'renderer-process',
  aud: 'main-process'
})

// Remove key
await store.entry('main-process-key').removeAsync()
```

## Common Patterns

### Pattern: Token-Based RPC Authentication (Server)

**Use case**: Authenticate RPC requests on the server using signed tokens

**Implementation**:

```typescript
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import { provideFullIdentityAsync } from '@enkaku/node-keystore'
import type { ProtocolDefinition } from '@enkaku/protocol'

const protocol = {
  'user/getData': {
    type: 'request',
    param: { type: 'object', properties: { userId: { type: 'string' } } },
    result: { type: 'object', properties: { name: { type: 'string' } } }
  },
  'admin/deleteUser': {
    type: 'request',
    param: { type: 'object', properties: { userId: { type: 'string' } } },
    result: { type: 'object', properties: { success: { type: 'boolean' } } }
  }
} as const satisfies ProtocolDefinition

type Protocol = typeof protocol

// Get server's identity from keystore
const serverIdentity = await provideFullIdentityAsync('my-app', 'server-key')
console.log('Server DID:', serverIdentity.id)

const transport = new ServerTransport<Protocol>()

const server = new Server<Protocol>({
  protocol,
  transport,
  // Provide server's identity for authentication
  identity: serverIdentity,
  // Access control: public procedures and allow-lists
  access: {
    '*': false, // All procedures private by default
    'user/getData': true, // Public procedure (any authenticated user)
    'admin/deleteUser': ['did:key:z...admin-did...'] // Only specific DIDs allowed
  },
  handlers: {
    'user/getData': async ({ param, message }) => {
      // message.token contains verified token
      const userId = message.token?.payload.sub
      console.log('Request from:', userId)

      return { name: 'Alice' }
    },
    'admin/deleteUser': async ({ param, message }) => {
      // Only called if client DID is in allow-list
      console.log('Admin action by:', message.token?.payload.iss)

      return { success: true }
    }
  }
})
```

**Key points**:
- Server creates its own Identity with stable DID
- Client tokens must have `aud` field matching server DID
- Access control via `access` map: `true` = public, `[...dids]` = allow-list, `false` = private
- Server DID can access all procedures (self-authentication)
- Token verification happens before handler invocation
- Verified tokens available in handler via `message.token`

### Pattern: Token-Based RPC Authentication (Client)

**Use case**: Sign RPC requests from browser client

**Implementation**:

```typescript
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { provideSigningIdentity } from '@enkaku/browser-keystore'

// Get or create client identity
const clientIdentity = await provideSigningIdentity('user-session')
console.log('Client DID:', clientIdentity.id)

const transport = new ClientTransport({
  url: 'https://api.example.com/rpc'
})

const client = new Client({
  transport,
  identity: clientIdentity, // Automatically signs all requests
  serverID: 'did:key:z...server-did...' // Server's DID for aud field
})

// All requests automatically signed with client's key
const data = await client.request('user/getData', {
  param: { userId: '123' }
})

// Token includes:
// - iss: clientIdentity.id (client's DID)
// - aud: serverID (server's DID)
// - sub: Can be set per-request
// - signature: Signed by client's private key
```

**Key points**:
- Client provides its Identity to Client constructor
- Client automatically signs all requests with its private key
- Server verifies signature using public key from client's DID
- `serverID` parameter sets `aud` field (audience) in tokens
- No separate login flow needed - DID is the identity
- Keys stored securely in browser keystore

### Pattern: Key Rotation

**Use case**: Rotate keys periodically for security

**Implementation**:

```typescript
import { NodeKeyStore, provideFullIdentityAsync } from '@enkaku/node-keystore'

const store = NodeKeyStore.open('my-app')

// Generate new key with new ID
const newKeyID = `server-key-${Date.now()}`
const newIdentity = await provideFullIdentityAsync(store, newKeyID)

console.log('New server DID:', newIdentity.id)

// Update server configuration to use new identity
server.updateIdentity(newIdentity)

// Keep old key for a grace period to verify old tokens
const oldEntry = store.entry('server-key-previous')
const oldKey = await oldEntry.getAsync()

if (oldKey) {
  // After grace period, remove old key
  setTimeout(async () => {
    await oldEntry.removeAsync()
    console.log('Old key removed')
  }, 7 * 24 * 60 * 60 * 1000) // 7 days
}

// Update clients with new server DID
// This can be done via configuration endpoint or environment variables
```

**Key points**:
- Generate new key with timestamp-based ID
- Keep old key during grace period for old tokens
- Update server to sign new tokens with new key
- Old tokens still verify with old DID (if you store old identity)
- Clients need to know new server DID
- Coordinate rotation across distributed services

### Pattern: Capability Delegation

**Use case**: Grant limited access rights to another party

**Implementation**:

```typescript
import { createCapability } from '@enkaku/capability'
import { randomIdentity, stringifyToken } from '@enkaku/token'

// Service owner (has full access)
const serviceIdentity = randomIdentity()

// Third-party client (needs limited access)
const clientIdentity = randomIdentity()

// Create capability delegation
const capability = await createCapability(serviceIdentity, {
  aud: clientIdentity.id, // Delegate to this client
  sub: serviceIdentity.id, // Delegator is subject
  act: 'enkaku:data/read', // Only read action
  res: serviceIdentity.id, // Resource owner
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
})

// Client creates token with capability
const clientToken = await clientIdentity.signToken({
  prc: 'enkaku:data/read', // Procedure matches capability
  aud: serviceIdentity.id, // Audience is service owner
  sub: serviceIdentity.id, // Subject is delegator
  cap: stringifyToken(capability) // Include capability
})

// Server verifies both token and capability
await verifyToken(clientToken)
// Server checks capability matches procedure and hasn't expired
```

**Key points**:
- Capability is itself a signed token
- Allows third parties to act with limited permissions
- `act` field specifies allowed actions (supports wildcards)
- `res` field identifies resource owner
- Server must verify both client token and embedded capability
- Capabilities can be chained (delegation chains)
- Expiration applies to capability, not just token

### Pattern: Cross-Platform Client Identity

**Use case**: Same user identity across web, mobile, and desktop

**Implementation**:

```typescript
// Web (browser)
import { provideSigningIdentity as browserIdentity } from '@enkaku/browser-keystore'

const webIdentity = await browserIdentity('user-identity')
// DID: did:key:zES256_public_key (ES256)

// Mobile (React Native)
import { provideFullIdentityAsync as expoIdentity } from '@enkaku/expo-keystore'

const mobileIdentity = await expoIdentity('user-identity')
// DID: did:key:zEdDSA_public_key (EdDSA)

// Desktop (Electron)
import { provideFullIdentityAsync as electronIdentity } from '@enkaku/electron-keystore'

const desktopIdentity = await electronIdentity(store, 'user-identity')
// DID: did:key:zEdDSA_public_key (EdDSA)

// Server tracks DIDs per user account
const userAccount = {
  userId: 'user-123',
  authorizedDIDs: [
    webIdentity.id,
    mobileIdentity.id,
    desktopIdentity.id
  ]
}

// Server handler checks if DID is authorized
handlers: {
  'user/getData': async ({ message }) => {
    const clientDID = message.token?.payload.iss

    if (!userAccount.authorizedDIDs.includes(clientDID)) {
      throw new Error('Unauthorized device')
    }

    return { data: 'sensitive info' }
  }
}
```

**Key points**:
- Each platform generates its own key pair
- Different algorithms possible (ES256 in browser, EdDSA in Node/Expo)
- Server associates multiple DIDs with single user account
- User can register new devices by proving existing device ownership
- Can revoke individual devices without affecting others
- No shared secrets across platforms

### Pattern: Offline Token Creation and Deferred Verification

**Use case**: Create tokens offline, verify later when online

**Implementation**:

```typescript
import { randomIdentity, stringifyToken, verifyToken } from '@enkaku/token'

// Offline: Create identity and tokens
const identity = randomIdentity()

const tokens = []
for (let i = 0; i < 100; i++) {
  const token = await identity.signToken({
    sub: `task-${i}`,
    iat: Math.floor(Date.now() / 1000)
  })

  // Serialize for storage/transmission
  const serialized = stringifyToken(token)
  tokens.push(serialized)
}

// Store identity DID for later verification
const identityDID = identity.id

// Later: Online verification (no need for identity)
for (const tokenString of tokens) {
  try {
    const verified = await verifyToken(tokenString)

    // Check issuer matches expected DID
    if (verified.payload.iss === identityDID) {
      console.log('Valid token for task:', verified.payload.sub)
    }
  } catch (error) {
    console.error('Invalid token:', error)
  }
}
```

**Key points**:
- Tokens can be created offline without server communication
- DID contains public key - no key distribution needed
- Verification requires no secret material (only public key from DID)
- Useful for batch operations, edge computing, offline-first apps
- Tokens can be stored and verified asynchronously
- No pre-established trust relationship needed

## Package Interactions

### Token and Keystores

All keystore packages depend on `@enkaku/token` and implement a common pattern:

```typescript
// KeyStore interface (from @enkaku/protocol)
type KeyStore<PrivateKeyType, EntryType> = {
  entry(keyID: string): EntryType
}

// KeyEntry interface (from @enkaku/protocol)
type KeyEntry<PrivateKeyType> = {
  readonly keyID: string
  getAsync(): Promise<PrivateKeyType | null>
  setAsync(privateKey: PrivateKeyType): Promise<void>
  provideAsync(): Promise<PrivateKeyType>
  removeAsync(): Promise<void>
}

// Each keystore provides helper to get Identity
provideFullIdentity(keyID: string): Promise<Identity>
```

Node, Expo, and Electron keystores store `Uint8Array` keys (EdDSA), while Browser keystore stores `CryptoKeyPair` (ES256).

### Token and Client

The `Client` class accepts an optional `identity` parameter:

```typescript
import { Client } from '@enkaku/client'
import type { SigningIdentity } from '@enkaku/token'

const client = new Client({
  transport,
  identity: signingIdentity, // Optional
  serverID: 'did:key:z...' // Required if identity provided
})
```

When an identity is provided:
- Client automatically signs all requests, streams, channels, and events
- Signature added to message payload as `token` field
- Server can verify using `verifyToken()` or automatic validation

### Token and Server

The `Server` class uses identity for authentication:

```typescript
import { Server } from '@enkaku/server'
import type { SigningIdentity } from '@enkaku/token'

const server = new Server({
  protocol,
  transport,
  identity: signingIdentity, // Optional but recommended
  access: {
    '*': false, // Require auth by default
    'public/endpoint': true // Public access
  },
  handlers: {
    // ...
  }
})
```

When an identity is provided:
- Server verifies client tokens before invoking handlers
- Checks `aud` field matches server DID
- Validates signature using public key from client's DID
- Enforces access control rules
- Verified token available in handler via `message.token`

## API Quick Reference

### @enkaku/token

```typescript
// Identity creation
function randomIdentity(): OwnIdentity
function createSigningIdentity(privateKey: Uint8Array): SigningIdentity
function createDecryptingIdentity(privateKey: Uint8Array): DecryptingIdentity
function createFullIdentity(privateKey: Uint8Array): FullIdentity

// Identity type guards
function isSigningIdentity(identity: Identity): identity is SigningIdentity
function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity
function isFullIdentity(identity: Identity): identity is FullIdentity

// Token operations
function verifyToken<Payload>(
  token: Token<Payload> | string,
  verifiers?: Verifiers
): Promise<Token<Payload>>

function createUnsignedToken<Payload, Header>(
  payload: Payload,
  header?: Header
): UnsignedToken<Payload, Header>

function signToken<Payload, Header>(
  identity: SigningIdentity,
  token: Token<Payload, Header>
): Promise<SignedToken<Payload, Header>>

// Token type guards
function isSignedToken(token: unknown): token is SignedToken
function isUnsignedToken(token: Token): token is UnsignedToken
function isVerifiedToken(token: unknown): token is VerifiedToken

// JWE encryption
function createTokenEncrypter(recipient: string): TokenEncrypter
function createTokenEncrypter(recipient: Uint8Array, options: EncryptOptions): TokenEncrypter
function encryptToken(encrypter: TokenEncrypter, plaintext: Uint8Array): Promise<string>
function decryptToken(decrypter: DecryptingIdentity, jwe: string): Promise<Uint8Array>

// Envelope wrapping
function wrapEnvelope(
  mode: EnvelopeMode,
  payload: Record<string, unknown>,
  options: WrapOptions,
): Promise<string>

function unwrapEnvelope(
  message: string,
  options: UnwrapOptions,
): Promise<UnwrappedEnvelope>

// Key operations
function randomPrivateKey(): Uint8Array
function encodePrivateKey(key: Uint8Array): string
function decodePrivateKey(encoded: string): Uint8Array

// DID operations
function getDID(codec: Uint8Array, publicKey: Uint8Array): string
function getSignatureInfo(did: string): [SignatureAlgorithm, Uint8Array]

// Utilities
function stringifyToken(token: SignedToken): string
```

### @enkaku/node-keystore

```typescript
class NodeKeyStore {
  static open(service: string): NodeKeyStore

  list(): Array<NodeKeyEntry>
  listAsync(): Promise<Array<NodeKeyEntry>>
  entry(keyID: string): NodeKeyEntry
}

class NodeKeyEntry {
  readonly keyID: string

  get(): Uint8Array | null
  getAsync(): Promise<Uint8Array | null>
  set(key: Uint8Array): void
  setAsync(key: Uint8Array): Promise<void>
  provide(): Uint8Array
  provideAsync(): Promise<Uint8Array>
  remove(): void
  removeAsync(): Promise<void>
}

function provideFullIdentity(
  store: NodeKeyStore | string,
  keyID: string
): Identity

function provideFullIdentityAsync(
  store: NodeKeyStore | string,
  keyID: string
): Promise<Identity>
```

### @enkaku/browser-keystore

```typescript
class BrowserKeyStore {
  static open(name?: string): Promise<BrowserKeyStore>

  entry(keyID: string): BrowserKeyEntry
}

class BrowserKeyEntry {
  readonly keyID: string

  getAsync(): Promise<CryptoKeyPair | null>
  setAsync(keyPair: CryptoKeyPair): Promise<void>
  provideAsync(): Promise<CryptoKeyPair>
  removeAsync(): Promise<void>
}

function provideSigningIdentity(
  keyID: string,
  useStore?: BrowserKeyStore | Promise<BrowserKeyStore> | string
): Promise<SigningIdentity>

// Utilities
function randomKeyPair(): Promise<CryptoKeyPair>
function getPublicKey(keyPair: CryptoKeyPair): Promise<Uint8Array>
```

### @enkaku/expo-keystore

```typescript
const ExpoKeyStore: KeyStore<Uint8Array, ExpoKeyEntry>

class ExpoKeyEntry {
  readonly keyID: string

  get(): Uint8Array | null
  getAsync(): Promise<Uint8Array | null>
  set(privateKey: Uint8Array): void
  setAsync(privateKey: Uint8Array): Promise<void>
  provide(): Uint8Array
  provideAsync(): Promise<Uint8Array>
  removeAsync(): Promise<void>
}

function provideFullIdentity(keyID: string): Identity

function provideFullIdentityAsync(keyID: string): Promise<Identity>

// Utilities
function randomPrivateKey(): Uint8Array
function randomPrivateKeyAsync(): Promise<Uint8Array>
```

### @enkaku/electron-keystore

```typescript
class ElectronKeyStore {
  static open(name?: string): ElectronKeyStore

  entry(keyID: string): ElectronKeyEntry
}

class ElectronKeyEntry {
  readonly keyID: string

  get(): string | null // Base64-encoded
  getAsync(): Promise<string | null>
  set(key: string): void
  setAsync(key: string): Promise<void>
  provide(): string
  provideAsync(): Promise<string>
  remove(): void
  removeAsync(): Promise<void>
}

function provideFullIdentity(
  store: ElectronKeyStore | string,
  keyID: string
): Identity

function provideFullIdentityAsync(
  store: ElectronKeyStore | string,
  keyID: string
): Promise<Identity>
```

## Examples by Scenario

### Scenario 1: Multi-Tenant SaaS with Per-Tenant Keys

**Goal**: Each tenant has its own signing key, server verifies tenant identity

**Implementation**:

```typescript
import { Server } from '@enkaku/server'
import { ServerTransport } from '@enkaku/http-server-transport'
import { NodeKeyStore, provideFullIdentityAsync } from '@enkaku/node-keystore'

const keystore = NodeKeyStore.open('saas-app')

// Server's master identity
const serverIdentity = await provideFullIdentityAsync(keystore, 'server-master')

// Tenant-specific identities (lazy-loaded)
const tenantIdentities = new Map<string, Identity>()

async function getTenantIdentity(tenantID: string): Promise<Identity> {
  if (!tenantIdentities.has(tenantID)) {
    const identity = await provideFullIdentityAsync(keystore, `tenant-${tenantID}`)
    tenantIdentities.set(tenantID, identity)
  }
  return tenantIdentities.get(tenantID)!
}

const transport = new ServerTransport()

const server = new Server({
  protocol,
  transport,
  identity: serverIdentity,
  handlers: {
    'tenant/getData': async ({ param, message }) => {
      // Extract tenant ID from token subject
      const tenantID = message.token?.payload.sub

      if (!tenantID) {
        throw new Error('Missing tenant ID')
      }

      // Verify request is from correct tenant
      const tenantIdentity = await getTenantIdentity(tenantID)

      if (message.token.payload.iss !== tenantIdentity.id) {
        throw new Error('Invalid tenant credentials')
      }

      // Fetch tenant-specific data
      return await getTenantData(tenantID, param.resourceID)
    }
  }
})
```

**Key aspects**:
- Each tenant gets unique signing key stored in keystore
- Tenant ID embedded in token `sub` field
- Server verifies token was signed by correct tenant's key
- Tenant keys isolated - compromise doesn't affect others
- Keys can be revoked per-tenant

### Scenario 2: Mobile App with Device Registration

**Goal**: User registers device, subsequent requests authenticated by device key

**Implementation**:

```typescript
// Mobile app (React Native)
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ExpoKeyStore, provideFullIdentityAsync } from '@enkaku/expo-keystore'

// Generate device identity on first launch
const deviceIdentity = await provideFullIdentityAsync('device-identity')

// Registration: Send DID to server with user credentials
async function registerDevice(username: string, password: string) {
  // Initial unauthenticated request
  const response = await fetch('https://api.example.com/register-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      deviceDID: deviceIdentity.id // Send device's public identity
    })
  })

  const { userID } = await response.json()

  // Store user ID for future requests
  await AsyncStorage.setItem('userID', userID)
}

// Subsequent requests: Use device identity
const transport = new ClientTransport({
  url: 'https://api.example.com/rpc'
})

const client = new Client({
  transport,
  identity: deviceIdentity,
  serverID: 'did:key:z...server...'
})

// All requests automatically authenticated with device key
const userData = await client.request('user/getData', {
  param: { userID: await AsyncStorage.getItem('userID') }
})

// Server maintains mapping of user -> authorized DIDs
// Server handler:
handlers: {
  'user/getData': async ({ param, message }) => {
    const deviceDID = message.token?.payload.iss
    const authorizedDIDs = await getAuthorizedDIDs(param.userID)

    if (!authorizedDIDs.includes(deviceDID)) {
      throw new Error('Device not registered')
    }

    return await getUserData(param.userID)
  }
}
```

**Key aspects**:
- Device generates permanent identity on first launch
- Registration associates device DID with user account
- No username/password stored on device
- Device key survives app updates
- User can manage registered devices from web interface
- Revoke compromised devices without changing passwords

### Scenario 3: Browser Extension with Content Script Authentication

**Goal**: Extension background script signs requests, content scripts use tokens

**Implementation**:

```typescript
// Background script (background.js)
import { provideSigningIdentity } from '@enkaku/browser-keystore'
import { stringifyToken } from '@enkaku/token'

// Extension's persistent identity
const extensionIdentity = await provideSigningIdentity('extension-identity')

// Listen for token requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REQUEST_TOKEN') {
    // Create short-lived token for content script
    extensionIdentity.signToken({
      sub: sender.tab.id.toString(),
      aud: 'api-server',
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    }).then(token => {
      sendResponse({ token: stringifyToken(token) })
    })
    return true // Async response
  }
})

// Content script (content.js)
async function makeAuthenticatedRequest() {
  // Request token from background script
  const { token } = await chrome.runtime.sendMessage({
    type: 'REQUEST_TOKEN'
  })

  // Use token in API request
  const response = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  return await response.json()
}
```

**Key aspects**:
- Background script holds signing key (persistent)
- Content scripts request short-lived tokens
- Tokens scoped to specific tabs
- Server verifies tokens came from known extension
- Extension can be updated without changing key
- Tab-specific tokens prevent cross-tab attacks

## Troubleshooting

### Issue: "Invalid signature" on Token Verification

**Symptoms**: `verifyToken()` throws "Invalid signature" error

**Causes**:
- Token tampered with or corrupted during transmission
- Wrong public key used for verification
- DID in `iss` field doesn't match signing key
- Token created with one key but verified against different DID

**Solutions**:
```typescript
// Verify the issuer DID matches expected identity
const token = await identity.signToken({ sub: 'test' })
console.log('Token issuer:', token.payload.iss)
console.log('Identity DID:', identity.id)
// These must match!

// Check token hasn't been corrupted
const tokenString = stringifyToken(token)
console.log('Token length:', tokenString.length)
// Should be ~200-300 characters

// Verify token with verbose error
try {
  await verifyToken(token)
} catch (error) {
  console.error('Verification failed:', error.message)
  console.log('Token data:', token.data)
  console.log('Signature:', token.signature)
}
```

### Issue: Keystore Key Not Found After Restart

**Symptoms**: `entry.get()` returns `null` after app restart

**Causes**:
- Key was never stored (only generated in memory)
- Keystore cleared by OS or user
- Different service/keyID name used
- Permission issues accessing credential storage

**Solutions**:
```typescript
// Node keystore: Verify service and keyID
const store = NodeKeyStore.open('my-app') // Exact service name
const entry = store.entry('server-key') // Exact keyID

// Check if key exists before using
const key = await entry.getAsync()

if (key == null) {
  console.log('Key not found, generating new one')
  const newKey = await entry.provideAsync()
  console.log('New key stored')
} else {
  console.log('Existing key found')
}

// Browser: Verify IndexedDB is available
if (typeof indexedDB === 'undefined') {
  console.error('IndexedDB not available (private browsing?)')
}

// Expo: Check SecureStore is available
import * as SecureStore from 'expo-secure-store'

const isAvailable = await SecureStore.isAvailableAsync()
if (!isAvailable) {
  console.error('SecureStore not available on this device')
}
```

### Issue: CORS Error with Signed Requests

**Symptoms**: Browser shows CORS error when client sends signed requests

**Causes**:
- Server not configured to accept Authorization header
- Preflight OPTIONS request not handled
- Token too large for URL (if sent as query param)

**Solutions**:
```typescript
// Server: Allow Authorization header in CORS
const transport = new ServerTransport({
  allowedOrigin: ['https://app.example.com'],
  // HTTP server should add these headers:
  // 'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  // 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
})

// Ensure OPTIONS requests are handled
Bun.serve({
  port: 3000,
  fetch: async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://app.example.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      })
    }
    return transport.fetch(request)
  }
})
```

### Issue: Token Expiration Not Enforced

**Symptoms**: Expired tokens still accepted by server

**Causes**:
- Server not checking `exp` field
- Clock skew between client and server
- Token created with wrong timestamp format

**Solutions**:
```typescript
// Server: Enable automatic expiration check
import { Server } from '@enkaku/server'

const server = new Server({
  protocol,
  transport,
  identity: serverIdentity,
  handlers: {
    myHandler: async ({ message }) => {
      const token = message.token

      if (!token) {
        throw new Error('Missing token')
      }

      // Manual expiration check
      if (token.payload.exp) {
        const now = Math.floor(Date.now() / 1000)
        if (token.payload.exp < now) {
          throw new Error('Token expired')
        }
      }

      // Not-before check
      if (token.payload.nbf) {
        const now = Math.floor(Date.now() / 1000)
        if (token.payload.nbf > now) {
          throw new Error('Token not yet valid')
        }
      }

      return { success: true }
    }
  }
})

// Client: Create token with proper expiration
const token = await identity.signToken({
  sub: 'user-123',
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now (seconds!)
})

// Account for clock skew (add/subtract 60 seconds tolerance)
```

### Issue: Keystore Access Denied on Linux

**Symptoms**: `NodeKeyStore` operations fail with permission errors on Linux

**Causes**:
- Secret Service daemon not running
- D-Bus not configured properly
- Application not authorized to access keyring
- Running in container without secret service access

**Solutions**:
```bash
# Check if secret service is running
systemctl status gnome-keyring-daemon

# Start keyring daemon if not running
gnome-keyring-daemon --start

# For containers/CI: Use environment variables instead
# Store base64-encoded key in environment
export SERVER_PRIVATE_KEY="base64encodedkey..."
```

```typescript
// Fallback to environment variables on Linux
import { createFullIdentity, decodePrivateKey } from '@enkaku/token'

let identity: Identity

if (process.env.SERVER_PRIVATE_KEY) {
  // Use environment variable
  const privateKey = decodePrivateKey(process.env.SERVER_PRIVATE_KEY)
  identity = createFullIdentity(privateKey)
} else {
  // Use keystore
  identity = await provideFullIdentityAsync('my-app', 'server-key')
}
```

### Issue: Browser Keystore Quota Exceeded

**Symptoms**: IndexedDB operations fail with quota exceeded error

**Causes**:
- Too many keys stored
- IndexedDB storage quota reached
- Private browsing mode with limited storage

**Solutions**:
```typescript
import { BrowserKeyStore } from '@enkaku/browser-keystore'

// Periodically clean up old keys
const store = await BrowserKeyStore.open('my-app-keys')

// Remove old session keys
const keysToRemove = ['old-session-1', 'old-session-2']

for (const keyID of keysToRemove) {
  await store.entry(keyID).removeAsync()
}

// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate()
  const percentUsed = (estimate.usage! / estimate.quota!) * 100

  console.log(`Storage: ${percentUsed.toFixed(2)}% used`)

  if (percentUsed > 80) {
    console.warn('Storage quota nearly full, clean up recommended')
  }
}

// Request persistent storage (prevents eviction)
if ('storage' in navigator && 'persist' in navigator.storage) {
  const granted = await navigator.storage.persist()
  console.log('Persistent storage:', granted)
}
```

### Issue: Different DIDs Across Devices for Same User

**Symptoms**: User's DID differs between mobile and web clients

**Causes**:
- Each keystore generates independent keys
- Different algorithms used (EdDSA vs ES256)
- This is expected behavior!

**Solutions**:
```typescript
// Server: Associate multiple DIDs with single user account
type UserAccount = {
  userID: string
  email: string
  authorizedDIDs: Array<string> // Multiple devices
}

// When user registers new device
async function registerNewDevice(
  userID: string,
  existingDeviceToken: string,
  newDeviceDID: string
) {
  // Verify request from existing device
  const verified = await verifyToken(existingDeviceToken)

  const account = await getAccount(userID)

  if (!account.authorizedDIDs.includes(verified.payload.iss)) {
    throw new Error('Existing device not authorized')
  }

  // Add new device DID
  account.authorizedDIDs.push(newDeviceDID)
  await saveAccount(account)

  return { success: true }
}

// Handler checks if request DID is authorized
handlers: {
  'user/getData': async ({ param, message }) => {
    const account = await getAccount(param.userID)
    const deviceDID = message.token?.payload.iss

    if (!account.authorizedDIDs.includes(deviceDID)) {
      throw new Error('Device not authorized for this account')
    }

    return await getUserData(param.userID)
  }
}
```
