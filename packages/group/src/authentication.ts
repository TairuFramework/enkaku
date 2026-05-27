import { decodeMultibase, decodePeer4, getSignatureInfo, isPeer4 } from '@enkaku/token'
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

/**
 * Strip the multicodec prefix (2 bytes for ed25519: 0xed 0x01) from a
 * multibase-decoded public key to get raw key bytes.
 */
function stripCodecPrefix(bytes: Uint8Array): Uint8Array {
  return bytes.subarray(2)
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
        for (const vm of decoded.doc.verificationMethod ?? []) {
          if (typeof vm.publicKeyMultibase !== 'string') continue
          let vmBytes: Uint8Array
          try {
            vmBytes = stripCodecPrefix(decodeMultibase(vm.publicKeyMultibase))
          } catch {
            continue
          }
          if (constantTimeEqual(vmBytes, signaturePublicKey)) return true
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
