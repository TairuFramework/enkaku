import type { Welcome } from 'ts-mls'
import {
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl as getImpl,
  joinGroup,
  type Proposal,
  processPrivateMessage,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

import { nobleCryptoProvider } from '../src/crypto.js'

const CIPHERSUITE_NAME = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

function requireWelcome(welcome: Welcome | undefined): Welcome {
  if (welcome == null) throw new Error('Expected welcome message')
  return welcome
}

async function getCiphersuiteImpl() {
  const cs = getCiphersuiteFromName(CIPHERSUITE_NAME)
  return await getImpl(cs, nobleCryptoProvider)
}

function makeCredential(name: string): Credential {
  return {
    credentialType: 'basic',
    identity: new TextEncoder().encode(name),
  }
}

describe('nobleCryptoProvider', () => {
  test('creates a group and adds a member', async () => {
    const impl = await getCiphersuiteImpl()

    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('noble-group'),
      alice.publicPackage,
      alice.privatePackage,
      [],
      impl,
    )
    expect(aliceState.groupContext.epoch).toBe(0n)

    const bob = await generateKeyPackage(
      makeCredential('bob'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    const addProposal: Proposal = {
      proposalType: 'add',
      add: { keyPackage: bob.publicPackage },
    }
    const commitResult = await createCommit(
      { state: aliceState, cipherSuite: impl },
      { extraProposals: [addProposal] },
    )
    aliceState = commitResult.newState
    expect(aliceState.groupContext.epoch).toBe(1n)
    expect(commitResult.welcome).toBeDefined()

    const bobState = await joinGroup(
      requireWelcome(commitResult.welcome),
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )
    expect(bobState.groupContext.epoch).toBe(1n)
  })

  test('encrypts and decrypts messages', async () => {
    const impl = await getCiphersuiteImpl()

    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('noble-msg'),
      alice.publicPackage,
      alice.privatePackage,
      [],
      impl,
    )

    const bob = await generateKeyPackage(
      makeCredential('bob'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    const addResult = await createCommit(
      { state: aliceState, cipherSuite: impl },
      { extraProposals: [{ proposalType: 'add', add: { keyPackage: bob.publicPackage } }] },
    )
    aliceState = addResult.newState

    let bobState = await joinGroup(
      requireWelcome(addResult.welcome),
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )

    // Alice → Bob
    const { newState: aliceState2, privateMessage } = await createApplicationMessage(
      aliceState,
      new TextEncoder().encode('hello from noble provider'),
      impl,
    )
    aliceState = aliceState2

    const result = await processPrivateMessage(bobState, privateMessage, emptyPskIndex, impl)
    expect(result.kind).toBe('applicationMessage')
    if (result.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(result.message)).toBe('hello from noble provider')
      bobState = result.newState
    }

    // Bob → Alice
    const { newState: bobState2, privateMessage: bobMsg } = await createApplicationMessage(
      bobState,
      new TextEncoder().encode('noble reply'),
      impl,
    )
    bobState = bobState2

    const aliceResult = await processPrivateMessage(aliceState, bobMsg, emptyPskIndex, impl)
    expect(aliceResult.kind).toBe('applicationMessage')
    if (aliceResult.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(aliceResult.message)).toBe('noble reply')
    }
  })

  test('member removal with forward secrecy', async () => {
    const impl = await getCiphersuiteImpl()

    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('noble-fs'),
      alice.publicPackage,
      alice.privatePackage,
      [],
      impl,
    )

    const bob = await generateKeyPackage(
      makeCredential('bob'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    const addBob = await createCommit(
      { state: aliceState, cipherSuite: impl },
      { extraProposals: [{ proposalType: 'add', add: { keyPackage: bob.publicPackage } }] },
    )
    aliceState = addBob.newState
    const bobState = await joinGroup(
      requireWelcome(addBob.welcome),
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )

    // Remove Bob
    const removeResult = await createCommit(
      { state: aliceState, cipherSuite: impl },
      { extraProposals: [{ proposalType: 'remove', remove: { removed: 1 } }] },
    )
    aliceState = removeResult.newState
    expect(aliceState.groupContext.epoch).toBe(2n)

    // Post-removal message cannot be decrypted by Bob
    const { privateMessage } = await createApplicationMessage(
      aliceState,
      new TextEncoder().encode('secret'),
      impl,
    )
    await expect(
      processPrivateMessage(bobState, privateMessage, emptyPskIndex, impl),
    ).rejects.toThrow()
  })

  test('HPKE seal and open round-trip', async () => {
    const impl = await getCiphersuiteImpl()

    const kp = await impl.hpke.generateKeyPair()
    const plaintext = new TextEncoder().encode('hpke test message')
    const info = new TextEncoder().encode('test info')
    const aad = new TextEncoder().encode('test aad')

    const { ct, enc } = await impl.hpke.seal(kp.publicKey, plaintext, info, aad)
    const decrypted = await impl.hpke.open(kp.privateKey, enc, ct, info, aad)
    expect(new TextDecoder().decode(decrypted)).toBe('hpke test message')
  })

  test('AEAD encrypt and decrypt', async () => {
    const impl = await getCiphersuiteImpl()

    const key = impl.rng.randomBytes(16) // AES-128
    const nonce = impl.rng.randomBytes(12)
    const aad = new TextEncoder().encode('aad')
    const plaintext = new TextEncoder().encode('aead test')

    const ct = await impl.hpke.encryptAead(key, nonce, aad, plaintext)
    const pt = await impl.hpke.decryptAead(key, nonce, aad, ct)
    expect(new TextDecoder().decode(pt)).toBe('aead test')
  })

  test('KDF extract and expand', async () => {
    const impl = await getCiphersuiteImpl()

    const salt = new TextEncoder().encode('salt')
    const ikm = new TextEncoder().encode('input key material')

    const prk = await impl.kdf.extract(salt, ikm)
    expect(prk).toBeInstanceOf(Uint8Array)
    expect(prk.length).toBe(32) // SHA-256

    const okm = await impl.kdf.expand(prk, new TextEncoder().encode('info'), 42)
    expect(okm).toBeInstanceOf(Uint8Array)
    expect(okm.length).toBe(42)
  })

  test('signature sign and verify', async () => {
    const impl = await getCiphersuiteImpl()

    const { signKey, publicKey } = await impl.signature.keygen()
    const message = new TextEncoder().encode('sign this')

    const sig = await impl.signature.sign(signKey, message)
    expect(await impl.signature.verify(publicKey, message, sig)).toBe(true)

    // Tampered message should not verify
    const tampered = new TextEncoder().encode('tampered')
    expect(await impl.signature.verify(publicKey, tampered, sig)).toBe(false)
  })

  test('hash digest and HMAC', async () => {
    const impl = await getCiphersuiteImpl()

    const data = new TextEncoder().encode('hash me')
    const digest = await impl.hash.digest(data)
    expect(digest).toBeInstanceOf(Uint8Array)
    expect(digest.length).toBe(32) // SHA-256

    const key = new TextEncoder().encode('hmac key')
    const mac = await impl.hash.mac(key, data)
    expect(mac).toBeInstanceOf(Uint8Array)
    expect(mac.length).toBe(32)

    expect(await impl.hash.verifyMac(key, mac, data)).toBe(true)
    expect(await impl.hash.verifyMac(key, new Uint8Array(32), data)).toBe(false)
  })

  test('key pair derivation is deterministic', async () => {
    const impl = await getCiphersuiteImpl()

    const ikm = new TextEncoder().encode('deterministic seed material for testing')
    const kp1 = await impl.hpke.deriveKeyPair(ikm)
    const kp2 = await impl.hpke.deriveKeyPair(ikm)

    const pk1 = await impl.hpke.exportPublicKey(kp1.publicKey)
    const pk2 = await impl.hpke.exportPublicKey(kp2.publicKey)
    expect(pk1).toEqual(pk2)

    const sk1 = await impl.hpke.exportPrivateKey(kp1.privateKey)
    const sk2 = await impl.hpke.exportPrivateKey(kp2.privateKey)
    expect(sk1).toEqual(sk2)
  })

  test('HPKE export secret', async () => {
    const impl = await getCiphersuiteImpl()

    const kp = await impl.hpke.generateKeyPair()
    const exporterContext = new TextEncoder().encode('test exporter')
    const info = new TextEncoder().encode('test info')

    const { enc, secret } = await impl.hpke.exportSecret(kp.publicKey, exporterContext, 32, info)
    expect(enc).toBeInstanceOf(Uint8Array)
    expect(secret).toBeInstanceOf(Uint8Array)
    expect(secret.length).toBe(32)

    // Recipient can derive the same secret
    const recipientSecret = await impl.hpke.importSecret(
      kp.privateKey,
      exporterContext,
      enc,
      32,
      info,
    )
    expect(recipientSecret).toEqual(secret)
  })

  test('HPKE open rejects with invalid key object', async () => {
    const impl = await getCiphersuiteImpl()
    await expect(
      impl.hpke.open('not-a-key', new Uint8Array(32), new Uint8Array(32), new Uint8Array(0)),
    ).rejects.toThrow('Invalid key')
  })

  test('createNobleCryptoProvider uses custom randomBytes', async () => {
    const { createNobleCryptoProvider } = await import('../src/crypto.js')
    let callCount = 0
    const customRandom = (n: number): Uint8Array => {
      callCount++
      return crypto.getRandomValues(new Uint8Array(n))
    }
    const provider = createNobleCryptoProvider({ randomBytes: customRandom })
    const cs = getCiphersuiteFromName(CIPHERSUITE_NAME)
    const customImpl = await getImpl(cs, provider)

    // RNG should use our custom function
    customImpl.rng.randomBytes(16)
    expect(callCount).toBe(1)
  })
})
