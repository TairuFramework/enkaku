import { ed25519 } from '@noble/curves/ed25519.js'
import {
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeMlsMessage,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  encodeMlsMessage,
  generateKeyPackage,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl as getImpl,
  joinGroup,
  nobleCryptoProvider,
  type Proposal,
  processPrivateMessage,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

const CIPHERSUITE_NAME = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

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

function countLeafNodes(state: ClientState): number {
  return state.ratchetTree.filter((node) => node !== undefined && node.nodeType === 'leaf').length
}

describe('ts-mls integration spike', () => {
  test('creates a group and adds a member', async () => {
    const impl = await getCiphersuiteImpl()

    // Create Alice's credential and key package
    const aliceCredential = makeCredential('alice')
    const alice = await generateKeyPackage(
      aliceCredential,
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )

    // Create group with Alice as sole member
    let aliceState = await createGroup(
      new TextEncoder().encode('test-group'),
      alice.publicPackage,
      alice.privatePackage,
      [],
      impl,
    )

    expect(aliceState.groupContext.epoch).toBe(0n)
    expect(countLeafNodes(aliceState)).toBe(1)

    // Create Bob's key package
    const bobCredential = makeCredential('bob')
    const bob = await generateKeyPackage(
      bobCredential,
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )

    // Add Bob via proposal + commit
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
    expect(countLeafNodes(aliceState)).toBe(2)
    expect(commitResult.welcome).toBeDefined()

    // Bob joins via Welcome
    const bobState = await joinGroup(
      commitResult.welcome!,
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )

    expect(bobState.groupContext.epoch).toBe(1n)
    expect(countLeafNodes(bobState)).toBe(2)
  })

  test('encrypts and decrypts application messages', async () => {
    const impl = await getCiphersuiteImpl()

    // Setup: Alice creates group, adds Bob
    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('msg-group'),
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
      {
        extraProposals: [{ proposalType: 'add', add: { keyPackage: bob.publicPackage } }],
      },
    )
    aliceState = addResult.newState

    let bobState = await joinGroup(
      addResult.welcome!,
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )

    // Alice encrypts a message
    const plaintext = new TextEncoder().encode('hello from alice')
    const { newState: aliceState2, privateMessage } = await createApplicationMessage(
      aliceState,
      plaintext,
      impl,
    )
    aliceState = aliceState2

    // Bob decrypts the message
    const result = await processPrivateMessage(bobState, privateMessage, emptyPskIndex, impl)
    expect(result.kind).toBe('applicationMessage')
    if (result.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(result.message)).toBe('hello from alice')
      bobState = result.newState
    }

    // Bob encrypts a reply
    const reply = new TextEncoder().encode('hello from bob')
    const { newState: bobState2, privateMessage: bobMsg } = await createApplicationMessage(
      bobState,
      reply,
      impl,
    )
    bobState = bobState2

    // Alice decrypts the reply
    const aliceResult = await processPrivateMessage(aliceState, bobMsg, emptyPskIndex, impl)
    expect(aliceResult.kind).toBe('applicationMessage')
    if (aliceResult.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(aliceResult.message)).toBe('hello from bob')
    }
  })

  test('uses Enkaku Ed25519 keys via generateKeyPackageWithKey', async () => {
    const impl = await getCiphersuiteImpl()

    // Generate Ed25519 key pair the same way Enkaku does (via @noble/curves)
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    const credential = makeCredential('enkaku-user')
    const keyPackage = await generateKeyPackageWithKey(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      [],
      { signKey: privateKey, publicKey },
      impl,
    )

    expect(keyPackage.publicPackage).toBeDefined()
    expect(keyPackage.privatePackage).toBeDefined()
    expect(keyPackage.privatePackage.signaturePrivateKey).toEqual(privateKey)

    // Verify this key package can be used to create a group
    const state = await createGroup(
      new TextEncoder().encode('enkaku-group'),
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      [],
      impl,
    )
    expect(state.groupContext.epoch).toBe(0n)
  })

  test('removes a member and verifies forward secrecy', async () => {
    const impl = await getCiphersuiteImpl()

    // Setup: Alice creates group with Bob
    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('fs-group'),
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
      addBob.welcome!,
      bob.publicPackage,
      bob.privatePackage,
      emptyPskIndex,
      impl,
      aliceState.ratchetTree,
    )

    // Remove Bob
    const removeProposal: Proposal = {
      proposalType: 'remove',
      remove: { removed: 1 }, // Bob is at leaf index 1
    }
    const removeResult = await createCommit(
      { state: aliceState, cipherSuite: impl },
      { extraProposals: [removeProposal] },
    )
    aliceState = removeResult.newState

    // Epoch advanced
    expect(aliceState.groupContext.epoch).toBe(2n)
    expect(countLeafNodes(aliceState)).toBe(1)

    // Alice sends message in new epoch — Bob's old state cannot decrypt
    const { privateMessage } = await createApplicationMessage(
      aliceState,
      new TextEncoder().encode('secret after removal'),
      impl,
    )

    // Bob tries to decrypt with old state — should fail
    await expect(
      processPrivateMessage(bobState, privateMessage, emptyPskIndex, impl),
    ).rejects.toThrow()
  })

  test('message encoding round-trip', async () => {
    const impl = await getCiphersuiteImpl()

    const alice = await generateKeyPackage(
      makeCredential('alice'),
      defaultCapabilities(),
      defaultLifetime,
      [],
      impl,
    )
    let aliceState = await createGroup(
      new TextEncoder().encode('codec-group'),
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

    // Encode welcome for transport
    const welcomeMsg = encodeMlsMessage({
      welcome: addResult.welcome!,
      wireformat: 'mls_welcome',
      version: 'mls10',
    })
    expect(welcomeMsg).toBeInstanceOf(Uint8Array)

    // Decode welcome — decoder returns [value, bytesConsumed] tuple
    const decodeResult = decodeMlsMessage(welcomeMsg, 0)
    expect(decodeResult).toBeDefined()
    const [decoded] = decodeResult!

    expect(decoded.wireformat).toBe('mls_welcome')
    if (decoded.wireformat === 'mls_welcome') {
      // Use decoded welcome to join
      const bobState = await joinGroup(
        decoded.welcome,
        bob.publicPackage,
        bob.privatePackage,
        emptyPskIndex,
        impl,
        aliceState.ratchetTree,
      )
      expect(bobState.groupContext.epoch).toBe(1n)
    }
  })
})
