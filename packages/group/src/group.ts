import type { OwnIdentity, SigningIdentity } from '@enkaku/token'
import { stringifyToken, verifyToken } from '@enkaku/token'
import {
  type CiphersuiteName,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroupInfoWithExternalPubAndRatchetTree,
  type DefaultProposal,
  decode,
  defaultCredentialTypes,
  defaultProposalTypes,
  encode,
  generateKeyPackageWithKey,
  getCiphersuiteImpl,
  type KeyPackage,
  type MlsContext,
  type MlsGroupInfo,
  type MlsPublicMessage,
  createGroup as mlsCreateGroup,
  joinGroup as mlsJoinGroup,
  joinGroupExternal as mlsJoinGroupExternal,
  mlsMessageDecoder,
  mlsMessageEncoder,
  processMessage as mlsProcessMessage,
  nodeTypes,
  protocolVersions,
  wireformats,
} from 'ts-mls'

import { createDIDAuthenticationService } from './authentication.js'
import {
  createGroupCapability,
  delegateGroupMembership,
  type GroupPermission,
} from './capability.js'
import { sanitizeRatchetTree } from './codec.js'
import type { MemberCredential } from './credential.js'
import { nobleCryptoProvider } from './crypto.js'
import type { GroupOptions, Invite, KeyPackageBundle } from './types.js'

const DEFAULT_CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

async function resolveMlsContext(options?: GroupOptions): Promise<MlsContext> {
  const name = (options?.ciphersuiteName ?? DEFAULT_CIPHERSUITE) as CiphersuiteName
  const cipherSuite = await getCiphersuiteImpl(name, options?.cryptoProvider ?? nobleCryptoProvider)
  const authService = createDIDAuthenticationService()
  return { cipherSuite, authService }
}

function makeMLSCredential(did: string): Credential {
  return {
    credentialType: defaultCredentialTypes.basic,
    identity: new TextEncoder().encode(did),
  }
}

export type GroupHandleParams = {
  state: ClientState
  credential: MemberCredential
  context: MlsContext
  /** Stringified root capability (for delegation) */
  rootCapability: string
}

/**
 * Mutable wrapper around MLS group state + Enkaku credential.
 */
export class GroupHandle {
  #state: ClientState
  #credential: MemberCredential
  #context: MlsContext
  #rootCapability: string

  constructor(params: GroupHandleParams) {
    this.#state = params.state
    this.#credential = params.credential
    this.#context = params.context
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

  get context(): MlsContext {
    return this.#context
  }

  get memberCount(): number {
    return this.#state.ratchetTree.filter(
      (node) => node != null && node.nodeType === nodeTypes.leaf,
    ).length
  }

  findMemberLeafIndex(did: string): number | undefined {
    const tree = this.#state.ratchetTree
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i]
      if (node != null && node.nodeType === nodeTypes.leaf) {
        const credential = node.leaf.credential
        if ('identity' in credential) {
          const identity = new TextDecoder().decode(credential.identity)
          if (identity === did) return i / 2
        }
      }
    }
    return undefined
  }

  /**
   * Encrypt an application message for the group.
   */
  async encrypt(plaintext: Uint8Array): Promise<{ message: unknown; consumed: Array<Uint8Array> }> {
    const { newState, message, consumed } = await createApplicationMessage({
      context: this.#context,
      state: this.#state,
      message: plaintext,
    })
    this.#state = newState
    return { message, consumed }
  }

  /**
   * Decrypt an application message from the group.
   */
  async decrypt(privateMessage: unknown): Promise<Uint8Array> {
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: privateMessage as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
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
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: privateMessage as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
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
  const context = await resolveMlsContext(options)

  const statePromise = generateKeyPackageWithKey({
    credential: makeMLSCredential(identity.id),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite: context.cipherSuite,
  }).then((keyPackage) => {
    return mlsCreateGroup({
      context,
      groupId: new TextEncoder().encode(groupID),
      keyPackage: keyPackage.publicPackage,
      privateKeyPackage: keyPackage.privatePackage,
      extensions: options?.extensions ?? [],
    })
  })
  const [state, rootCap] = await Promise.all([
    statePromise,
    createGroupCapability(identity, groupID),
  ])

  const rootCapability = stringifyToken(rootCap)
  const credential: MemberCredential = {
    did: identity.id,
    capabilityChain: [rootCapability],
    capability: rootCap,
    permission: 'admin',
    groupID,
  }
  const group = new GroupHandle({
    state,
    credential,
    context,
    rootCapability,
  })

  return { group, credential }
}

export type RestoreGroupParams = {
  state: ClientState
  credential: MemberCredential
  rootCapability: string
  options?: GroupOptions
}

export async function restoreGroup(params: RestoreGroupParams): Promise<GroupHandle> {
  return new GroupHandle({
    state: params.state,
    credential: params.credential,
    context: await resolveMlsContext(params.options),
    rootCapability: params.rootCapability,
  })
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
  const addProposal: DefaultProposal = {
    proposalType: defaultProposalTypes.add,
    add: { keyPackage },
  }

  const result = await createCommit({
    context: group.context,
    state: group.state,
    extraProposals: [addProposal],
    ratchetTreeExtension: true,
  })

  const newGroup = new GroupHandle({
    state: result.newState,
    credential: group.credential,
    context: group.context,
    rootCapability: group.rootCapability,
  })

  return {
    commitMessage: result.commit,
    welcomeMessage: result.welcome?.welcome,
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
  ratchetTree?: unknown
  options?: GroupOptions
}

/**
 * Process a Welcome message to join a group.
 */
export async function processWelcome(params: ProcessWelcomeParams): Promise<ProcessWelcomeResult> {
  const { identity, invite, welcome, keyPackageBundle, ratchetTree, options } = params
  const context = await resolveMlsContext(options)

  // Validate the invite's capability chain before trusting it
  const { validateGroupCapability } = await import('./capability.js')
  await validateGroupCapability({
    tokenData: invite.capabilityToken,
    groupID: invite.groupID,
    delegationChain:
      invite.capabilityChain.length > 1 ? invite.capabilityChain.slice(0, -1) : undefined,
  })

  const capToken = await verifyToken(invite.capabilityToken)

  type JoinGroupParams = Parameters<typeof mlsJoinGroup>[0]
  const sanitizedTree = Array.isArray(ratchetTree) ? sanitizeRatchetTree(ratchetTree) : ratchetTree
  const state = await mlsJoinGroup({
    context,
    welcome: welcome as JoinGroupParams['welcome'],
    keyPackage: keyPackageBundle.publicPackage as JoinGroupParams['keyPackage'],
    privateKeys: keyPackageBundle.privatePackage as JoinGroupParams['privateKeys'],
    ...(sanitizedTree != null && {
      ratchetTree: sanitizedTree as JoinGroupParams['ratchetTree'],
    }),
  })

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
    context,
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
  const removeProposal: DefaultProposal = {
    proposalType: defaultProposalTypes.remove,
    remove: { removed: leafIndex },
  }

  const result = await createCommit({
    context: group.context,
    state: group.state,
    extraProposals: [removeProposal],
  })

  const newGroup = new GroupHandle({
    state: result.newState,
    credential: group.credential,
    context: group.context,
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
  const { cipherSuite } = await resolveMlsContext(options)
  const result = await generateKeyPackageWithKey({
    credential: makeMLSCredential(identity.id),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite,
  })
  return { ...result, ownerDID: identity.id }
}

// ---------------------------------------------------------------------------
// External rejoin (RFC 9420 §11.2.1 — stale device self-recovery)
// ---------------------------------------------------------------------------

export type ExportGroupInfoParams = {
  group: GroupHandle
}

export type ExportGroupInfoResult = {
  /** Framed MLSMessage(GroupInfo) bytes. Self-describing with protocol
   *  version + wireformat + GroupInfo (external_pub + ratchet tree embedded). */
  groupInfo: Uint8Array
}

export async function exportGroupInfo(
  params: ExportGroupInfoParams,
): Promise<ExportGroupInfoResult> {
  const groupInfo = await createGroupInfoWithExternalPubAndRatchetTree(
    params.group.state,
    [],
    params.group.context.cipherSuite,
  )
  const framed: MlsGroupInfo = {
    version: protocolVersions.mls10,
    wireformat: wireformats.mls_group_info,
    groupInfo,
  }
  return { groupInfo: encode(mlsMessageEncoder, framed) }
}

export type JoinGroupExternalParams = {
  identity: OwnIdentity
  /** Framed MLSMessage(GroupInfo) bytes from exportGroupInfo. */
  groupInfo: Uint8Array
  /** Caller's cached credential (from prior processWelcome). Reused as-is,
   *  not re-validated. */
  credential: MemberCredential
  /** Stale-recovery only: atomically removes prior leaf for same identity. */
  resync: true
  options?: GroupOptions
  authenticatedData?: Uint8Array
}

export type JoinGroupExternalResult = {
  /** Framed MLSMessage(PublicMessage) bytes. Broadcast to existing members. */
  commitMessage: Uint8Array
  /** New GroupHandle at post-commit epoch. */
  group: GroupHandle
}

export async function joinGroupExternal(
  params: JoinGroupExternalParams,
): Promise<JoinGroupExternalResult> {
  const {
    identity,
    groupInfo: groupInfoBytes,
    credential,
    resync,
    options,
    authenticatedData,
  } = params

  const rootCapability = credential.capabilityChain[0]
  if (rootCapability == null) {
    throw new Error('Invalid credential: capability chain must not be empty')
  }

  const context = await resolveMlsContext(options)

  const message = decode(mlsMessageDecoder, groupInfoBytes)
  if (message == null) {
    throw new Error('Invalid groupInfo: failed to decode MLSMessage')
  }
  if (message.wireformat !== wireformats.mls_group_info) {
    throw new Error(
      `Invalid groupInfo: expected wireformat mls_group_info, got ${String(message.wireformat)}`,
    )
  }
  const { groupInfo } = message as MlsGroupInfo

  const keyPackage = await generateKeyPackageWithKey({
    credential: makeMLSCredential(identity.id),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite: context.cipherSuite,
  })

  const { publicMessage, newState } = await mlsJoinGroupExternal({
    context,
    groupInfo,
    keyPackage: keyPackage.publicPackage,
    privateKeys: keyPackage.privatePackage,
    resync,
    ...(authenticatedData != null && { authenticatedData }),
  })

  const framedCommit: MlsPublicMessage = {
    version: protocolVersions.mls10,
    wireformat: wireformats.mls_public_message,
    publicMessage,
  }
  const commitMessage = encode(mlsMessageEncoder, framedCommit)

  const group = new GroupHandle({
    state: newState,
    credential,
    context,
    rootCapability,
  })

  return { commitMessage, group }
}
