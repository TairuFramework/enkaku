import {
  assertNonExpired,
  checkCapability,
  type DelegationChainOptions,
  hasPartsMatch,
} from '@kokuin/capability'
import { normalizeDID, type SignedToken } from '@kokuin/token'

export type AccessDecision = { verifyDelegation: () => Promise<boolean> }

function createAccessDecision(
  serverID: string,
  payload: ProcedureAccessPayload,
  options?: DelegationChainOptions,
  verified = false,
): AccessDecision {
  let verification: Promise<boolean> | undefined = verified ? Promise.resolve(true) : undefined
  const verify = async (): Promise<boolean> => {
    if (payload.sub == null || normalizeDID(payload.sub) === normalizeDID(payload.iss)) return false
    try {
      await checkCapability({
        ...options,
        permission: { act: payload.prc as string, res: serverID },
        payload,
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (
        message.startsWith('Invalid capability') ||
        message.startsWith('Invalid payload') ||
        message.startsWith('Invalid token')
      )
        return false
      throw err
    }
  }
  return { verifyDelegation: () => (verification ??= verify()) }
}

export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type ProcedureAccessPayload = {
  iss: string
  sub?: string
  aud?: string
  prc?: string
  exp?: number
}

export type AllowContext = {
  pattern: string
  procedure: string
  payload: ProcedureAccessPayload
  serverID: string
  verifyDelegation: () => Promise<boolean>
}

export type AllowPredicate = (ctx: AllowContext) => boolean | Promise<boolean>

export type AccessRule = {
  allow: true | Array<string> | AllowPredicate
  encryption?: EncryptionPolicy
}

/**
 * Maps procedure-name patterns to access rules for a server.
 *
 * Security note: access checks admit on the verified issuer (`payload.iss`).
 * `payload.sub` is caller-asserted and is NOT validated as a delegation unless
 * a delegation rule explicitly triggers that branch. Do not treat `sub` as a
 * verified identity in handlers.
 */
export type AccessRules = Record<string, AccessRule>

export function resolveEncryptionPolicy(
  procedure: string,
  rules: AccessRules | undefined,
  globalPolicy: EncryptionPolicy,
): EncryptionPolicy {
  if (rules != null) {
    for (const [pattern, rule] of Object.entries(rules)) {
      if (hasPartsMatch({ expected: procedure, actual: pattern })) {
        if (rule.encryption != null) {
          return rule.encryption
        }
      }
    }
  }
  return globalPolicy
}

export async function checkProcedureAccess(
  serverID: string,
  rules: AccessRules,
  token: SignedToken<ProcedureAccessPayload>,
  options?: DelegationChainOptions,
): Promise<AccessDecision> {
  const decision = createAccessDecision(serverID, token.payload, options)
  return evaluateProcedureAccess(serverID, rules, token, decision)
}

async function evaluateProcedureAccess(
  serverID: string,
  rules: AccessRules,
  token: SignedToken<ProcedureAccessPayload>,
  decision: AccessDecision,
): Promise<AccessDecision> {
  const { verifyDelegation } = decision
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  const procedure = payload.prc

  for (const [pattern, rule] of Object.entries(rules)) {
    if (!hasPartsMatch({ expected: procedure, actual: pattern })) continue

    const { allow } = rule

    if (allow === true) {
      return decision
    }

    if (Array.isArray(allow)) {
      const normalizedAllow = allow.map(normalizeDID)
      const normalizedIss = normalizeDID(payload.iss)
      if (normalizedAllow.includes(normalizedIss)) return decision
      if (payload.sub != null) {
        const normalizedSub = normalizeDID(payload.sub)
        if (normalizedAllow.includes(normalizedSub)) {
          if (await verifyDelegation()) return decision
        }
      }
      continue
    }

    // allow is AllowPredicate. A thrown error or rejected promise propagates
    // to the caller — only `false` falls through to the next pattern.
    const ctx: AllowContext = {
      pattern,
      procedure,
      payload,
      serverID,
      verifyDelegation,
    }
    if (await allow(ctx)) return decision
  }

  throw new Error('Access denied')
}

export async function checkClientToken(
  serverID: string,
  rules: AccessRules,
  token: SignedToken,
  options?: DelegationChainOptions,
): Promise<AccessDecision> {
  const payload = token.payload
  const procedure = (payload as ProcedureAccessPayload).prc
  if (procedure == null) {
    throw new Error('No procedure to check')
  }

  const decision = createAccessDecision(serverID, payload, options)
  const normalizedServerID = normalizeDID(serverID)

  if (normalizeDID(payload.iss) === normalizedServerID) {
    // If issuer uses the server's signer, only check audience and expiration if provided
    if (payload.aud != null && normalizeDID(payload.aud) !== normalizedServerID) {
      throw new Error('Invalid audience')
    }
    if (payload.exp != null) {
      assertNonExpired({ payload, atTime: options?.atTime })
    }
    return decision
  }

  if (payload.sub != null && normalizeDID(payload.sub) === normalizedServerID) {
    // If subject is the server, check capability directly
    await checkCapability({
      ...options,
      permission: { act: procedure, res: serverID },
      payload,
    })
    return createAccessDecision(serverID, payload, options, true)
  }

  if (payload.aud == null || normalizeDID(payload.aud) !== normalizedServerID) {
    throw new Error('Invalid audience')
  }
  return evaluateProcedureAccess(
    serverID,
    rules,
    token as SignedToken<ProcedureAccessPayload>,
    decision,
  )
}
