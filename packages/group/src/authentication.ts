import {
  decodeMultibase,
  decodePeer4,
  getAlgorithmAndPublicKey,
  getSignatureInfo,
  isPeer4,
} from '@enkaku/token'
import type { AuthenticationService, Credential } from 'ts-mls'
import { defaultCredentialTypes } from 'ts-mls'

import { parseMLSCredentialIdentity } from './credential.js'

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is within bounds
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

export function createDIDAuthenticationService(): AuthenticationService {
  return {
    async validateCredential(
      credential: Credential,
      signaturePublicKey: Uint8Array,
    ): Promise<boolean> {
      if (credential.credentialType !== defaultCredentialTypes.basic) {
        return false
      }

      let parsed: ReturnType<typeof parseMLSCredentialIdentity>
      try {
        parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
      } catch {
        return false
      }

      if (isPeer4(parsed.id)) {
        if (parsed.longForm == null) return false
        let decoded: ReturnType<typeof decodePeer4>
        try {
          decoded = decodePeer4(parsed.longForm)
        } catch {
          return false
        }
        if (decoded.shortForm !== parsed.id) return false
        // Only verification methods referenced by `authentication` are
        // permitted to sign for authentication — per DID Core. Reject MLS
        // leaves bound to keys outside that set (KEM keys, assertion-only
        // keys, etc.) even if the byte comparison would otherwise match.
        const authIDs = new Set(decoded.doc.authentication ?? [])
        if (authIDs.size === 0) return false
        for (const vm of decoded.doc.verificationMethod ?? []) {
          if (!authIDs.has(vm.id)) continue
          if (typeof vm.publicKeyMultibase !== 'string') continue
          let vmBytes: Uint8Array
          try {
            vmBytes = decodeMultibase(vm.publicKeyMultibase)
          } catch {
            continue
          }
          // Validate multicodec prefix and strip it; rejects unknown codecs
          // (e.g. X25519 KEM keys, future PQ codecs) instead of blindly
          // comparing 2-byte-truncated bytes.
          const stripped = getAlgorithmAndPublicKey(vmBytes)
          if (stripped == null) continue
          const [, publicKeyBytes] = stripped
          if (constantTimeEqual(publicKeyBytes, signaturePublicKey)) return true
        }
        return false
      }

      try {
        const [, publicKeyFromDID] = getSignatureInfo(parsed.id)
        return constantTimeEqual(publicKeyFromDID, signaturePublicKey)
      } catch {
        return false
      }
    },
  }
}
