import type { CapabilityToken } from '@enkaku/capability'
import { type DIDCache, decodePeer4, isPeer4, type SignedToken } from '@enkaku/token'

import type { GroupPermission } from './capability.js'

/**
 * Local member state (never serialized to the MLS leaf). Tracks the capability
 * chain proving group membership.
 */
export type MemberCredential = {
  id: string
  capabilityChain: Array<string>
  capability: CapabilityToken
  permission: GroupPermission
  groupID: string
}

/**
 * Wire shape for the MLS basic credential `identity` field. Identity binding
 * only — group membership state lives elsewhere.
 *
 * - did:key identities omit `longForm`.
 * - did:peer:4 identities MUST carry `longForm`; the auth service decodes it
 *   inline and binds the MLS leaf signature key to a verification method.
 */
export type MLSCredentialIdentity = {
  id: string
  longForm?: string
}

export type GroupMember = {
  /** MLS leaf index (ratchet-tree array position / 2, matching findMemberLeafIndex). */
  leafIndex: number
  /** DID parsed from the leaf's MLS credential identity. */
  id: string
}

export function parseMLSCredentialIdentity(identity: Uint8Array): MLSCredentialIdentity {
  const text = new TextDecoder().decode(identity)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid MLS credential: identity bytes are not valid JSON')
  }
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error('Invalid MLS credential: identity must be a JSON object')
  }
  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.id !== 'string') {
    throw new Error('Invalid MLS credential: id must be a string')
  }
  if ('longForm' in candidate && typeof candidate.longForm !== 'string') {
    throw new Error('Invalid MLS credential: longForm must be a string when present')
  }
  const result: MLSCredentialIdentity = { id: candidate.id }
  if (typeof candidate.longForm === 'string') {
    result.longForm = candidate.longForm
  }
  return result
}

/**
 * If the parsed credential carries a did:peer:4 long form, decode it and write
 * to the cache. Hash binding is enforced (decoded short form must equal `id`).
 * No-op for did:key.
 */
export async function populateCacheFromCredential(
  parsed: MLSCredentialIdentity,
  cache: DIDCache,
): Promise<void> {
  if (parsed.longForm == null) return
  if (!isPeer4(parsed.id)) return
  const { shortForm, doc } = decodePeer4(parsed.longForm)
  if (shortForm !== parsed.id) {
    throw new Error('Credential longForm does not match credential.id')
  }
  await cache.set(shortForm, doc)
}

/**
 * Extracts the permission level from a capability token's actions.
 */
export function extractPermission(token: SignedToken): GroupPermission {
  const payload = token.payload as Record<string, unknown>
  const actions = Array.isArray(payload.act) ? payload.act : [payload.act]

  if (actions.includes('*')) return 'admin'
  if (actions.includes('admin')) return 'admin'
  if (actions.includes('member')) return 'member'
  if (actions.includes('read')) return 'read'

  throw new Error('Invalid capability: no recognized permission level')
}
