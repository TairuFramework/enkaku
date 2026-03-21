import type { OwnIdentity, SigningIdentity } from '@enkaku/token'
import { stringifyToken, verifyToken } from '@enkaku/token'
import { ed25519 } from '@noble/curves/ed25519.js'
import {
  type CiphersuiteImpl,
  type CiphersuiteName,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  type KeyPackage,
  createGroup as mlsCreateGroup,
  joinGroup as mlsJoinGroup,
  type Proposal,
  processPrivateMessage,
} from 'ts-mls'

import {
  createGroupCapability,
  delegateGroupMembership,
  type GroupPermission,
} from './capability.js'
import type { MemberCredential } from './credential.js'
import { nobleCryptoProvider } from './crypto.js'
import type { GroupOptions, Invite, KeyPackageBundle } from './types.js'

const DEFAULT_CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

async function resolveCiphersuite(options?: GroupOptions): Promise<CiphersuiteImpl> {
  const name = (options?.ciphersuiteName ?? DEFAULT_CIPHERSUITE) as CiphersuiteName
  const provider = options?.cryptoProvider ?? nobleCryptoProvider
  const cs = getCiphersuiteFromName(name)
  return await getCiphersuiteImpl(cs, provider)
}

function getSignatureKeys(identity: OwnIdentity): {
  signKey: Uint8Array
  publicKey: Uint8Array
} {
  const publicKey = ed25519.getPublicKey(identity.privateKey)
  return { signKey: identity.privateKey, publicKey }
}

function makeMLSCredential(did: string): Credential {
  return {
    credentialType: 'basic',
    identity: new TextEncoder().encode(did),
  }
}

export type GroupHandleParams = {
  state: ClientState
  credential: MemberCredential
  ciphersuite: CiphersuiteImpl
  /** Stringified root capability (for delegation) */
  rootCapability: string
}

/**
 * Mutable wrapper around MLS group state + Enkaku credential.
 */
export class GroupHandle {
  #state: ClientState
  #credential: MemberCredential
  #ciphersuite: CiphersuiteImpl
  #rootCapability: string

  constructor(params: GroupHandleParams) {
    this.#state = params.state
    this.#credential = params.credential
    this.#ciphersuite = params.ciphersuite
    this.#rootCapability = params.rootCapability
  }

  get groupID(): string {
    return this.#credential.groupID
  }

  get epoch(): bigint {
    return this.#state.groupContext.epoch
  }

  get credential(): MemberCredential {
    return this.#credential
  }

  get state(): ClientState {
    return this.#state
  }

  get rootCapability(): string {
    return this.#rootCapability
  }

  get ciphersuite(): CiphersuiteImpl {
    return this.#ciphersuite
  }

  get memberCount(): number {
    return this.#state.ratchetTree.filter((node) => node !== undefined && node.nodeType === 'leaf')
      .length
  }

  /**
   * Encrypt an application message for the group.
   */
  async encrypt(plaintext: Uint8Array): Promise<{ message: unknown; consumed: Array<Uint8Array> }> {
    const { newState, privateMessage, consumed } = await createApplicationMessage(
      this.#state,
      plaintext,
      this.#ciphersuite,
    )
    this.#state = newState
    return { message: privateMessage, consumed }
  }

  /**
   * Decrypt an application message from the group.
   */
  async decrypt(privateMessage: unknown): Promise<Uint8Array> {
    const result = await processPrivateMessage(
      this.#state,
      privateMessage as Parameters<typeof processPrivateMessage>[1],
      emptyPskIndex,
      this.#ciphersuite,
    )
    if (result.kind === 'applicationMessage') {
      this.#state = result.newState
      return result.message
    }
    // Commit or proposal — state was updated
    this.#state = result.newState
    throw new Error('Expected application message but received handshake message')
  }

  /**
   * Process a received MLS message (Commit, Proposal, or application).
   */
  async processMessage(privateMessage: unknown): Promise<Uint8Array | null> {
    const result = await processPrivateMessage(
      this.#state,
      privateMessage as Parameters<typeof processPrivateMessage>[1],
      emptyPskIndex,
      this.#ciphersuite,
    )
    this.#state = result.newState
    if (result.kind === 'applicationMessage') {
      return result.message
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Lifecycle functions
// ---------------------------------------------------------------------------

export type CreateGroupResult = {
  group: GroupHandle
  credential: MemberCredential
}

/**
 * Create a new MLS group. The identity becomes the sole member and admin.
 */
export async function createGroup(
  identity: OwnIdentity,
  groupID: string,
  options?: GroupOptions,
): Promise<CreateGroupResult> {
  const impl = await resolveCiphersuite(options)
  const keys = getSignatureKeys(identity)

  const mlsCredential = makeMLSCredential(identity.id)
  const [keyPackage, rootCap] = await Promise.all([
    generateKeyPackageWithKey(
      mlsCredential,
      defaultCapabilities(),
      defaultLifetime,
      [],
      keys,
      impl,
    ),
    createGroupCapability(identity, groupID),
  ])

  const state = await mlsCreateGroup(
    new TextEncoder().encode(groupID),
    keyPackage.publicPackage,
    keyPackage.privatePackage,
    [],
    impl,
  )
  const rootCapStr = stringifyToken(rootCap)

  const credential: MemberCredential = {
    did: identity.id,
    capabilityChain: [rootCapStr],
    capability: rootCap,
    permission: 'admin',
    groupID,
  }

  const group = new GroupHandle({
    state,
    credential,
    ciphersuite: impl,
    rootCapability: rootCapStr,
  })

  return { group, credential }
}

export type CreateInviteParams = {
  group: GroupHandle
  identity: SigningIdentity
  recipientDID: string
  permission: GroupPermission
}

export type CreateInviteResult = {
  invite: Invite
}

/**
 * Create an invite for a new member.
 * Does NOT add them to the group — call commitInvite with their key package to do that.
 */
export async function createInvite(params: CreateInviteParams): Promise<CreateInviteResult> {
  const { group, identity, recipientDID, permission } = params
  const memberCap = await delegateGroupMembership({
    identity,
    groupID: group.groupID,
    recipientDID,
    permission,
    parentCapability: group.rootCapability,
  })
  const memberCapStr = stringifyToken(memberCap)

  const invite: Invite = {
    groupID: group.groupID,
    capabilityToken: memberCapStr,
    capabilityChain: [group.rootCapability, memberCapStr],
    permission,
    inviterDID: identity.id,
  }

  return { invite }
}

export type CommitInviteResult = {
  commitMessage: unknown
  welcomeMessage: unknown
  newGroup: GroupHandle
}

/**
 * Commit an invite by adding the invitee's key package to the group.
 * Produces an MLS Commit + Welcome.
 */
export async function commitInvite(
  group: GroupHandle,
  keyPackage: KeyPackage,
): Promise<CommitInviteResult> {
  const addProposal: Proposal = {
    proposalType: 'add',
    add: { keyPackage },
  }

  const result = await createCommit(
    { state: group.state, cipherSuite: group.ciphersuite },
    { extraProposals: [addProposal] },
  )

  const newGroup = new GroupHandle({
    state: result.newState,
    credential: group.credential,
    ciphersuite: group.ciphersuite,
    rootCapability: group.rootCapability,
  })

  return {
    commitMessage: result.commit,
    welcomeMessage: result.welcome,
    newGroup,
  }
}

export type ProcessWelcomeResult = {
  group: GroupHandle
  credential: MemberCredential
}

export type ProcessWelcomeParams = {
  identity: OwnIdentity
  invite: Invite
  welcome: unknown
  keyPackageBundle: KeyPackageBundle
  ratchetTree: unknown
  options?: GroupOptions
}

/**
 * Process a Welcome message to join a group.
 */
export async function processWelcome(params: ProcessWelcomeParams): Promise<ProcessWelcomeResult> {
  const { identity, invite, welcome, keyPackageBundle, ratchetTree, options } = params
  const impl = await resolveCiphersuite(options)

  // Validate the invite's capability chain before trusting it
  const { validateGroupCapability } = await import('./capability.js')
  await validateGroupCapability({
    tokenData: invite.capabilityToken,
    groupID: invite.groupID,
    delegationChain:
      invite.capabilityChain.length > 1 ? invite.capabilityChain.slice(0, -1) : undefined,
  })

  const capToken = await verifyToken(invite.capabilityToken)

  const state = await mlsJoinGroup(
    welcome as Parameters<typeof mlsJoinGroup>[0],
    keyPackageBundle.publicPackage as Parameters<typeof mlsJoinGroup>[1],
    keyPackageBundle.privatePackage as Parameters<typeof mlsJoinGroup>[2],
    emptyPskIndex,
    impl,
    ratchetTree as Parameters<typeof mlsJoinGroup>[5],
  )

  const credential: MemberCredential = {
    did: identity.id,
    capabilityChain: invite.capabilityChain,
    capability: capToken as MemberCredential['capability'],
    permission: invite.permission,
    groupID: invite.groupID,
  }

  const group = new GroupHandle({
    state,
    credential,
    ciphersuite: impl,
    rootCapability:
      invite.capabilityChain[0] ??
      (() => {
        throw new Error('Invalid invite: capability chain must not be empty')
      })(),
  })

  return { group, credential }
}

export type RemoveMemberResult = {
  commitMessage: unknown
  newGroup: GroupHandle
}

/**
 * Remove a member from the group. Advances the epoch and rotates keys.
 */
export async function removeMember(
  group: GroupHandle,
  leafIndex: number,
): Promise<RemoveMemberResult> {
  const removeProposal: Proposal = {
    proposalType: 'remove',
    remove: { removed: leafIndex },
  }

  const result = await createCommit(
    { state: group.state, cipherSuite: group.ciphersuite },
    { extraProposals: [removeProposal] },
  )

  const newGroup = new GroupHandle({
    state: result.newState,
    credential: group.credential,
    ciphersuite: group.ciphersuite,
    rootCapability: group.rootCapability,
  })

  return { commitMessage: result.commit, newGroup }
}

/**
 * Generate a key package for joining groups.
 */
export async function createKeyPackageBundle(
  identity: OwnIdentity,
  options?: GroupOptions,
): Promise<KeyPackageBundle> {
  const impl = await resolveCiphersuite(options)
  const keys = getSignatureKeys(identity)
  const mlsCredential = makeMLSCredential(identity.id)

  const result = await generateKeyPackageWithKey(
    mlsCredential,
    defaultCapabilities(),
    defaultLifetime,
    [],
    keys,
    impl,
  )

  return {
    publicPackage: result.publicPackage,
    privatePackage: result.privatePackage,
    ownerDID: identity.id,
  }
}
