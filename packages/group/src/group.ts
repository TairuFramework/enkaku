import {
  createInMemoryDIDCache,
  type DIDCache,
  type DIDResolver,
  isPeer4,
  normalizeDID,
  type OwnIdentity,
  type SigningIdentity,
  stringifyToken,
} from '@enkaku/token'
import {
  type Capabilities,
  type CiphersuiteName,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroupInfoWithExternalPubAndRatchetTree,
  type DefaultProposal,
  decode,
  defaultCapabilities,
  defaultCredentialTypes,
  defaultProposalTypes,
  encode,
  type GroupContextExtension,
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
import {
  type GroupMember,
  type MemberCredential,
  type MLSCredentialIdentity,
  parseMLSCredentialIdentity,
} from './credential.js'
import { nobleCryptoProvider } from './crypto.js'
import type { GroupOptions, Invite, KeyPackageBundle } from './types.js'

const DEFAULT_CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const

async function resolveMlsContext(options?: GroupOptions): Promise<MlsContext> {
  const name = (options?.ciphersuiteName ?? DEFAULT_CIPHERSUITE) as CiphersuiteName
  const cipherSuite = await getCiphersuiteImpl(name, options?.cryptoProvider ?? nobleCryptoProvider)
  const authService = createDIDAuthenticationService()
  return { cipherSuite, authService }
}

export function makeMLSCredential(identity: OwnIdentity): Credential {
  const id = identity.id
  const isPeer = isPeer4(id)
  if (
    isPeer &&
    !('longForm' in identity && typeof (identity as { longForm?: unknown }).longForm === 'string')
  ) {
    throw new Error(
      'peer:4 identity is missing longForm; only identities from createIdentity can be used as MLS members',
    )
  }
  const payload: MLSCredentialIdentity = { id }
  if (isPeer) {
    payload.longForm = (identity as unknown as { longForm: string }).longForm
  }
  return {
    credentialType: defaultCredentialTypes.basic,
    identity: new TextEncoder().encode(JSON.stringify(payload)),
  }
}

export type GroupHandleParams = {
  state: ClientState
  credential: MemberCredential
  context: MlsContext
  /** Stringified root capability (for delegation) */
  rootCapability: string
  cache: DIDCache
  resolver?: DIDResolver
}

/**
 * Mutable wrapper around MLS group state + Enkaku credential.
 */
export class GroupHandle {
  #state: ClientState
  #credential: MemberCredential
  #context: MlsContext
  #rootCapability: string
  #cache: DIDCache
  #resolver?: DIDResolver

  constructor(params: GroupHandleParams) {
    this.#state = params.state
    this.#credential = params.credential
    this.#context = params.context
    this.#rootCapability = params.rootCapability
    this.#cache = params.cache
    this.#resolver = params.resolver
  }

  get groupID(): string {
    return this.#credential.groupID
  }

  get epoch(): bigint {
    return this.#state.groupContext.epoch
  }

  get treeHash(): Uint8Array {
    return this.#state.groupContext.treeHash
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

  get cache(): DIDCache {
    return this.#cache
  }

  get resolver(): DIDResolver | undefined {
    return this.#resolver
  }

  get memberCount(): number {
    return this.#state.ratchetTree.filter(
      (node) => node != null && node.nodeType === nodeTypes.leaf,
    ).length
  }

  *#iterateMembers(): Generator<GroupMember> {
    const tree = this.#state.ratchetTree
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i]
      if (node != null && node.nodeType === nodeTypes.leaf) {
        const credential = node.leaf.credential
        if ('identity' in credential) {
          let parsed: ReturnType<typeof parseMLSCredentialIdentity>
          try {
            parsed = parseMLSCredentialIdentity(credential.identity)
          } catch {
            continue
          }
          yield { leafIndex: i / 2, id: parsed.id }
        }
      }
    }
  }

  findMemberLeafIndex(id: string): number | undefined {
    const targetNorm = normalizeDID(id)
    for (const member of this.#iterateMembers()) {
      if (normalizeDID(member.id) === targetNorm) return member.leafIndex
    }
    return undefined
  }

  /**
   * Enumerate the group's current members from the ratchet tree, in ascending
   * leaf-index order. Leaves whose credential identity fails to parse are skipped
   * (same tolerance as findMemberLeafIndex). Reflects the handle's current #state
   * — call before and after processMessage to diff a commit's membership change.
   */
  listMembers(): Array<GroupMember> {
    return [...this.#iterateMembers()]
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
   *
   * Accepts either wire-form bytes (framed MLSMessage `Uint8Array`) or a
   * pre-decoded ts-mls message object. The param type widens to `unknown`
   * because `Uint8Array | unknown` collapses to `unknown` in TypeScript; the
   * runtime `instanceof` check selects the decode path. Note: `encrypt`
   * currently emits objects, so the bytes path is for symmetry with
   * processMessage and future wire-form application messages.
   */
  async decrypt(message: Uint8Array | unknown): Promise<Uint8Array> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('decrypt: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
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
   *
   * Accepts either wire-form bytes (the preferred input — framed MLSMessage
   * `Uint8Array`, e.g. from commitInvite/removeMember) or a pre-decoded ts-mls
   * message object (legacy path). The param type widens to `unknown` because
   * `Uint8Array | unknown` collapses to `unknown` in TypeScript; the runtime
   * `instanceof` check selects the decode path.
   */
  async processMessage(message: Uint8Array | unknown): Promise<Uint8Array | null> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('processMessage: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
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

/**
 * Build the leaf-node capabilities for a group creator. RFC 9420 requires a
 * member's leaf to advertise every non-default GroupContext extension type the
 * group uses; we derive that set from the group's extensions so it cannot
 * desync. An explicit `override` (GroupOptions.capabilities) wins verbatim.
 */
function buildCreatorCapabilities(
  extensions: ReadonlyArray<GroupContextExtension>,
  override?: Capabilities,
): Capabilities {
  if (override != null) return override
  const base = defaultCapabilities()
  const types = new Set<number>([...base.extensions, ...extensions.map((e) => e.extensionType)])
  return { ...base, extensions: [...types] }
}

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
  const cache = options?.cache ?? createInMemoryDIDCache()
  const context = await resolveMlsContext(options)

  const extensions = options?.extensions ?? []
  const statePromise = generateKeyPackageWithKey({
    credential: makeMLSCredential(identity),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite: context.cipherSuite,
    capabilities: buildCreatorCapabilities(extensions, options?.capabilities),
  }).then((keyPackage) => {
    return mlsCreateGroup({
      context,
      groupId: new TextEncoder().encode(groupID),
      keyPackage: keyPackage.publicPackage,
      privateKeyPackage: keyPackage.privatePackage,
      extensions,
    })
  })
  const [state, rootCap] = await Promise.all([
    statePromise,
    createGroupCapability(identity, groupID),
  ])

  const rootCapability = stringifyToken(rootCap)
  const credential: MemberCredential = {
    id: identity.id,
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
    cache,
    resolver: options?.resolver,
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
  const cache = params.options?.cache ?? createInMemoryDIDCache()
  return new GroupHandle({
    state: params.state,
    credential: params.credential,
    context: await resolveMlsContext(params.options),
    rootCapability: params.rootCapability,
    cache,
    resolver: params.options?.resolver,
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
    inviterID: identity.id,
  }

  return { invite }
}

export type CommitInviteResult = {
  /** Framed MLSMessage bytes. Broadcast to existing members via the DS. */
  commitMessage: Uint8Array
  /** Framed MLSMessage(Welcome) bytes. Delivered to the new member. */
  welcomeMessage: Uint8Array
  newGroup: GroupHandle
  /** Post-commit epoch the group is now at (== newGroup.epoch). NOTE: this is
   *  NOT the epoch carried in the commit's wire header — a commit is framed at
   *  the sender's pre-commit epoch (== epoch - 1n), which is what receivers
   *  compare against their own handle.epoch for ordering (see readMessageEpoch). */
  epoch: bigint
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
    cache: group.cache,
    resolver: group.resolver,
  })

  if (result.welcome == null) {
    throw new Error('commitInvite: expected a Welcome message for the add proposal')
  }
  return {
    commitMessage: encode(mlsMessageEncoder, result.commit),
    welcomeMessage: encode(mlsMessageEncoder, result.welcome),
    newGroup,
    epoch: newGroup.epoch,
  }
}

export type ProcessWelcomeResult = {
  group: GroupHandle
  credential: MemberCredential
}

export type ProcessWelcomeParams = {
  identity: OwnIdentity
  invite: Invite
  /** Wire-form framed MLSMessage(Welcome) bytes (preferred), or a pre-decoded
   *  ts-mls Welcome object (legacy). `Uint8Array | unknown` collapses to
   *  `unknown` in TypeScript; the runtime `instanceof` check selects the path. */
  welcome: Uint8Array | unknown
  keyPackageBundle: KeyPackageBundle
  ratchetTree?: unknown
  options?: GroupOptions
}

/**
 * Process a Welcome message to join a group.
 */
export async function processWelcome(params: ProcessWelcomeParams): Promise<ProcessWelcomeResult> {
  const { identity, invite, welcome, keyPackageBundle, ratchetTree, options } = params
  const cache = options?.cache ?? createInMemoryDIDCache()
  const context = await resolveMlsContext(options)

  // Validate the invite's capability chain before trusting it.
  // validateGroupCapability internally calls verifyToken with cache/resolver and returns the
  // verified token — reuse it instead of calling verifyToken a second time without cache/resolver.
  const { validateGroupCapability } = await import('./capability.js')
  const capToken = await validateGroupCapability({
    tokenData: invite.capabilityToken,
    groupID: invite.groupID,
    delegationChain:
      invite.capabilityChain.length > 1 ? invite.capabilityChain.slice(0, -1) : undefined,
    options: { cache, resolver: options?.resolver },
  })

  let resolvedWelcome: unknown = welcome
  if (welcome instanceof Uint8Array) {
    const decoded = decode(mlsMessageDecoder, welcome)
    if (decoded == null || decoded.wireformat !== wireformats.mls_welcome) {
      throw new Error('processWelcome: expected a framed MLSMessage(Welcome)')
    }
    resolvedWelcome = decoded.welcome
  }

  type JoinGroupParams = Parameters<typeof mlsJoinGroup>[0]
  const sanitizedTree = Array.isArray(ratchetTree) ? sanitizeRatchetTree(ratchetTree) : ratchetTree
  const state = await mlsJoinGroup({
    context,
    welcome: resolvedWelcome as JoinGroupParams['welcome'],
    keyPackage: keyPackageBundle.publicPackage as JoinGroupParams['keyPackage'],
    privateKeys: keyPackageBundle.privatePackage as JoinGroupParams['privateKeys'],
    ...(sanitizedTree != null && {
      ratchetTree: sanitizedTree as JoinGroupParams['ratchetTree'],
    }),
  })

  const credential: MemberCredential = {
    id: identity.id,
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
    cache,
    resolver: options?.resolver,
  })

  return { group, credential }
}

export type RemoveMemberResult = {
  /** Framed MLSMessage bytes. Broadcast to existing members via the DS. */
  commitMessage: Uint8Array
  newGroup: GroupHandle
  /** Post-commit epoch the group is now at (== newGroup.epoch). NOTE: this is
   *  NOT the epoch carried in the commit's wire header — a commit is framed at
   *  the sender's pre-commit epoch (== epoch - 1n), which is what receivers
   *  compare against their own handle.epoch for ordering (see readMessageEpoch). */
  epoch: bigint
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
    cache: group.cache,
    resolver: group.resolver,
  })

  return {
    commitMessage: encode(mlsMessageEncoder, result.commit),
    newGroup,
    epoch: newGroup.epoch,
  }
}

/**
 * Read the MLS epoch from a framed handshake/application message's cleartext
 * header, without decrypting. Advisory only — the header epoch is unauthenticated;
 * use it to drop stale / buffer future messages before the authenticated
 * processMessage. Returns undefined for non-message or undecodable bytes.
 *
 * Total by contract: this is a safe pre-filter over bytes arriving from an
 * untrusted Delivery Service, so it never throws. ts-mls `decode` throws (e.g.
 * CodecError on input larger than its max size) rather than returning undefined
 * for some malformed inputs; that is caught and treated as "not a message".
 */
export function readMessageEpoch(bytes: Uint8Array): bigint | undefined {
  const message = (() => {
    try {
      return decode(mlsMessageDecoder, bytes)
    } catch {
      return undefined
    }
  })()
  if (message == null) return undefined
  if (message.wireformat === wireformats.mls_private_message) {
    return message.privateMessage.epoch
  }
  if (message.wireformat === wireformats.mls_public_message) {
    return message.publicMessage.content.epoch
  }
  return undefined
}

export type InspectGroupInfoResult = {
  /** The GroupInfo's epoch, read from its groupContext. */
  epoch: bigint
  /** The GroupInfo's ratchet-tree hash, read from its groupContext. Compare for
   *  equality against a known post-commit state's treeHash to confirm canonical
   *  convergence (same epoch + same treeHash ⟺ same group state). */
  treeHash: Uint8Array
}

/**
 * Non-destructively inspect a framed MLSMessage(GroupInfo) — read its epoch and
 * ratchet-tree hash without joining or mutating any state. Used to confirm an
 * external-resync Commit was canonically accepted: compare the returned
 * (epoch, treeHash) for equality against the rejoiner's own post-commit state
 * (GroupHandle.epoch / GroupHandle.treeHash). Equal ⟹ this device's Commit won
 * the epoch; unequal ⟹ another Commit won and the rejoin must retry.
 *
 * Structural read only: it does NOT verify the GroupInfo signature. The caller
 * is expected to have obtained the bytes over the group's authorized channel.
 * Unlike readMessageEpoch (a total pre-filter over untrusted DS bytes), this
 * THROWS on malformed input — a malformed already-trusted GroupInfo is a
 * programming error, not expected traffic.
 */
export function inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult {
  const message = decode(mlsMessageDecoder, groupInfoBytes)
  if (message == null) {
    throw new Error('Invalid groupInfo: failed to decode MLSMessage')
  }
  if (message.wireformat !== wireformats.mls_group_info) {
    throw new Error(
      `Invalid groupInfo: expected wireformat mls_group_info, got ${String(message.wireformat)}`,
    )
  }
  const { groupContext } = message.groupInfo
  return { epoch: groupContext.epoch, treeHash: groupContext.treeHash }
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
    credential: makeMLSCredential(identity),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite,
    capabilities: options?.capabilities ?? defaultCapabilities(),
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

  // Guard: resync requires the rejoining identity to match the leaf being
  // replaced. If `identity.id` does not match `credential.id`, ts-mls's
  // findIndex returns -1 and the downstream `removeLeafNodeMutable(tree, -1)`
  // call enters an unbounded loop (ts-mls bug; the no-match branch is not
  // guarded). Reject early with a clear error.
  if (normalizeDID(identity.id) !== normalizeDID(credential.id)) {
    throw new Error(
      `joinGroupExternal: identity.id (${identity.id}) must match credential.id (${credential.id}) for resync`,
    )
  }

  const cache = options?.cache ?? createInMemoryDIDCache()
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
  // Discriminated-union narrow via the literal wireformat tag — no cast needed.
  const { groupInfo } = message

  const keyPackage = await generateKeyPackageWithKey({
    credential: makeMLSCredential(identity),
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
    cache,
    resolver: options?.resolver,
  })

  return { commitMessage, group }
}
