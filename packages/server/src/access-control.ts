import {
  assertNonExpired,
  checkCapability,
  type DelegationChainOptions,
  hasPartsMatch,
} from '@enkaku/capability'
import type { SignedToken } from '@enkaku/token'

export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type AccessRule = {
  allow: true | Array<string>
  encryption?: EncryptionPolicy
}

export type AccessRules = Record<string, AccessRule>

export function resolveEncryptionPolicy(
  procedure: string,
  rules: AccessRules | undefined,
  globalPolicy: EncryptionPolicy,
): EncryptionPolicy {
  if (rules != null) {
    for (const [pattern, rule] of Object.entries(rules)) {
      if (hasPartsMatch(procedure, pattern)) {
        if (rule.encryption != null) {
          return rule.encryption
        }
      }
    }
  }
  return globalPolicy
}

export type ProcedureAccessPayload = {
  iss: string
  sub?: string
  aud?: string
  prc?: string
  exp?: number
}

export async function checkProcedureAccess(
  serverID: string,
  rules: AccessRules,
  token: SignedToken<ProcedureAccessPayload>,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  for (const [pattern, rule] of Object.entries(rules)) {
    if (!hasPartsMatch(payload.prc, pattern)) continue

    const { allow } = rule

    if (allow === true) {
      return
    }

    // allow is Array<string>
    if (allow.includes(payload.iss)) {
      return
    }
    if (payload.sub != null && allow.includes(payload.sub)) {
      try {
        await checkCapability({ act: payload.prc, res: serverID }, payload, options)
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (
          !message.startsWith('Invalid capability') &&
          !message.startsWith('Invalid payload') &&
          !message.startsWith('Invalid token')
        ) {
          throw err
        }
      }
    }
  }

  throw new Error('Access denied')
}

export async function checkClientToken(
  serverID: string,
  rules: AccessRules,
  token: SignedToken,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  const procedure = (payload as ProcedureAccessPayload).prc
  if (procedure == null) {
    throw new Error('No procedure to check')
  }

  if (payload.iss === serverID) {
    // If issuer uses the server's signer, only check audience and expiration if provided
    if (payload.aud != null && payload.aud !== serverID) {
      throw new Error('Invalid audience')
    }
    if (payload.exp != null) {
      assertNonExpired(payload, options?.atTime)
    }
    return
  }

  if (payload.sub === serverID) {
    // If subject is the server, check capability directly
    await checkCapability({ act: procedure, res: serverID }, payload, options)
    return
  }

  if (payload.aud !== serverID) {
    throw new Error('Invalid audience')
  }
  await checkProcedureAccess(serverID, rules, token as SignedToken<ProcedureAccessPayload>, options)
}
