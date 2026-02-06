---
name: enkaku:auth
description: Authentication & security patterns - token generation, key management, and platform-specific keystores
---

# Enkaku Authentication & Security

## Packages in This Domain

**Token System**: `@enkaku/token`

**Platform Keystores**: `@enkaku/node-keystore`, `@enkaku/browser-keystore`, `@enkaku/expo-keystore`, `@enkaku/electron-keystore`

## Key Patterns

### Pattern 1: Generating and Verifying Tokens

```typescript
import { randomIdentity, verifyToken } from '@enkaku/token'

// Generate an identity with random private key
const identity = randomIdentity()
console.log('Identity DID:', identity.id) // did:key:z...

// Create a signed token
const token = await identity.signToken({
  sub: 'user-123',
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
})

// Token has header, payload, signature, and data
console.log(token.header) // { typ: 'JWT', alg: 'EdDSA' }
console.log(token.payload) // { iss: 'did:key:z...', sub: 'user-123', exp: ... }
console.log(token.signature) // Base64url signature

// Verify the token
const verified = await verifyToken(token)
console.log(verified.verifiedPublicKey) // Uint8Array of public key

// Can also verify from string format
const tokenString = `${token.data}.${token.signature}`
const verifiedFromString = await verifyToken(tokenString)
```

**Use case**: JWT-like authentication tokens with DID-based identity

**Key points**:
- Tokens use EdDSA or ES256 signature algorithms
- Issuer (`iss`) is automatically set to identity's DID (decentralized identifier)
- DIDs encode both algorithm and public key: `did:key:z<base58-encoded>`
- Token verification extracts public key from DID and validates signature
- Supports standard JWT claims: `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `cap`
- Tokens can be serialized to JWT format or used as objects

### Pattern 2: Using Node.js Keystore for Secure Storage

```typescript
import { NodeKeyStore, provideFullIdentityAsync } from '@enkaku/node-keystore'

// Open a keystore (uses OS-level credential storage)
const store = NodeKeyStore.open('my-app')

// Get or create a key entry
const entry = store.entry('user-auth-key')

// Get existing key or null
const existingKey = await entry.getAsync()

if (existingKey) {
  console.log('Key found:', existingKey)
} else {
  // Generate and store new key
  const newKey = await entry.provideAsync()
  console.log('New key created:', newKey)
}

// Convenience: Get identity directly from keystore
const identity = await provideFullIdentityAsync(store, 'user-auth-key')

// Create tokens using stored key
const token = await identity.signToken({
  sub: 'user-456',
  aud: 'my-service',
  exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
})

// List all keys in store
const allEntries = await store.listAsync()
for (const entry of allEntries) {
  console.log('Key ID:', entry.keyID)
}

// Remove a key
await entry.removeAsync()
```

**Use case**: Server-side key management with OS-level security (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**Key points**:
- Keys stored in OS credential manager (not in files)
- Automatic key generation on first use via `provide()` or `provideAsync()`
- Synchronous and async APIs available (prefer async in production)
- Each service can have multiple keys identified by keyID
- Keys are stored as base64-encoded private keys
- `provideFullIdentity()` helper creates an Identity from keystore entry
- Thread-safe for multi-process Node.js applications

### Pattern 3: Browser Keystore with IndexedDB

```typescript
import { BrowserKeyStore, provideSigningIdentity } from '@enkaku/browser-keystore'

// Open browser keystore (uses IndexedDB)
const store = await BrowserKeyStore.open('my-app-keys')

// Get identity for a key (creates if doesn't exist)
const identity = await provideSigningIdentity('session-key', store)

// Use identity in client
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'

const transport = new ClientTransport({
  url: 'https://api.example.com/rpc'
})

const client = new Client({
  transport,
  identity // Automatically signs all requests
})

// All requests now include signed tokens
const result = await client.request('getUserData', {
  param: { userId: '123' }
})

// Key is stored in browser and persists across sessions
// Clean up when user logs out
const entry = store.entry('session-key')
await entry.removeAsync()
```

**Use case**: Browser-based authentication with persistent keys

**Key points**:
- Uses IndexedDB for persistent storage across page reloads
- Keys are CryptoKeyPair objects (not exportable for security)
- Uses Web Crypto API (ES256 algorithm)
- All operations are async (IndexedDB requirement)
- Perfect for SPA and PWA applications
- Keys survive browser restart but are domain-specific
- Provides secure key isolation per origin

### Pattern 4: Multi-Platform Mobile with Expo Keystore

```typescript
import { ExpoKeyStore, provideFullIdentityAsync } from '@enkaku/expo-keystore'

// Expo keystore uses SecureStore (encrypted storage on device)
const identity = await provideFullIdentityAsync('device-key')

// Use with RPC client
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'

const client = new Client({
  transport: new ClientTransport({ url: 'https://api.example.com/rpc' }),
  identity
})

// Keys are securely stored on iOS Keychain and Android Keystore
const response = await client.request('syncData', {
  param: { lastSync: Date.now() }
})

// Remove key when needed (e.g., app uninstall or logout)
const entry = ExpoKeyStore.entry('device-key')
await entry.removeAsync()
```

**Use case**: React Native mobile apps with platform-native secure storage

**Key points**:
- Uses Expo SecureStore for encrypted key storage
- iOS: Stored in Keychain
- Android: Stored in EncryptedSharedPreferences backed by Android Keystore
- Keys persist across app restarts
- EdDSA algorithm using ed25519 curve
- Both sync and async APIs available
- Uses Expo Crypto for random key generation
- Keys can be backed up with device backups (configurable)

### Pattern 5: Electron App with Encrypted Storage

```typescript
import { ElectronKeyStore, provideFullIdentityAsync } from '@enkaku/electron-keystore'

// Open keystore (uses electron-store with safeStorage)
const store = ElectronKeyStore.open('app-keystore')

// Get identity
const identity = await provideFullIdentityAsync(store, 'main-window-key')

// Keys are encrypted using OS-level encryption
// macOS: Keychain
// Windows: DPAPI
// Linux: libsecret

// Use in main process
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'

const client = new Client({
  transport: new ClientTransport({ url: 'https://api.example.com/rpc' }),
  identity
})

// Create tokens for IPC with renderer
const ipcToken = await identity.signToken({
  sub: 'renderer-window',
  aud: 'main-process',
  exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
})

// Send to renderer
mainWindow.webContents.send('auth-token', ipcToken)

// Clean up
const entry = store.entry('main-window-key')
await entry.removeAsync()
```

**Use case**: Electron desktop apps with OS-native encryption

**Key points**:
- Uses Electron's `safeStorage` for platform-native encryption
- Stores encrypted keys in electron-store (persistent JSON)
- Keys stored as base64 strings (encrypted before storage)
- Both sync and async APIs (sync uses sync encryption)
- Works in main process only (renderer needs IPC)
- Keys survive app restart and system reboot
- Automatic encryption key managed by OS

### Pattern 6: Message-Level Encryption with JWE

```typescript
import {
  createTokenEncrypter,
  encryptToken,
  decryptToken,
  wrapEnvelope,
  unwrapEnvelope,
  randomIdentity,
} from '@enkaku/token'

// Sender and recipient identities
const sender = randomIdentity()
const recipient = randomIdentity()

// Create encrypter targeting recipient's DID
const encrypter = createTokenEncrypter(recipient.id)

// Low-level: Encrypt raw bytes
const plaintext = new TextEncoder().encode('secret message')
const jwe = await encryptToken(encrypter, plaintext)
// jwe is a JWE compact serialization string (5 dot-separated parts)

const decrypted = await decryptToken(recipient, jwe)
new TextDecoder().decode(decrypted) // 'secret message'

// High-level: Envelope wrapping (combines signing + encryption)
// jws-in-jwe: sign then encrypt (hides sender identity)
const wrapped = await wrapEnvelope('jws-in-jwe', {
  typ: 'request',
  prc: 'secret',
  rid: '1',
  prm: {},
}, {
  signer: sender,
  encrypter,
})

const { payload, mode } = await unwrapEnvelope(wrapped, { decrypter: recipient })
console.log(mode) // 'jws-in-jwe'
console.log(payload.prc) // 'secret'
```

**Use case**: End-to-end encryption where intermediaries (proxies, logs) cannot read payloads

**Key points**:
- Uses ECDH-ES (X25519) key agreement with A256GCM content encryption
- `createTokenEncrypter` accepts a DID string or raw X25519 public key
- JWE compact serialization: `header.encryptedKey.iv.ciphertext.tag`
- For ECDH-ES direct, the encrypted key segment is empty (key derived directly)
- Fresh ephemeral key pair per encryption (forward secrecy)
- Four envelope modes: `plain`, `jws`, `jws-in-jwe`, `jwe-in-jws`
- `jws-in-jwe` hides sender identity; `jwe-in-jws` allows routing by sender
- Ed25519 keys are auto-converted to X25519 for ECDH

## When to Use What

**Use @enkaku/token** when:
- Need to generate or verify authentication tokens
- Implementing custom token signing logic
- Working with DIDs and decentralized identity
- Need low-level token operations
- Building authentication middleware
- Need to encrypt RPC payloads beyond transport-level TLS
- Working with envelope modes (plain, jws, jws-in-jwe, jwe-in-jws)

**Use @enkaku/node-keystore** when:
- Building Node.js servers or CLI tools
- Need OS-level key security
- Running on macOS, Windows, or Linux
- Want keys accessible across processes
- Need system credential manager integration

**Use @enkaku/browser-keystore** when:
- Building web applications (SPA, PWA)
- Need persistent browser-based authentication
- Want Web Crypto API security
- Keys should survive page reload but not domain change
- Client-side signing required

**Use @enkaku/expo-keystore** when:
- Building React Native apps with Expo
- Need iOS Keychain or Android Keystore
- Want platform-native security
- Building cross-platform mobile apps
- Need encrypted key backup support

**Use @enkaku/electron-keystore** when:
- Building Electron desktop applications
- Need encrypted key storage
- Want OS-native encryption (DPAPI, Keychain)
- Keys used in main process only
- Need persistent storage across app restarts

## Related Domains

- See `/enkaku:core-rpc` for integrating authentication with RPC servers and clients
- See `/enkaku:transport` for securing transport layer connections

## Detailed Reference

For complete API documentation, security considerations, and advanced patterns: `docs/capabilities/domains/authentication.md`
