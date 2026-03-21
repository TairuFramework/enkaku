import {
  assertCapabilityToken,
  type CapabilityPayload,
  type CapabilityToken,
  checkDelegationChain,
  createCapability,
  type DelegationChainOptions,
} from '@enkaku/capability'
import { type SigningIdentity, verifyToken } from '@enkaku/token'

export type GroupPermission = 'admin' | 'member' | 'read'

export type GroupCapabilityPayload = CapabilityPayload & {
  act: Array<GroupPermission>
  res: Array<string>
}

/**
 * Creates a root admin capability for a group.
 * The signer becomes the group creator and root admin (iss === sub).
 */
export async function createGroupCapability(
  identity: SigningIdentity,
  groupID: string,
): Promise<CapabilityToken> {
  return await createCapability(identity, {
    sub: identity.id,
    aud: identity.id,
    act: '*',
    res: [`group/${groupID}/*`],
  })
}

export type DelegateGroupMembershipParams = {
  identity: SigningIdentity
  groupID: string
  recipientDID: string
  permission: GroupPermission
  expiration?: number
  parentCapability?: string
}

/**
 * Creates a delegated membership capability for a group.
 * The signer must be an admin with a valid capability chain.
 */
export async function delegateGroupMembership(
  params: DelegateGroupMembershipParams,
): Promise<CapabilityToken> {
  const { identity, groupID, recipientDID, permission, expiration, parentCapability } = params
  // In Enkaku's capability model, `sub` is the resource owner (stays the same
  // through the chain) and `aud` is who can exercise the capability (the recipient).
  const payload: Record<string, unknown> = {
    sub: identity.id,
    aud: recipientDID,
    act: [permission],
    res: [`group/${groupID}/*`],
  }
  if (expiration != null) {
    payload.exp = expiration
  }

  return await createCapability(
    identity,
    payload as CapabilityPayload,
    undefined,
    parentCapability != null ? { parentCapability } : undefined,
  )
}

export type ValidateGroupCapabilityParams = {
  tokenData: string
  groupID: string
  delegationChain?: Array<string>
  options?: DelegationChainOptions
}

/**
 * Validates that a capability token grants the specified permission for a group.
 */
export async function validateGroupCapability(
  params: ValidateGroupCapabilityParams,
): Promise<CapabilityToken> {
  const { tokenData, groupID, delegationChain, options } = params
  const token = await verifyToken<CapabilityPayload>(tokenData)
  assertCapabilityToken(token)

  // Verify the resource matches the group
  const expectedResource = `group/${groupID}/`
  const resources = Array.isArray(token.payload.res) ? token.payload.res : [token.payload.res]

  const matchesGroup = resources.some(
    (res) => res === `group/${groupID}/*` || res.startsWith(expectedResource) || res === '*',
  )
  if (!matchesGroup) {
    throw new Error(`Invalid capability: does not grant access to group ${groupID}`)
  }

  // Verify delegation chain if provided
  if (delegationChain != null && delegationChain.length > 0) {
    await checkDelegationChain(token.payload, delegationChain, options)
  } else if (token.payload.iss !== token.payload.sub) {
    throw new Error('Invalid capability: delegation chain required for delegated capabilities')
  }

  return token
}
