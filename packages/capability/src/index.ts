import {
  type SignedHeader,
  type SignedPayload,
  type SignedToken,
  type Signer,
  type Token,
  createSignedToken,
  isVerifiedToken,
  verifyToken,
} from '@enkaku/jwt'

export function now(): number {
  return Math.floor(Date.now() / 1000)
}

export type CapabilityPayload = {
  iss: string
  sub: string
  aud: string
  res: string | Array<string>
  exp?: number
  iat?: number
  jti?: string
}

export type CapabilityToken<
  Payload extends CapabilityPayload = CapabilityPayload,
  Header extends SignedHeader = SignedHeader,
> = SignedToken<Payload, Header>

export function isCapabilityToken<Payload extends CapabilityPayload>(
  token: Token<Payload>,
): token is CapabilityToken<Payload> {
  return (
    isVerifiedToken(token) &&
    token.payload.aud != null &&
    token.payload.sub != null &&
    token.payload.res != null
  )
}

export function assertCapabilityToken<Payload extends CapabilityPayload>(
  token: Token<Payload>,
): asserts token is CapabilityToken<Payload> {
  if (!isCapabilityToken(token)) {
    throw new Error('Invalid token: not a capability')
  }
}

export type SignCapabilityPayload = Omit<CapabilityPayload, 'iss'> & { iss?: string }

export async function createCapability<
  Payload extends SignCapabilityPayload = SignCapabilityPayload,
  HeaderParams extends Record<string, unknown> = Record<string, unknown>,
>(
  signer: Signer,
  payload: Payload,
  header?: HeaderParams,
): Promise<CapabilityToken<Payload & { iss: string }, SignedHeader<HeaderParams>>> {
  return await createSignedToken(signer, payload, header)
}

export function can(expected: string | Array<string>, granted: string | Array<string>): boolean {
  if (Array.isArray(expected)) {
    return expected.every((e) => can(e, granted))
  }
  if (Array.isArray(granted)) {
    return granted.some((g) => can(expected, g))
  }

  if (granted === '') {
    return false
  }
  if (expected === granted || granted === '*') {
    return true
  }

  const expectedParts = expected.split('/')
  const grantedParts = granted.split('/')
  for (let i = 0; i < expectedParts.length; i++) {
    const part = grantedParts[i]
    if (part !== '*' && part !== expectedParts[i]) {
      return false
    }
  }
  return true
}

export function checkExpired(payload: { exp?: number }, atTime?: number): void {
  if (payload.exp != null && payload.exp < (atTime ?? now())) {
    throw new Error('Invalid token: expired')
  }
}

export function checkValidParent(
  child: CapabilityPayload,
  parent: CapabilityPayload,
  atTime?: number,
): void {
  if (child.iss !== parent.aud) {
    throw new Error('Invalid capability: audience mismatch')
  }
  if (child.sub !== parent.sub) {
    throw new Error('Invalid capability: subject mismatch')
  }
  checkExpired(parent, atTime)
  if (!can(child.res, parent.res)) {
    throw new Error('Invalid capability: resource mismatch')
  }
}

export async function checkDelegationChain(
  payload: CapabilityPayload,
  capabilities: Array<string>,
  atTime?: number,
): Promise<void> {
  if (capabilities.length === 0) {
    if (payload.iss !== payload.sub) {
      throw new Error('Invalid capability: issuer should be subject')
    }
    checkExpired(payload, atTime)
    return
  }

  const [head, ...tail] = capabilities
  const parent = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(parent)
  checkValidParent(payload, parent.payload, atTime)
  await checkDelegationChain(parent.payload, tail, atTime)
}

export async function checkCapability(
  resource: string | Array<string>,
  payload: SignedPayload,
  atTime?: number,
): Promise<void> {
  if (payload.sub == null) {
    throw new Error('Invalid payload: no subject')
  }

  const time = atTime ?? now()
  if (payload.iss === payload.sub) {
    // Subject is issuer, no delegation required
    checkExpired(payload, time)
    return
  }

  if (payload.cap == null) {
    throw new Error('Invalid payload: no capability')
  }

  const [head, ...tail] = Array.isArray(payload.cap) ? payload.cap : [payload.cap]
  if (head == null) {
    throw new Error('Invalid payload: no capability')
  }
  const capability = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(capability)

  const asCapability = {
    iss: payload.iss,
    sub: payload.sub,
    aud: payload.sub,
    res: resource,
    exp: payload.exp,
  }
  checkValidParent(asCapability, capability.payload, time)
  await checkDelegationChain(capability.payload, tail, time)
}
