# Ledger Identity & HD Keystore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement hardware-backed Ledger identity and software HD keystore, both producing `FullIdentity` via the `IdentityProvider` interface, with identical key derivation paths for recovery.

**Architecture:** Two new packages (`@enkaku/hd-keystore`, `@enkaku/ledger-identity`) plus a custom BOLOS Ledger app (`apps/ledger/`). The HD keystore uses SLIP-0010 Ed25519 derivation from a BIP39 seed. The Ledger identity wraps APDU commands to sign/ECDH on-device. Both implement `IdentityProvider<FullIdentity>` from `@enkaku/token`. A prerequisite task implements the missing `decrypt()` method on `DecryptingIdentity`.

**Tech Stack:** TypeScript (Vitest, SWC, pnpm workspace), C (BOLOS SDK, Docker build), `micro-key-producer/slip10.js`, `@scure/bip39`, `@noble/curves`, `@noble/ciphers`, `@noble/hashes`

**Spec:** `docs/superpowers/specs/2026-03-25-ledger-identity-design.md`

---

## File Structure

### `packages/token/src/` (modify)

| File | Change |
|------|--------|
| `identity.ts` | Implement `decrypt()` in `createDecryptingIdentity` using `agreeKey` + JWE decryption logic |

### `packages/hd-keystore/` (create)

| File | Purpose |
|------|---------|
| `src/index.ts` | Package entry — re-exports |
| `src/store.ts` | `HDKeyStore` class — `KeyStore<Uint8Array>` + `IdentityProvider<FullIdentity>` |
| `src/entry.ts` | `HDKeyEntry` class — `KeyEntry<Uint8Array>` with deterministic derivation |
| `src/derivation.ts` | SLIP-0010 path utilities — parse keyID, resolve to full path, derive key |
| `test/derivation.test.ts` | SLIP-0010 derivation tests with known test vectors |
| `test/store.test.ts` | HDKeyStore + HDKeyEntry tests |
| `test/identity.test.ts` | IdentityProvider integration — signing, verification, cross-compat |
| `package.json` | Package config |
| `tsconfig.json` | Extends `../../tsconfig.build.json` |
| `tsconfig.test.json` | Test TypeScript config |

### `packages/ledger-identity/` (create)

| File | Purpose |
|------|---------|
| `src/index.ts` | Package entry — re-exports |
| `src/apdu.ts` | APDU command encoding/decoding, chunking, status word parsing |
| `src/provider.ts` | `createLedgerIdentityProvider` — `IdentityProvider<FullIdentity>` |
| `src/errors.ts` | `LedgerError`, `LedgerUserRejectedError`, `LedgerDisconnectedError`, `LedgerAppNotOpenError` |
| `src/types.ts` | `LedgerTransport` type |
| `test/apdu.test.ts` | APDU encoding/decoding/chunking tests |
| `test/provider.test.ts` | Provider tests with mocked transport |
| `package.json` | Package config |
| `tsconfig.json` | Extends `../../tsconfig.build.json` |
| `tsconfig.test.json` | Test TypeScript config |

### `apps/ledger/` (create)

| File | Purpose |
|------|---------|
| `Makefile` | BOLOS SDK build configuration |
| `src/main.c` | App entry, APDU dispatcher |
| `src/handlers.h` | Handler function declarations |
| `src/get_public_key.c` | `GET_PUBLIC_KEY` handler |
| `src/sign_message.c` | `SIGN_MESSAGE` handler with chunking |
| `src/ecdh_x25519.c` | `ECDH_X25519` handler |
| `src/globals.h` | Shared state (derivation path, message buffer) |
| `src/constants.h` | CLA, INS, status word constants |
| `glyphs/icon.gif` | App icon for device screen |
| `Dockerfile` | Build using `ghcr.io/ledgerhq/ledger-app-builder` |
| `README.md` | Setup, build, and testing instructions |

---

## Task 1: Implement `decrypt()` on `DecryptingIdentity`

**Files:**
- Modify: `packages/token/src/identity.ts:90-105`
- Modify: `packages/token/test/jwe.test.ts` (add decrypt test)

The existing `decrypt()` stub throws `'Not implemented'`. It should decrypt a JWE string using `agreeKey()` — mirroring the `decryptToken()` logic in `jwe.ts`.

- [ ] **Step 1: Write the failing test**

In the existing JWE test file, add a test that encrypts to a `DecryptingIdentity` and then calls `decrypt()`:

```ts
import { createFullIdentity, createTokenEncrypter, randomPrivateKey } from '@enkaku/token'

test('DecryptingIdentity.decrypt() decrypts JWE', async () => {
  const identity = createFullIdentity(randomPrivateKey())
  const encrypter = createTokenEncrypter(identity.id)
  const plaintext = new TextEncoder().encode('hello world')
  const jwe = await encrypter.encrypt(plaintext)
  const decrypted = await identity.decrypt(jwe)
  expect(decrypted).toEqual(plaintext)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:unit --filter=@enkaku/token`
Expected: FAIL with "Not implemented"

- [ ] **Step 3: Implement `decrypt()` in `createDecryptingIdentity`**

Replace the `decrypt` stub in `packages/token/src/identity.ts` with a real implementation. Import `decryptToken` from `jwe.ts` and delegate — `decryptToken` already uses `agreeKey()` internally, so the implementation is a one-liner:

```ts
async function decrypt(jwe: string): Promise<Uint8Array> {
  const { decryptToken } = await import('./jwe.js')
  return decryptToken({ id, decrypt, agreeKey }, jwe)
}
```

Note: use dynamic import to avoid circular dependency (identity.ts ← jwe.ts → identity.ts).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test:unit --filter=@enkaku/token`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/identity.ts packages/token/test/jwe.test.ts
git commit -m "feat(token): implement decrypt() on DecryptingIdentity"
```

---

## Task 2: Create `@enkaku/hd-keystore` package scaffold

**Files:**
- Create: `packages/hd-keystore/package.json`
- Create: `packages/hd-keystore/tsconfig.json`
- Create: `packages/hd-keystore/tsconfig.test.json`
- Create: `packages/hd-keystore/src/index.ts`
- Modify: `pnpm-workspace.yaml` (add `micro-key-producer` and `@scure/bip39` to catalog)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@enkaku/hd-keystore",
  "version": "0.1.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "Enkaku HD keystore with SLIP-0010 Ed25519 derivation",
  "keywords": ["cryptography", "key-management", "bip39", "slip-0010", "hd-wallet"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/hd-keystore"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": "./lib/index.js"
  },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@enkaku/log": "workspace:^",
    "@enkaku/otel": "workspace:^",
    "@enkaku/token": "workspace:^",
    "@scure/bip39": "catalog:",
    "micro-key-producer": "catalog:"
  },
  "devDependencies": {
    "@enkaku/protocol": "workspace:^",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

- [ ] **Step 3: Create `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["es2025", "dom"],
    "types": ["node"],
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

- [ ] **Step 4: Create placeholder `src/index.ts`**

```ts
/**
 * HD keystore with SLIP-0010 Ed25519 derivation for Enkaku.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/hd-keystore
 * ```
 *
 * @module hd-keystore
 */
```

- [ ] **Step 5: Add dependencies to pnpm catalog**

Add to the `catalog:` section in `pnpm-workspace.yaml`:

```yaml
  '@scure/bip39': ^1.5.0
  micro-key-producer: ^0.7.0
```

Then run: `pnpm install`

- [ ] **Step 6: Verify scaffold builds**

Run: `pnpm run build --filter=@enkaku/hd-keystore`
Expected: builds with empty output

- [ ] **Step 7: Commit**

```bash
git add packages/hd-keystore/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(hd-keystore): scaffold package"
```

---

## Task 3: SLIP-0010 derivation utilities

**Files:**
- Create: `packages/hd-keystore/src/derivation.ts`
- Create: `packages/hd-keystore/test/derivation.test.ts`

- [ ] **Step 1: Write failing tests for path resolution and key derivation**

```ts
import { describe, expect, test } from 'vitest'

import { derivePrivateKey, resolveDerivationPath } from '../src/derivation.js'

const DEFAULT_BASE_PATH = "44'/903'"

describe('resolveDerivationPath()', () => {
  test('resolves numeric index to full path', () => {
    expect(resolveDerivationPath('0', DEFAULT_BASE_PATH)).toBe("m/44'/903'/0'")
  })

  test('resolves string index to full hardened path', () => {
    expect(resolveDerivationPath('5', DEFAULT_BASE_PATH)).toBe("m/44'/903'/5'")
  })

  test('passes through full path unchanged', () => {
    expect(resolveDerivationPath("m/44'/903'/2'", DEFAULT_BASE_PATH)).toBe("m/44'/903'/2'")
  })

  test('throws for invalid keyID', () => {
    expect(() => resolveDerivationPath('abc', DEFAULT_BASE_PATH)).toThrow()
  })
})

describe('derivePrivateKey()', () => {
  // SLIP-0010 test vector from https://github.com/satoshilabs/slips/blob/master/slip-0010.md
  // Test Vector 1 for ed25519
  const SEED = Uint8Array.from(
    '000102030405060708090a0b0c0d0e0f'.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  )

  test('derives master key from seed', () => {
    const key = derivePrivateKey(SEED, "m")
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('derives child key at path', () => {
    const key = derivePrivateKey(SEED, "m/0'")
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('same seed + path produces same key', () => {
    const a = derivePrivateKey(SEED, "m/44'/903'/0'")
    const b = derivePrivateKey(SEED, "m/44'/903'/0'")
    expect(a).toEqual(b)
  })

  test('different paths produce different keys', () => {
    const a = derivePrivateKey(SEED, "m/44'/903'/0'")
    const b = derivePrivateKey(SEED, "m/44'/903'/1'")
    expect(a).not.toEqual(b)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: FAIL — module not found

- [ ] **Step 3: Implement derivation utilities**

```ts
import slip10 from 'micro-key-producer/slip10.js'

const DEFAULT_BASE_PATH = "44'/903'"
const INDEX_RE = /^\d+$/

export function resolveDerivationPath(keyID: string, basePath: string = DEFAULT_BASE_PATH): string {
  if (keyID.startsWith('m/')) {
    return keyID
  }
  if (INDEX_RE.test(keyID)) {
    return `m/${basePath}/${keyID}'`
  }
  throw new Error(`Invalid keyID: "${keyID}" — expected a numeric index or full derivation path`)
}

export function derivePrivateKey(seed: Uint8Array, path: string): Uint8Array {
  const root = slip10.fromMasterSeed(seed)
  if (path === 'm') {
    return root.privateKey
  }
  return root.derive(path).privateKey
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hd-keystore/src/derivation.ts packages/hd-keystore/test/derivation.test.ts
git commit -m "feat(hd-keystore): SLIP-0010 derivation utilities"
```

---

## Task 4: `HDKeyEntry` class

**Files:**
- Create: `packages/hd-keystore/src/entry.ts`
- Create: `packages/hd-keystore/test/store.test.ts` (entry portion)

- [ ] **Step 1: Write failing tests for `HDKeyEntry`**

```ts
import { describe, expect, test } from 'vitest'

import { HDKeyEntry } from '../src/entry.js'
import { derivePrivateKey } from '../src/derivation.js'

// Deterministic seed for testing
const SEED = Uint8Array.from(
  '000102030405060708090a0b0c0d0e0f'.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
)

describe('HDKeyEntry', () => {
  test('keyID is accessible', () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    expect(entry.keyID).toBe("m/44'/903'/0'")
  })

  test('getAsync() returns derived private key', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    const key = await entry.getAsync()
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key!.length).toBe(32)
    // Should match direct derivation
    expect(key).toEqual(derivePrivateKey(SEED, "m/44'/903'/0'"))
  })

  test('provideAsync() returns same key as getAsync()', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    const a = await entry.getAsync()
    const b = await entry.provideAsync()
    expect(a).toEqual(b)
  })

  test('setAsync() throws', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    await expect(entry.setAsync(new Uint8Array(32))).rejects.toThrow(
      'HD keys are derived, not stored',
    )
  })

  test('removeAsync() is a no-op', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    await expect(entry.removeAsync()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `HDKeyEntry`**

```ts
import type { KeyEntry } from '@enkaku/protocol'

import { derivePrivateKey } from './derivation.js'

export type HDKeyEntryParams = {
  seed: Uint8Array
  path: string
}

export class HDKeyEntry implements KeyEntry<Uint8Array> {
  #seed: Uint8Array
  #path: string
  #cachedKey?: Uint8Array

  constructor(params: HDKeyEntryParams) {
    this.#seed = params.seed
    this.#path = params.path
  }

  get keyID(): string {
    return this.#path
  }

  #derive(): Uint8Array {
    this.#cachedKey ??= derivePrivateKey(this.#seed, this.#path)
    return this.#cachedKey
  }

  async getAsync(): Promise<Uint8Array | null> {
    return this.#derive()
  }

  async setAsync(_privateKey: Uint8Array): Promise<void> {
    throw new Error('HD keys are derived, not stored')
  }

  async provideAsync(): Promise<Uint8Array> {
    return this.#derive()
  }

  async removeAsync(): Promise<void> {
    // no-op — derived keys cannot be removed
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hd-keystore/src/entry.ts packages/hd-keystore/test/store.test.ts
git commit -m "feat(hd-keystore): HDKeyEntry with deterministic derivation"
```

---

## Task 5: `HDKeyStore` class with `IdentityProvider`

**Files:**
- Create: `packages/hd-keystore/src/store.ts`
- Add to: `packages/hd-keystore/test/store.test.ts`
- Create: `packages/hd-keystore/test/identity.test.ts`
- Update: `packages/hd-keystore/src/index.ts`

- [ ] **Step 1: Write failing tests for `HDKeyStore` as `KeyStore`**

Add to `test/store.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { HDKeyStore } from '../src/store.js'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('HDKeyStore', () => {
  test('fromMnemonic() creates store', () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    expect(store).toBeDefined()
  })

  test('fromSeed() creates store', () => {
    const seed = new Uint8Array(64)
    const store = HDKeyStore.fromSeed(seed)
    expect(store).toBeDefined()
  })

  test('entry() returns HDKeyEntry for index', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const entry = store.entry('0')
    expect(entry.keyID).toBe("m/44'/903'/0'")
    const key = await entry.provideAsync()
    expect(key.length).toBe(32)
  })

  test('entry() returns HDKeyEntry for full path', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const entry = store.entry("m/44'/903'/5'")
    expect(entry.keyID).toBe("m/44'/903'/5'")
  })

  test('same keyID returns same entry', () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const a = store.entry('0')
    const b = store.entry('0')
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 2: Write failing tests for `HDKeyStore` as `IdentityProvider`**

Create `test/identity.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { isFullIdentity, verifyToken } from '@enkaku/token'

import { HDKeyStore } from '../src/store.js'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('HDKeyStore as IdentityProvider', () => {
  test('provideIdentity() returns FullIdentity', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same keyID produces same DID', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const a = await store.provideIdentity('0')
    const b = await store.provideIdentity('0')
    expect(a.id).toBe(b.id)
  })

  test('different keyID produces different DID', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const a = await store.provideIdentity('0')
    const b = await store.provideIdentity('1')
    expect(a.id).not.toBe(b.id)
  })

  test('identity can sign and verify tokens', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    const token = await identity.signToken({ data: 'test' })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(
      `${token.data}.${token.signature}`,
    )
    expect(verified.payload.data).toBe('test')
  })

  test('identity can perform ECDH key agreement', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    // Generate an ephemeral X25519 key pair
    const { x25519 } = await import('@noble/curves/ed25519.js')
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    const shared = await identity.agreeKey(ephPub)
    expect(shared).toBeInstanceOf(Uint8Array)
    expect(shared.length).toBe(32)
  })

  test('same mnemonic produces same identity', async () => {
    const a = HDKeyStore.fromMnemonic(MNEMONIC)
    const b = HDKeyStore.fromMnemonic(MNEMONIC)
    const idA = await a.provideIdentity('0')
    const idB = await b.provideIdentity('0')
    expect(idA.id).toBe(idB.id)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `HDKeyStore`**

```ts
import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import type { KeyStore } from '@enkaku/protocol'
import { createFullIdentity, type FullIdentity, type IdentityProvider } from '@enkaku/token'
import { mnemonicToSeedSync } from '@scure/bip39'

import { resolveDerivationPath } from './derivation.js'
import { HDKeyEntry } from './entry.js'

const DEFAULT_BASE_PATH = "44'/903'"
const tracer = createTracer('keystore.hd')
const logger = getEnkakuLogger('hd-keystore')

export type HDKeyStoreParams = {
  seed: Uint8Array
  basePath?: string
}

export class HDKeyStore
  implements KeyStore<Uint8Array, HDKeyEntry>, IdentityProvider<FullIdentity>
{
  #seed: Uint8Array
  #basePath: string
  #entries: Record<string, HDKeyEntry> = {}

  static fromMnemonic(mnemonic: string, options?: { basePath?: string }): HDKeyStore {
    const seed = mnemonicToSeedSync(mnemonic)
    return new HDKeyStore({ seed, basePath: options?.basePath })
  }

  static fromSeed(seed: Uint8Array, options?: { basePath?: string }): HDKeyStore {
    return new HDKeyStore({ seed, basePath: options?.basePath })
  }

  constructor(params: HDKeyStoreParams) {
    this.#seed = params.seed
    this.#basePath = params.basePath ?? DEFAULT_BASE_PATH
  }

  entry(keyID: string): HDKeyEntry {
    const path = resolveDerivationPath(keyID, this.#basePath)
    this.#entries[path] ??= new HDKeyEntry({ seed: this.#seed, path })
    return this.#entries[path]
  }

  async provideIdentity(keyID: string): Promise<FullIdentity> {
    return withSpan(
      tracer,
      SpanNames.KEYSTORE_GET_OR_CREATE,
      { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'hd' } },
      async (span) => {
        const entry = this.entry(keyID)
        const privateKey = await entry.provideAsync()
        const identity = createFullIdentity(privateKey)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        logger.info('HD identity derived: {did}', { did: identity.id })
        return identity
      },
    )
  }
}
```

- [ ] **Step 5: Update `src/index.ts` with exports**

```ts
/**
 * HD keystore with SLIP-0010 Ed25519 derivation for Enkaku.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/hd-keystore
 * ```
 *
 * @module hd-keystore
 */

export { derivePrivateKey, resolveDerivationPath } from './derivation.js'
export { HDKeyEntry, type HDKeyEntryParams } from './entry.js'
export { HDKeyStore, type HDKeyStoreParams } from './store.js'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hd-keystore`
Expected: PASS

- [ ] **Step 7: Run full build to verify type checking**

Run: `pnpm run build --filter=@enkaku/hd-keystore`
Expected: builds successfully

- [ ] **Step 8: Commit**

```bash
git add packages/hd-keystore/
git commit -m "feat(hd-keystore): HDKeyStore with KeyStore and IdentityProvider"
```

---

## Task 6: Create `@enkaku/ledger-identity` package scaffold

**Files:**
- Create: `packages/ledger-identity/package.json`
- Create: `packages/ledger-identity/tsconfig.json`
- Create: `packages/ledger-identity/tsconfig.test.json`
- Create: `packages/ledger-identity/src/index.ts`
- Create: `packages/ledger-identity/src/types.ts`
- Create: `packages/ledger-identity/src/errors.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@enkaku/ledger-identity",
  "version": "0.1.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "Enkaku Ledger hardware wallet identity provider",
  "keywords": ["cryptography", "ledger", "hardware-wallet", "identity"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/ledger-identity"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": "./lib/index.js"
  },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@enkaku/codec": "workspace:^",
    "@enkaku/log": "workspace:^",
    "@enkaku/otel": "workspace:^",
    "@enkaku/token": "workspace:^"
  },
  "devDependencies": {
    "@enkaku/hd-keystore": "workspace:^",
    "@noble/curves": "catalog:",
    "@scure/bip39": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` and `tsconfig.test.json`**

Same structure as hd-keystore (see Task 2, Steps 2-3).

- [ ] **Step 3: Create `src/types.ts`**

```ts
export type LedgerTransport = {
  send(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data?: Uint8Array,
  ): Promise<Uint8Array>
}
```

- [ ] **Step 4: Create `src/errors.ts`**

```ts
export class LedgerError extends Error {
  readonly statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'LedgerError'
    this.statusCode = statusCode
  }
}

export class LedgerUserRejectedError extends LedgerError {
  constructor() {
    super('User rejected the operation on Ledger device', 0x6985)
    this.name = 'LedgerUserRejectedError'
  }
}

export class LedgerDisconnectedError extends LedgerError {
  constructor(cause?: unknown) {
    super('Ledger device disconnected', 0)
    this.name = 'LedgerDisconnectedError'
    if (cause != null) {
      this.cause = cause
    }
  }
}

export class LedgerAppNotOpenError extends LedgerError {
  constructor() {
    super('Enkaku app not open on Ledger device', 0x6a82)
    this.name = 'LedgerAppNotOpenError'
  }
}
```

- [ ] **Step 5: Create placeholder `src/index.ts`**

```ts
/**
 * Ledger hardware wallet identity provider for Enkaku.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/ledger-identity
 * ```
 *
 * @module ledger-identity
 */

export {
  LedgerAppNotOpenError,
  LedgerDisconnectedError,
  LedgerError,
  LedgerUserRejectedError,
} from './errors.js'
export type { LedgerTransport } from './types.js'
```

- [ ] **Step 6: Verify scaffold builds**

Run: `pnpm install && pnpm run build --filter=@enkaku/ledger-identity`
Expected: builds successfully

- [ ] **Step 7: Commit**

```bash
git add packages/ledger-identity/
git commit -m "chore(ledger-identity): scaffold package with types and errors"
```

---

## Task 7: APDU encoding/decoding

**Files:**
- Create: `packages/ledger-identity/src/apdu.ts`
- Create: `packages/ledger-identity/test/apdu.test.ts`

- [ ] **Step 1: Write failing tests for APDU utilities**

```ts
import { describe, expect, test } from 'vitest'

import {
  CLA,
  INS,
  encodeDerivationPath,
  encodeSignMessageChunks,
  parsePublicKeyResponse,
  parseSignatureResponse,
  parseSharedSecretResponse,
  checkStatusWord,
} from '../src/apdu.js'

describe('constants', () => {
  test('CLA is 0xE0', () => {
    expect(CLA).toBe(0xe0)
  })

  test('INS values', () => {
    expect(INS.GET_APP_VERSION).toBe(0x01)
    expect(INS.GET_PUBLIC_KEY).toBe(0x02)
    expect(INS.SIGN_MESSAGE).toBe(0x03)
    expect(INS.ECDH_X25519).toBe(0x04)
  })
})

describe('encodeDerivationPath()', () => {
  test('encodes hardened path components', () => {
    const encoded = encodeDerivationPath("m/44'/903'/0'")
    // 3 components, each 4 bytes (uint32 big-endian with hardened bit)
    expect(encoded.length).toBe(1 + 3 * 4) // 1 byte for component count + 12 bytes
    expect(encoded[0]).toBe(3) // 3 components
  })

  test('throws for non-hardened components', () => {
    expect(() => encodeDerivationPath('m/44/903/0')).toThrow()
  })
})

describe('encodeSignMessageChunks()', () => {
  test('returns single chunk for small message', () => {
    const path = encodeDerivationPath("m/44'/903'/0'")
    const message = new Uint8Array(32)
    const chunks = encodeSignMessageChunks(path, message)
    expect(chunks.length).toBe(1)
    expect(chunks[0].p1).toBe(0x00)
    expect(chunks[0].p2).toBe(0x00)
  })

  test('returns multiple chunks for large message', () => {
    const path = encodeDerivationPath("m/44'/903'/0'")
    const message = new Uint8Array(512)
    const chunks = encodeSignMessageChunks(path, message)
    expect(chunks.length).toBeGreaterThan(1)
    // First chunk has p1=0x00, rest have p1=0x80
    expect(chunks[0].p1).toBe(0x00)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].p1).toBe(0x80)
    }
    // Final chunk has p2=0x01
    expect(chunks[chunks.length - 1].p2).toBe(0x01)
    // Non-final chunks have p2=0x00
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].p2).toBe(0x00)
    }
  })
})

describe('response parsers', () => {
  test('parsePublicKeyResponse() extracts 32-byte key', () => {
    const response = new Uint8Array(32)
    response[0] = 0xab
    const key = parsePublicKeyResponse(response)
    expect(key.length).toBe(32)
    expect(key[0]).toBe(0xab)
  })

  test('parseSignatureResponse() extracts 64-byte signature', () => {
    const response = new Uint8Array(64)
    const sig = parseSignatureResponse(response)
    expect(sig.length).toBe(64)
  })

  test('parseSharedSecretResponse() extracts 32-byte secret', () => {
    const response = new Uint8Array(32)
    const secret = parseSharedSecretResponse(response)
    expect(secret.length).toBe(32)
  })
})

describe('checkStatusWord()', () => {
  test('does not throw for success (0x9000)', () => {
    expect(() => checkStatusWord(0x9000)).not.toThrow()
  })

  test('throws LedgerUserRejectedError for 0x6985', async () => {
    const { LedgerUserRejectedError } = await import('../src/errors.js')
    expect(() => checkStatusWord(0x6985)).toThrow(LedgerUserRejectedError)
  })

  test('throws LedgerAppNotOpenError for 0x6A82', async () => {
    const { LedgerAppNotOpenError } = await import('../src/errors.js')
    expect(() => checkStatusWord(0x6a82)).toThrow(LedgerAppNotOpenError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/ledger-identity`
Expected: FAIL

- [ ] **Step 3: Implement APDU utilities**

Create `src/apdu.ts`:

```ts
import {
  LedgerAppNotOpenError,
  LedgerError,
  LedgerUserRejectedError,
} from './errors.js'

export const CLA = 0xe0

export const INS = {
  GET_APP_VERSION: 0x01,
  GET_PUBLIC_KEY: 0x02,
  SIGN_MESSAGE: 0x03,
  ECDH_X25519: 0x04,
} as const

const HARDENED_BIT = 0x80000000
const MAX_APDU_DATA = 255

export type APDUChunk = {
  p1: number
  p2: number
  data: Uint8Array
}

export function encodeDerivationPath(path: string): Uint8Array {
  const stripped = path.startsWith('m/') ? path.slice(2) : path
  const components = stripped.split('/')

  for (const component of components) {
    if (!component.endsWith("'")) {
      throw new Error(`Non-hardened component in path: "${component}" (Ed25519 requires hardened only)`)
    }
  }

  const buf = new Uint8Array(1 + components.length * 4)
  const view = new DataView(buf.buffer)
  buf[0] = components.length

  for (let i = 0; i < components.length; i++) {
    const index = Number.parseInt(components[i].slice(0, -1), 10)
    view.setUint32(1 + i * 4, (index | HARDENED_BIT) >>> 0, false)
  }

  return buf
}

export function encodeSignMessageChunks(
  pathBytes: Uint8Array,
  message: Uint8Array,
): Array<APDUChunk> {
  const chunks: Array<APDUChunk> = []

  // First chunk: derivation path + as much message as fits
  const firstDataCapacity = MAX_APDU_DATA - pathBytes.length
  const firstMessageSlice = message.slice(0, firstDataCapacity)
  const firstData = new Uint8Array(pathBytes.length + firstMessageSlice.length)
  firstData.set(pathBytes)
  firstData.set(firstMessageSlice, pathBytes.length)

  const isOnly = firstMessageSlice.length >= message.length
  chunks.push({ p1: 0x00, p2: isOnly ? 0x00 : 0x00, data: firstData })

  // Continuation chunks
  let offset = firstDataCapacity
  while (offset < message.length) {
    const slice = message.slice(offset, offset + MAX_APDU_DATA)
    offset += slice.length
    const isFinal = offset >= message.length
    chunks.push({ p1: 0x80, p2: isFinal ? 0x01 : 0x00, data: slice })
  }

  return chunks
}

export function parsePublicKeyResponse(data: Uint8Array): Uint8Array {
  if (data.length < 32) {
    throw new LedgerError(`Invalid public key response: expected 32 bytes, got ${data.length}`, 0)
  }
  return data.slice(0, 32)
}

export function parseSignatureResponse(data: Uint8Array): Uint8Array {
  if (data.length < 64) {
    throw new LedgerError(`Invalid signature response: expected 64 bytes, got ${data.length}`, 0)
  }
  return data.slice(0, 64)
}

export function parseSharedSecretResponse(data: Uint8Array): Uint8Array {
  if (data.length < 32) {
    throw new LedgerError(`Invalid shared secret response: expected 32 bytes, got ${data.length}`, 0)
  }
  return data.slice(0, 32)
}

export function checkStatusWord(sw: number): void {
  if (sw === 0x9000) return

  switch (sw) {
    case 0x6985:
      throw new LedgerUserRejectedError()
    case 0x6a82:
      throw new LedgerAppNotOpenError()
    case 0x6a80:
      throw new LedgerError('Invalid derivation path', sw)
    case 0x6d00:
      throw new LedgerError('Unknown command', sw)
    case 0x6e00:
      throw new LedgerError('Unknown CLA', sw)
    default:
      throw new LedgerError(`Ledger error: 0x${sw.toString(16).padStart(4, '0')}`, sw)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/ledger-identity`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ledger-identity/src/apdu.ts packages/ledger-identity/test/apdu.test.ts
git commit -m "feat(ledger-identity): APDU encoding/decoding utilities"
```

---

## Task 8: `createLedgerIdentityProvider`

**Files:**
- Create: `packages/ledger-identity/src/provider.ts`
- Create: `packages/ledger-identity/test/provider.test.ts`
- Update: `packages/ledger-identity/src/index.ts`

- [ ] **Step 1: Write failing tests with mocked transport**

Create `test/provider.test.ts` with a mock transport that simulates Ledger APDU responses. Tests should cover:
- `provideIdentity()` returns `FullIdentity` with correct DID
- `signToken()` sends correct APDU and produces verifiable JWT
- `agreeKey()` sends correct APDU and returns shared secret
- Same keyID returns same DID
- User rejection throws `LedgerUserRejectedError`

The mock transport should:
- For `GET_PUBLIC_KEY`: derive key using `@noble/curves/ed25519` from a test private key to produce the expected public key, simulating what the Ledger hardware would return
- For `SIGN_MESSAGE`: sign the reassembled message chunks with the test private key using `ed25519.sign()`, simulating on-device signing
- For `ECDH_X25519`: compute `x25519.getSharedSecret()` using the test key converted to Montgomery form

```ts
import { describe, expect, test } from 'vitest'

import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { isFullIdentity, verifyToken } from '@enkaku/token'

import { createLedgerIdentityProvider } from '../src/provider.js'
import { CLA, INS } from '../src/apdu.js'
import type { LedgerTransport } from '../src/types.js'

// Fixed test private key (simulates what's on the Ledger at a given path)
const TEST_PRIVATE_KEY = ed25519.utils.randomSecretKey()
const TEST_PUBLIC_KEY = ed25519.getPublicKey(TEST_PRIVATE_KEY)

function createMockTransport(): LedgerTransport {
  let messageBuffer = new Uint8Array(0)

  return {
    async send(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array) {
      if (cla !== CLA) throw new Error(`Unknown CLA: ${cla}`)

      switch (ins) {
        case INS.GET_PUBLIC_KEY:
          return TEST_PUBLIC_KEY

        case INS.SIGN_MESSAGE: {
          if (p1 === 0x00) {
            // First chunk — skip derivation path, accumulate message
            const pathLen = 1 + (data?.[0] ?? 0) * 4
            messageBuffer = data?.slice(pathLen) ?? new Uint8Array(0)
          } else {
            // Continuation chunk
            const combined = new Uint8Array(messageBuffer.length + (data?.length ?? 0))
            combined.set(messageBuffer)
            if (data != null) combined.set(data, messageBuffer.length)
            messageBuffer = combined
          }
          // Return signature (in real device, only on last chunk)
          return ed25519.sign(messageBuffer, TEST_PRIVATE_KEY)
        }

        case INS.ECDH_X25519: {
          // Skip derivation path, extract ephemeral public key
          const pathLen = 1 + (data?.[0] ?? 0) * 4
          const ephPub = data?.slice(pathLen)
          if (ephPub == null) throw new Error('Missing ephemeral public key')
          const x25519Private = ed25519.utils.toMontgomerySecret(TEST_PRIVATE_KEY)
          return x25519.getSharedSecret(x25519Private, ephPub)
        }

        default:
          throw new Error(`Unknown INS: ${ins}`)
      }
    },
  }
}

describe('createLedgerIdentityProvider()', () => {
  test('provideIdentity() returns FullIdentity', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same keyID returns same DID', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const a = await provider.provideIdentity('0')
    const b = await provider.provideIdentity('0')
    expect(a.id).toBe(b.id)
  })

  test('signToken() produces verifiable JWT', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    const token = await identity.signToken({ data: 'test' })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(`${token.data}.${token.signature}`)
    expect(verified.payload.data).toBe('test')
  })

  test('agreeKey() returns valid shared secret', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    const shared = await identity.agreeKey(ephPub)
    expect(shared).toBeInstanceOf(Uint8Array)
    expect(shared.length).toBe(32)
  })

  test('signToken() throws LedgerUserRejectedError on user rejection', async () => {
    const { LedgerUserRejectedError } = await import('../src/errors.js')
    const rejectTransport: LedgerTransport = {
      async send(cla, ins, _p1, _p2, data) {
        if (ins === INS.GET_PUBLIC_KEY) return TEST_PUBLIC_KEY
        if (ins === INS.SIGN_MESSAGE) {
          const error = new LedgerUserRejectedError()
          throw error
        }
        throw new Error(`Unexpected INS: ${ins}`)
      },
    }
    const provider = createLedgerIdentityProvider(rejectTransport)
    const identity = await provider.provideIdentity('0')
    await expect(identity.signToken({ data: 'test' })).rejects.toThrow(LedgerUserRejectedError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/ledger-identity`
Expected: FAIL

- [ ] **Step 3: Implement `createLedgerIdentityProvider`**

Create `src/provider.ts`:

```ts
import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import {
  CODECS,
  type FullIdentity,
  type IdentityProvider,
  getDID,
  type SignedToken,
} from '@enkaku/token'
import type { SignedHeader } from '@enkaku/token'

import {
  CLA,
  INS,
  encodeDerivationPath,
  encodeSignMessageChunks,
  parsePublicKeyResponse,
  parseSharedSecretResponse,
  parseSignatureResponse,
} from './apdu.js'
import { LedgerDisconnectedError } from './errors.js'
import type { LedgerTransport } from './types.js'

const DEFAULT_BASE_PATH = "44'/903'"
const tracer = createTracer('ledger-identity')
const logger = getEnkakuLogger('ledger-identity')

const INDEX_RE = /^\d+$/

function resolveKeyID(keyID: string, basePath: string): string {
  if (keyID.startsWith('m/')) return keyID
  if (INDEX_RE.test(keyID)) return `m/${basePath}/${keyID}'`
  throw new Error(`Invalid keyID: "${keyID}"`)
}

async function sendAPDU(
  transport: LedgerTransport,
  ins: number,
  p1: number,
  p2: number,
  data?: Uint8Array,
): Promise<Uint8Array> {
  try {
    return await transport.send(CLA, ins, p1, p2, data)
  } catch (error) {
    // Wrap transport errors as disconnection if they're not already LedgerErrors
    if (error instanceof Error && error.name === 'DisconnectedDevice') {
      throw new LedgerDisconnectedError(error)
    }
    throw error
  }
}

export type LedgerIdentityProviderOptions = {
  basePath?: string
}

export function createLedgerIdentityProvider(
  transport: LedgerTransport,
  options?: LedgerIdentityProviderOptions,
): IdentityProvider<FullIdentity> {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH
  const cache = new Map<string, FullIdentity>()

  async function provideIdentity(keyID: string): Promise<FullIdentity> {
    const path = resolveKeyID(keyID, basePath)
    const cached = cache.get(path)
    if (cached != null) return cached

    return withSpan(
      tracer,
      SpanNames.KEYSTORE_GET_OR_CREATE,
      { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'ledger' } },
      async (span) => {
        // Get public key from device
        const pathBytes = encodeDerivationPath(path)
        const rawKey = await sendAPDU(transport, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
        const publicKey = parsePublicKeyResponse(rawKey)
        const id = getDID(CODECS.EdDSA, publicKey)

        span.setAttribute(AttributeKeys.AUTH_DID, id)
        logger.info('Ledger identity resolved: {did}', { did: id })

        // signToken replicates the JWT construction from createSigningIdentity
        // in @enkaku/token, then delegates the actual signing to the Ledger device
        async function signToken<
          Payload extends Record<string, unknown> = Record<string, unknown>,
          Header extends Record<string, unknown> = Record<string, unknown>,
        >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
          return withSpan(
            tracer,
            SpanNames.TOKEN_SIGN,
            { attributes: { [AttributeKeys.AUTH_DID]: id, [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA' } },
            async () => {
              if (payload.iss != null && payload.iss !== id) {
                throw new Error('Invalid payload: issuer does not match signer')
              }

              const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
              const fullPayload = { ...payload, iss: id }
              const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

              // Send message to Ledger for signing
              const messageBytes = fromUTF(data)
              const chunks = encodeSignMessageChunks(pathBytes, messageBytes)

              let signatureBytes: Uint8Array = new Uint8Array(0)
              for (const chunk of chunks) {
                signatureBytes = await sendAPDU(
                  transport,
                  INS.SIGN_MESSAGE,
                  chunk.p1,
                  chunk.p2,
                  chunk.data,
                )
              }

              return {
                header: fullHeader,
                payload: fullPayload,
                signature: toB64U(parseSignatureResponse(signatureBytes)),
                data,
              }
            },
          )
        }

        async function agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array> {
          const data = new Uint8Array(pathBytes.length + ephemeralPublicKey.length)
          data.set(pathBytes)
          data.set(ephemeralPublicKey, pathBytes.length)
          const response = await sendAPDU(transport, INS.ECDH_X25519, 0x00, 0x00, data)
          return parseSharedSecretResponse(response)
        }

        async function decrypt(jwe: string): Promise<Uint8Array> {
          const { decryptToken } = await import('@enkaku/token')
          return decryptToken({ id, decrypt, agreeKey }, jwe)
        }

        const identity: FullIdentity = { id, signToken, agreeKey, decrypt }
        cache.set(path, identity)
        return identity
      },
    )
  }

  return { provideIdentity }
}
```

- [ ] **Step 4: Update `src/index.ts` with exports**

Add:
```ts
export { createLedgerIdentityProvider } from './provider.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/ledger-identity`
Expected: PASS

- [ ] **Step 6: Run full build**

Run: `pnpm run build --filter=@enkaku/ledger-identity`
Expected: builds successfully

- [ ] **Step 7: Commit**

```bash
git add packages/ledger-identity/
git commit -m "feat(ledger-identity): createLedgerIdentityProvider with FullIdentity"
```

---

## Task 9: Cross-package compatibility test

**Files:**
- Create: `packages/ledger-identity/test/compat.test.ts`

Verify that `hd-keystore` and `ledger-identity` produce interoperable identities when given the same key material.

- [ ] **Step 1: Write cross-compatibility test**

```ts
import { describe, expect, test } from 'vitest'

import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { mnemonicToSeedSync } from '@scure/bip39'
import { createTokenEncrypter, verifyToken } from '@enkaku/token'

import { HDKeyStore } from '@enkaku/hd-keystore'
import { createLedgerIdentityProvider } from '../src/provider.js'
import { CLA, INS } from '../src/apdu.js'
import type { LedgerTransport } from '../src/types.js'
import { derivePrivateKey, resolveDerivationPath } from '@enkaku/hd-keystore'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const SEED = mnemonicToSeedSync(MNEMONIC)

// Mock transport that derives keys the same way as HDKeyStore
function createHDMockTransport(seed: Uint8Array): LedgerTransport {
  let messageBuffer = new Uint8Array(0)

  function getPrivateKeyFromAPDU(data: Uint8Array): Uint8Array {
    const componentCount = data[0]
    const components: Array<string> = []
    for (let i = 0; i < componentCount; i++) {
      const view = new DataView(data.buffer, data.byteOffset + 1 + i * 4, 4)
      const val = view.getUint32(0, false)
      components.push(`${val & 0x7fffffff}'`)
    }
    const path = `m/${components.join('/')}`
    return derivePrivateKey(seed, path)
  }

  return {
    async send(cla: number, ins: number, p1: number, _p2: number, data?: Uint8Array) {
      if (data == null) throw new Error('Missing data')

      switch (ins) {
        case INS.GET_PUBLIC_KEY: {
          const privateKey = getPrivateKeyFromAPDU(data)
          return ed25519.getPublicKey(privateKey)
        }
        case INS.SIGN_MESSAGE: {
          if (p1 === 0x00) {
            const pathLen = 1 + data[0] * 4
            const privateKey = getPrivateKeyFromAPDU(data)
            messageBuffer = data.slice(pathLen)
            // Store private key for signing (simplified mock)
            ;(this as unknown as Record<string, Uint8Array>)._signKey = privateKey
          } else {
            const combined = new Uint8Array(messageBuffer.length + data.length)
            combined.set(messageBuffer)
            combined.set(data, messageBuffer.length)
            messageBuffer = combined
          }
          const signKey = (this as unknown as Record<string, Uint8Array>)._signKey
          return ed25519.sign(messageBuffer, signKey)
        }
        case INS.ECDH_X25519: {
          const privateKey = getPrivateKeyFromAPDU(data)
          const pathLen = 1 + data[0] * 4
          const ephPub = data.slice(pathLen)
          const x25519Priv = ed25519.utils.toMontgomerySecret(privateKey)
          return x25519.getSharedSecret(x25519Priv, ephPub)
        }
        default:
          throw new Error(`Unknown INS: ${ins}`)
      }
    },
  }
}

describe('HD keystore + Ledger identity cross-compatibility', () => {
  test('same mnemonic produces same DID', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    expect(hdIdentity.id).toBe(ledgerIdentity.id)
  })

  test('HD-signed token verifiable, Ledger-signed token verifiable', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    const hdToken = await hdIdentity.signToken({ source: 'hd' })
    const ledgerToken = await ledgerIdentity.signToken({ source: 'ledger' })

    const hdVerified = await verifyToken(`${hdToken.data}.${hdToken.signature}`)
    const ledgerVerified = await verifyToken(`${ledgerToken.data}.${ledgerToken.signature}`)

    expect(hdVerified.payload.source).toBe('hd')
    expect(ledgerVerified.payload.source).toBe('ledger')
    // Both issued by same DID
    expect(hdVerified.payload.iss).toBe(ledgerVerified.payload.iss)
  })

  test('ECDH key agreement produces same shared secret', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)

    const hdShared = await hdIdentity.agreeKey(ephPub)
    const ledgerShared = await ledgerIdentity.agreeKey(ephPub)

    expect(hdShared).toEqual(ledgerShared)
  })
})
```

- [ ] **Step 2: Run compatibility tests**

Run: `pnpm run test:unit --filter=@enkaku/ledger-identity`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/ledger-identity/test/compat.test.ts
git commit -m "test(ledger-identity): cross-compatibility with hd-keystore"
```

---

## Task 10: Custom Ledger App (follow-up — requires BOLOS SDK expertise)

> **Note:** This task requires C/BOLOS SDK domain expertise and is scoped as a separate follow-up. The TypeScript packages (`hd-keystore`, `ledger-identity`) are fully functional with mocked transports and can be integration-tested once the Ledger app is built. The APDU protocol is fully specified in the design spec and implemented in `@enkaku/ledger-identity/src/apdu.ts`.

**Directory:** `apps/ledger/` (C project, not in pnpm workspace)

**APDU protocol to implement:**

| INS | Command | Input | Output | Confirm? |
|-----|---------|-------|--------|----------|
| `0x01` | `GET_APP_VERSION` | none | version bytes | No |
| `0x02` | `GET_PUBLIC_KEY` | encoded path | 32-byte Ed25519 public key | No |
| `0x03` | `SIGN_MESSAGE` | encoded path + chunked message | 64-byte Ed25519 signature | Yes |
| `0x04` | `ECDH_X25519` | encoded path + 32-byte ephemeral key | 32-byte shared secret | Yes |

**Key BOLOS SDK functions:**
- `cx_ecfp_generate_pair_no_throw(CX_CURVE_Ed25519, ...)` for key derivation
- `cx_eddsa_sign_no_throw(&privKey, CX_SHA512, msg, msgLen, sig, 64)` for signing
- `cx_ecdh(&privKey, CX_ECDH_X25519, ephPub, 32, secret, 32)` for ECDH

**Build toolchain:** Docker via `ghcr.io/ledgerhq/ledger-app-builder`, test via Speculos emulator.

**Reference:** See `packages/ledger-identity/src/apdu.ts` for the exact encoding format the TypeScript client expects, and `packages/ledger-identity/test/provider.test.ts` for the mock transport that simulates expected device behavior.

- [ ] **Step 1: Scaffold app structure** (`Makefile`, `src/main.c`, `src/constants.h`, `src/globals.h`, `Dockerfile`)
- [ ] **Step 2: Implement `GET_PUBLIC_KEY` handler**
- [ ] **Step 3: Implement `SIGN_MESSAGE` handler with APDU chunking**
- [ ] **Step 4: Implement `ECDH_X25519` handler**
- [ ] **Step 5: Test with Speculos emulator against `@enkaku/ledger-identity` integration tests**
- [ ] **Step 6: Commit**

```bash
git add apps/ledger/
git commit -m "feat(ledger-app): BOLOS app with Ed25519 signing and X25519 ECDH"
```

---

## Task 11: Lint and final verification

**Files:** all new/modified files

- [ ] **Step 1: Run linter**

Run: `pnpm run lint`
Fix any formatting issues.

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test`
Expected: all tests pass (type checks + unit tests)

- [ ] **Step 3: Run full build**

Run: `pnpm run build`
Expected: all packages build successfully

- [ ] **Step 4: Commit any lint fixes**

```bash
git add packages/hd-keystore/ packages/ledger-identity/ packages/token/src/identity.ts
git commit -m "chore: lint fixes"
```
