import type { SigningIdentity } from '@enkaku/token'

import type { CapabilityToken, VerifyTokenHook } from './index.js'

export type RevocationRecord = {
  jti: string
  iss: string
  rev: true
  iat: number
}

export type RevocationBackend = {
  add(record: RevocationRecord): Promise<void>
  isRevoked(jti: string): Promise<boolean>
}

export function createMemoryRevocationBackend(): RevocationBackend {
  const revoked = new Set<string>()
  return {
    async add(record: RevocationRecord): Promise<void> {
      revoked.add(record.jti)
    },
    async isRevoked(jti: string): Promise<boolean> {
      return revoked.has(jti)
    },
  }
}

export function createRevocationChecker(backend: RevocationBackend): VerifyTokenHook {
  return async (token: CapabilityToken, _raw: string): Promise<void> => {
    const jti = token.payload.jti
    if (jti != null && (await backend.isRevoked(jti))) {
      throw new Error(`Token revoked: ${jti}`)
    }
  }
}

export async function createRevocationRecord(
  signer: SigningIdentity,
  jti: string,
): Promise<RevocationRecord> {
  return {
    jti,
    iss: signer.id,
    rev: true,
    iat: Math.floor(Date.now() / 1000),
  }
}
