import { assertNonExpired, checkCapability, hasPartsMatch } from '@enkaku/capability'
import type { SignedToken } from '@enkaku/jwt'
import type { AnyClientPayloadOf, AnyDefinitions } from '@enkaku/protocol'

export type CommandAccessRecord = Record<string, boolean | Array<string>>

export type CommandAccessPayload = {
  iss?: string
  sub?: string
  aud?: string
  cmd?: string
  exp?: number
}

export async function checkCommandAccess(
  serverID: string,
  record: CommandAccessRecord,
  token: SignedToken<CommandAccessPayload>,
  atTime?: number,
): Promise<void> {
  const payload = token.payload
  if (payload.cmd == null) {
    throw new Error('No command to check')
  }

  for (const [command, access] of Object.entries(record)) {
    if (hasPartsMatch(payload.cmd, command)) {
      if (access === true) {
        // Command can be publicly accessed
        return
      }
      if (access === false) {
        // Command cannot be accessed
        continue
      }
      if (access.includes(payload.iss)) {
        // Issuer is allowed directly
        return
      }
      if (payload.sub == null || !access.includes(payload.sub)) {
        // Subject is not allowed to access this command
        continue
      }
      try {
        // Check delegation from subject
        await checkCapability({ act: payload.cmd, res: serverID }, payload, atTime)
        return
      } catch {}
    }
  }

  throw new Error('Access denied')
}

export async function checkClientToken<Definition extends AnyDefinitions>(
  serverID: string,
  record: CommandAccessRecord,
  token: SignedToken<AnyClientPayloadOf<Definition>>,
  atTime?: number,
): Promise<void> {
  const payload = token.payload
  const command = (payload as CommandAccessPayload).cmd
  if (command == null) {
    throw new Error('No command to check')
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
    await checkCapability({ act: command, res: serverID }, payload, atTime)
    return
  }

  if (payload.aud !== serverID) {
    throw new Error('Invalid audience')
  }
  await checkCommandAccess(serverID, record, token, atTime)
}
