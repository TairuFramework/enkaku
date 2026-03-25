import { ed25519 } from '@noble/curves/ed25519.js'
import {
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  type DefaultProposal,
  decode,
  defaultCapabilities,
  defaultCredentialTypes,
  defaultLifetime,
  defaultProposalTypes,
  encode,
  generateKeyPackage,
  generateKeyPackageWithKey,
  getCiphersuiteImpl as getImpl,
  joinGroup,
  type MlsContext,
  type MlsWelcomeMessage,
  mlsMessageDecoder,
  mlsMessageEncoder,
  nobleCryptoProvider,
  nodeTypes,
  processPrivateMessage,
  protocolVersions,
  unsafeTestingAuthenticationService,
  wireformats,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

const CIPHERSUITE_NAME = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

function requireWelcome(welcome: MlsWelcomeMessage | undefined): MlsWelcomeMessage {
  if (welcome == null) throw new Error('Expected welcome message')
  return welcome
}

async function getCiphersuiteImpl() {
  return await getImpl(CIPHERSUITE_NAME, nobleCryptoProvider)
}

function makeContext(impl: Awaited<ReturnType<typeof getCiphersuiteImpl>>): MlsContext {
  return { cipherSuite: impl, authService: unsafeTestingAuthenticationService }
}

function makeCredential(name: string): Credential {
  return {
    credentialType: defaultCredentialTypes.basic,
    identity: new TextEncoder().encode(name),
  }
}

function countLeafNodes(state: ClientState): number {
  return state.ratchetTree.filter((node) => node !== undefined && node.nodeType === nodeTypes.leaf)
    .length
}

describe('ts-mls integration spike', () => {
  test('creates a group and adds a member', async () => {
    const impl = await getCiphersuiteImpl()
    const context = makeContext(impl)

    // Create Alice's credential and key package
    const aliceCredential = makeCredential('alice')
    const alice = await generateKeyPackage({
      credential: aliceCredential,
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })

    // Create group with Alice as sole member
    let aliceState = await createGroup({
      context,
      groupId: new TextEncoder().encode('test-group'),
      keyPackage: alice.publicPackage,
      privateKeyPackage: alice.privatePackage,
    })

    expect(aliceState.groupContext.epoch).toBe(0n)
    expect(countLeafNodes(aliceState)).toBe(1)

    // Create Bob's key package
    const bobCredential = makeCredential('bob')
    const bob = await generateKeyPackage({
      credential: bobCredential,
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })

    // Add Bob via proposal + commit
    const addProposal: DefaultProposal = {
      proposalType: defaultProposalTypes.add,
      add: { keyPackage: bob.publicPackage },
    }
    const commitResult = await createCommit({
      context,
      state: aliceState,
      extraProposals: [addProposal],
    })
    aliceState = commitResult.newState

    expect(aliceState.groupContext.epoch).toBe(1n)
    expect(countLeafNodes(aliceState)).toBe(2)
    expect(commitResult.welcome).toBeDefined()

    // Bob joins via Welcome
    const bobState = await joinGroup({
      context,
      welcome: requireWelcome(commitResult.welcome).welcome,
      keyPackage: bob.publicPackage,
      privateKeys: bob.privatePackage,
      ratchetTree: aliceState.ratchetTree,
    })

    expect(bobState.groupContext.epoch).toBe(1n)
    expect(countLeafNodes(bobState)).toBe(2)
  })

  test('encrypts and decrypts application messages', async () => {
    const impl = await getCiphersuiteImpl()
    const context = makeContext(impl)

    // Setup: Alice creates group, adds Bob
    const alice = await generateKeyPackage({
      credential: makeCredential('alice'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    let aliceState = await createGroup({
      context,
      groupId: new TextEncoder().encode('msg-group'),
      keyPackage: alice.publicPackage,
      privateKeyPackage: alice.privatePackage,
    })

    const bob = await generateKeyPackage({
      credential: makeCredential('bob'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    const addResult = await createCommit({
      context,
      state: aliceState,
      extraProposals: [
        { proposalType: defaultProposalTypes.add, add: { keyPackage: bob.publicPackage } },
      ],
    })
    aliceState = addResult.newState

    let bobState = await joinGroup({
      context,
      welcome: requireWelcome(addResult.welcome).welcome,
      keyPackage: bob.publicPackage,
      privateKeys: bob.privatePackage,
      ratchetTree: aliceState.ratchetTree,
    })

    // Alice encrypts a message
    const plaintext = new TextEncoder().encode('hello from alice')
    const aliceMsg = await createApplicationMessage({
      context,
      state: aliceState,
      message: plaintext,
    })
    aliceState = aliceMsg.newState

    // Bob decrypts the message — extract privateMessage from the MlsFramedMessage
    const privateMsg =
      aliceMsg.message.wireformat === wireformats.mls_private_message
        ? aliceMsg.message.privateMessage
        : (() => {
            throw new Error('Expected private message')
          })()
    const result = await processPrivateMessage({
      context,
      state: bobState,
      privateMessage: privateMsg,
    })
    expect(result.kind).toBe('applicationMessage')
    if (result.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(result.message)).toBe('hello from alice')
      bobState = result.newState
    }

    // Bob encrypts a reply
    const reply = new TextEncoder().encode('hello from bob')
    const bobMsg = await createApplicationMessage({
      context,
      state: bobState,
      message: reply,
    })
    bobState = bobMsg.newState

    // Alice decrypts the reply
    const bobPrivateMsg =
      bobMsg.message.wireformat === wireformats.mls_private_message
        ? bobMsg.message.privateMessage
        : (() => {
            throw new Error('Expected private message')
          })()
    const aliceResult = await processPrivateMessage({
      context,
      state: aliceState,
      privateMessage: bobPrivateMsg,
    })
    expect(aliceResult.kind).toBe('applicationMessage')
    if (aliceResult.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(aliceResult.message)).toBe('hello from bob')
    }
  })

  test('uses Enkaku Ed25519 keys via generateKeyPackageWithKey', async () => {
    const impl = await getCiphersuiteImpl()
    const context = makeContext(impl)

    // Generate Ed25519 key pair the same way Enkaku does (via @noble/curves)
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    const credential = makeCredential('enkaku-user')
    const keyPackage = await generateKeyPackageWithKey({
      credential,
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      signatureKeyPair: { signKey: privateKey, publicKey },
      cipherSuite: impl,
    })

    expect(keyPackage.publicPackage).toBeDefined()
    expect(keyPackage.privatePackage).toBeDefined()
    expect(keyPackage.privatePackage.signaturePrivateKey).toEqual(privateKey)

    // Verify this key package can be used to create a group
    const state = await createGroup({
      context,
      groupId: new TextEncoder().encode('enkaku-group'),
      keyPackage: keyPackage.publicPackage,
      privateKeyPackage: keyPackage.privatePackage,
    })
    expect(state.groupContext.epoch).toBe(0n)
  })

  test('removes a member and verifies forward secrecy', async () => {
    const impl = await getCiphersuiteImpl()
    const context = makeContext(impl)

    // Setup: Alice creates group with Bob
    const alice = await generateKeyPackage({
      credential: makeCredential('alice'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    let aliceState = await createGroup({
      context,
      groupId: new TextEncoder().encode('fs-group'),
      keyPackage: alice.publicPackage,
      privateKeyPackage: alice.privatePackage,
    })

    const bob = await generateKeyPackage({
      credential: makeCredential('bob'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    const addBob = await createCommit({
      context,
      state: aliceState,
      extraProposals: [
        { proposalType: defaultProposalTypes.add, add: { keyPackage: bob.publicPackage } },
      ],
    })
    aliceState = addBob.newState
    const bobState = await joinGroup({
      context,
      welcome: requireWelcome(addBob.welcome).welcome,
      keyPackage: bob.publicPackage,
      privateKeys: bob.privatePackage,
      ratchetTree: aliceState.ratchetTree,
    })

    // Remove Bob
    const removeProposal: DefaultProposal = {
      proposalType: defaultProposalTypes.remove,
      remove: { removed: 1 }, // Bob is at leaf index 1
    }
    const removeResult = await createCommit({
      context,
      state: aliceState,
      extraProposals: [removeProposal],
    })
    aliceState = removeResult.newState

    // Epoch advanced
    expect(aliceState.groupContext.epoch).toBe(2n)
    expect(countLeafNodes(aliceState)).toBe(1)

    // Alice sends message in new epoch — Bob's old state cannot decrypt
    const aliceMsg = await createApplicationMessage({
      context,
      state: aliceState,
      message: new TextEncoder().encode('secret after removal'),
    })

    const privateMsg =
      aliceMsg.message.wireformat === wireformats.mls_private_message
        ? aliceMsg.message.privateMessage
        : (() => {
            throw new Error('Expected private message')
          })()

    // Bob tries to decrypt with old state — should fail
    await expect(
      processPrivateMessage({
        context,
        state: bobState,
        privateMessage: privateMsg,
      }),
    ).rejects.toThrow()
  })

  test('message encoding round-trip', async () => {
    const impl = await getCiphersuiteImpl()
    const context = makeContext(impl)

    const alice = await generateKeyPackage({
      credential: makeCredential('alice'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    let aliceState = await createGroup({
      context,
      groupId: new TextEncoder().encode('codec-group'),
      keyPackage: alice.publicPackage,
      privateKeyPackage: alice.privatePackage,
    })

    const bob = await generateKeyPackage({
      credential: makeCredential('bob'),
      capabilities: defaultCapabilities(),
      lifetime: defaultLifetime(),
      cipherSuite: impl,
    })
    const addResult = await createCommit({
      context,
      state: aliceState,
      extraProposals: [
        { proposalType: defaultProposalTypes.add, add: { keyPackage: bob.publicPackage } },
      ],
    })
    aliceState = addResult.newState

    // Encode welcome for transport
    const welcomeWrapper = requireWelcome(addResult.welcome)
    const welcomeMsg = encode(mlsMessageEncoder, {
      welcome: welcomeWrapper.welcome,
      wireformat: wireformats.mls_welcome,
      version: protocolVersions.mls10,
    })
    expect(welcomeMsg).toBeInstanceOf(Uint8Array)

    // Decode welcome
    const decoded = decode(mlsMessageDecoder, welcomeMsg)
    expect(decoded).toBeDefined()

    expect(decoded?.wireformat).toBe(wireformats.mls_welcome)
    if (decoded?.wireformat === wireformats.mls_welcome) {
      // Use decoded welcome to join
      const bobState = await joinGroup({
        context,
        welcome: (decoded as MlsWelcomeMessage).welcome,
        keyPackage: bob.publicPackage,
        privateKeys: bob.privatePackage,
        ratchetTree: aliceState.ratchetTree,
      })
      expect(bobState.groupContext.epoch).toBe(1n)
    }
  })
})
