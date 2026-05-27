import type { MultiKeyIdentity } from './identity.js'
import type { SignedToken } from './types.js'

export type RotationPayload = {
  type: 'did-rotation'
  iss?: string
  to: string
  toLongForm: string
  issuedAt: number
}

/**
 * Sign a rotation assertion linking an old identity to a new one.
 * The assertion is a regular signed token whose `iss` is the old DID.
 * Verifiers walking a rotation chain can use this to link related identities.
 */
export async function createRotationAssertion(
  oldIdentity: MultiKeyIdentity,
  newIdentity: MultiKeyIdentity,
  issuedAt: number = Math.floor(Date.now() / 1000),
): Promise<SignedToken<RotationPayload>> {
  return oldIdentity.signToken<RotationPayload>({
    type: 'did-rotation',
    to: newIdentity.id,
    toLongForm: newIdentity.longForm,
    issuedAt,
  })
}
