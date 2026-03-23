import { getSignatureInfo } from '@enkaku/token'
import type { AuthenticationService, Credential } from 'ts-mls'
import { defaultCredentialTypes } from 'ts-mls'

import { mlsIdentityToSerializedCredential } from './credential.js'

/**
 * Extracts the DID from an MLS basic credential's identity bytes.
 *
 * Handles two formats:
 * 1. JSON-encoded SerializedCredential (from credentialToMLSIdentity) — extracts .did
 * 2. Plain DID string (from makeMLSCredential) — uses directly
 */
function extractDIDFromIdentity(identity: Uint8Array): string | null {
  const text = new TextDecoder().decode(identity)

  // Try JSON format first (SerializedCredential)
  if (text.startsWith('{')) {
    try {
      const serialized = mlsIdentityToSerializedCredential(identity)
      return serialized.did
    } catch {
      return null
    }
  }

  // Plain DID string
  if (text.startsWith('did:key:z')) {
    return text
  }

  return null
}

/**
 * Constant-time comparison of two Uint8Array values.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is within bounds
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/**
 * Creates a DID-based AuthenticationService for MLS.
 *
 * Validates that the public key embedded in a credential's DID (did:key:z...)
 * matches the signature public key presented by the MLS leaf node.
 *
 * This provides cryptographic binding between MLS identities and Enkaku DIDs.
 */
export function createDIDAuthenticationService(): AuthenticationService {
  return {
    async validateCredential(
      credential: Credential,
      signaturePublicKey: Uint8Array,
    ): Promise<boolean> {
      // Only support basic credentials
      if (credential.credentialType !== defaultCredentialTypes.basic) {
        return false
      }

      // Extract the DID from identity bytes
      // Cast needed: CredentialCustom's credentialType is `number`, preventing full narrowing
      const did = extractDIDFromIdentity((credential as { identity: Uint8Array }).identity)
      if (did == null) {
        return false
      }

      // Derive the expected public key from the DID
      try {
        const [, publicKeyFromDID] = getSignatureInfo(did)
        return constantTimeEqual(publicKeyFromDID, signaturePublicKey)
      } catch {
        return false
      }
    },
  }
}
