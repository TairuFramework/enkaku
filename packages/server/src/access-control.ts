import { assertNonExpired, checkCapability, hasPartsMatch } from '@enkaku/capability'
import type { SignedToken } from '@enkaku/token'

export type ProcedureAccessRecord = Record<string, boolean | Array<string>>

export type ProcedureAccessPayload = {
  iss: string
  sub?: string
  aud?: string
  prc?: string
  exp?: number
}

export async function checkProcedureAccess(
  serverID: string,
  record: ProcedureAccessRecord,
  token: SignedToken<ProcedureAccessPayload>,
  atTime?: number,
): Promise<void> {
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  for (const [procedure, access] of Object.entries(record)) {
    if (hasPartsMatch(payload.prc, procedure)) {
      if (access === true) {
        // Procedure can be publicly accessed
        return
      }
      if (access === false) {
        // Procedure cannot be accessed
        continue
      }
      if (access.includes(payload.iss)) {
        // Issuer is allowed directly
        return
      }
      if (payload.sub == null || !access.includes(payload.sub)) {
        // Subject is not allowed to access this procedure
        continue
      }
      try {
        // Check delegation from subject
        await checkCapability({ act: payload.prc, res: serverID }, payload, atTime)
        return
      } catch {}
    }
  }

  throw new Error('Access denied')
}

export async function checkClientToken(
  serverID: string,
  record: ProcedureAccessRecord,
  token: SignedToken,
  atTime?: number,
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
      assertNonExpired(payload, atTime)
    }
    return
  }

  if (payload.sub === serverID) {
    // If subject is the server, check capability directly
    await checkCapability({ act: procedure, res: serverID }, payload, atTime)
    return
  }

  if (payload.aud !== serverID) {
    throw new Error('Invalid audience')
  }
  await checkProcedureAccess(serverID, record, token as SignedToken<ProcedureAccessPayload>, atTime)
}
