import type { CapabilityToken } from '@enkaku/capability'
import type { SignedToken } from '@enkaku/token'

import type { GroupPermission } from './capability.js'

/**
 * MLS credential wrapping an Enkaku identity with capability chain.
 * Used as the MLS credential in key packages and leaf nodes.
 */
export type MemberCredential = {
  /** Member's DID (did:key:z...) */
  did: string
  /** Capability delegation chain proving membership */
  capabilityChain: Array<string>
  /** The leaf capability token (parsed for convenience) */
  capability: CapabilityToken
  /** Permission level */
  permission: GroupPermission
  /** Group ID this credential is for */
  groupID: string
}

/**
 * Serialized credential format for embedding in MLS key packages.
 * Uses the MLS basic credential type with a JSON-encoded identity.
 */
export type SerializedCredential = {
  did: string
  groupID: string
  capabilityChain: Array<string>
}

/**
 * Creates an MLS-compatible credential (basic type) from a member credential.
 * The identity field contains the serialized credential as UTF-8 JSON.
 */
export function credentialToMLSIdentity(credential: MemberCredential): Uint8Array {
  const serialized: SerializedCredential = {
    did: credential.did,
    groupID: credential.groupID,
    capabilityChain: credential.capabilityChain,
  }
  return new TextEncoder().encode(JSON.stringify(serialized))
}

/**
 * Extracts a serialized credential from an MLS basic credential identity field.
 */
export function mlsIdentityToSerializedCredential(identity: Uint8Array): SerializedCredential {
  const json = new TextDecoder().decode(identity)
  return JSON.parse(json) as SerializedCredential
}

/**
 * Extracts the permission level from a capability token's actions.
 */
export function extractPermission(token: SignedToken): GroupPermission {
  const payload = token.payload as Record<string, unknown>
  const actions = Array.isArray(payload.act) ? payload.act : [payload.act]

  // Wildcard grants admin
  if (actions.includes('*')) return 'admin'
  if (actions.includes('admin')) return 'admin'
  if (actions.includes('member')) return 'member'
  if (actions.includes('read')) return 'read'

  throw new Error('Invalid capability: no recognized permission level')
}
