import type { CapabilityToken } from '@enkaku/capability'
import { type DIDCache, decodePeer4, isPeer4, type SignedToken } from '@enkaku/token'

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
  /** did:peer:4 long form (with embedded doc). Present only when did is a did:peer:4 short form. */
  longForm?: string
}

/**
 * Creates an MLS-compatible credential (basic type) from a member credential.
 * The identity field contains the serialized credential as UTF-8 JSON.
 */
export function credentialToMLSIdentity(
  credential: MemberCredential,
  options: { longForm?: string } = {},
): Uint8Array {
  const serialized: SerializedCredential = {
    did: credential.did,
    groupID: credential.groupID,
    capabilityChain: credential.capabilityChain,
  }
  if (options.longForm != null && isPeer4(credential.did)) {
    serialized.longForm = options.longForm
  }
  return new TextEncoder().encode(JSON.stringify(serialized))
}

/**
 * Extracts a serialized credential from an MLS basic credential identity field.
 */
export function mlsIdentityToSerializedCredential(identity: Uint8Array): SerializedCredential {
  const json = new TextDecoder().decode(identity)
  const parsed: unknown = JSON.parse(json)
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).did !== 'string' ||
    typeof (parsed as Record<string, unknown>).groupID !== 'string' ||
    !Array.isArray((parsed as Record<string, unknown>).capabilityChain)
  ) {
    throw new Error('Invalid MLS credential: malformed serialized credential')
  }
  const candidate = parsed as Record<string, unknown>
  if ('longForm' in candidate && typeof candidate.longForm !== 'string') {
    throw new Error('Invalid MLS credential: longForm must be a string when present')
  }
  return parsed as SerializedCredential
}

/**
 * If the serialized credential carries a did:peer:4 long form, decode it and write to the cache.
 * Hash binding enforced by decodePeer4 + cache.set.
 */
export async function populateCacheFromCredential(
  serialized: SerializedCredential,
  cache: DIDCache,
): Promise<void> {
  if (serialized.longForm == null) return
  if (!isPeer4(serialized.did)) return
  const { shortForm, doc } = decodePeer4(serialized.longForm)
  if (shortForm !== serialized.did) {
    throw new Error('Credential longForm does not match credential.did')
  }
  await cache.set(shortForm, doc)
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
