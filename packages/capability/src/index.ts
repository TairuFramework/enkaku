/**
 * Capability delegation and verification for Enkaku JWTs.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/capability
 * ```
 *
 * @module capability
 */

import {
  isVerifiedToken,
  type SignedHeader,
  type SignedPayload,
  type SignedToken,
  type TokenSigner,
  verifyToken,
} from '@enkaku/token'

export function now(): number {
  return Math.floor(Date.now() / 1000)
}

/** Default maximum delegation chain depth */
export const DEFAULT_MAX_DELEGATION_DEPTH = 20

/** Options for delegation chain validation */
export type DelegationChainOptions = {
  /** Maximum depth of delegation chain. Defaults to 20. */
  maxDepth?: number
}

export type Permission = {
  act: string | Array<string>
  res: string | Array<string>
}

export type CapabilityPayload = Permission & {
  iss: string
  sub: string
  aud: string
  exp?: number
  iat?: number
  jti?: string
}

export type CapabilityToken<
  Payload extends CapabilityPayload = CapabilityPayload,
  Header extends Record<string, unknown> = Record<string, unknown>,
> = SignedToken<Payload, Header>

function isStringOrStringArray(value: unknown): value is string | Array<string> {
  if (typeof value === 'string') {
    return true
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string')
  }
  return false
}

export function isCapabilityToken<Payload extends CapabilityPayload>(
  token: unknown,
): token is CapabilityToken<Payload> {
  if (!isVerifiedToken(token)) {
    return false
  }

  const payload = token.payload as Record<string, unknown>

  // Validate required string fields
  if (typeof payload.aud !== 'string') {
    return false
  }
  if (typeof payload.sub !== 'string') {
    return false
  }

  // Validate act and res are string or string[]
  if (!isStringOrStringArray(payload.act)) {
    return false
  }
  if (!isStringOrStringArray(payload.res)) {
    return false
  }

  return true
}

export function assertCapabilityToken<Payload extends CapabilityPayload>(
  token: unknown,
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
  signer: TokenSigner,
  payload: Payload,
  header?: HeaderParams,
): Promise<CapabilityToken<Payload & { iss: string }, SignedHeader>> {
  return await signer.createToken(payload, header)
}

export function isMatch(expected: string, actual: string): boolean {
  return expected === actual || actual === '*'
}

export function hasPartsMatch(expected: string, actual: string): boolean {
  const expectedParts = expected.split('/')
  const actualParts = actual.split('/')
  for (let i = 0; i < expectedParts.length; i++) {
    const part = actualParts[i]
    if (part === '*') {
      break
    }
    if (expectedParts[i] !== part) {
      return false
    }
  }
  return true
}

export function hasPermission(expected: Permission, granted: Permission): boolean {
  // If multiple actions are expected, check that all of them are granted
  if (Array.isArray(expected.act)) {
    return expected.act.every((act) => hasPermission({ act, res: expected.res }, granted))
  }
  // If multiple resources are expected, check that all of them are granted
  if (Array.isArray(expected.res)) {
    return expected.res.every((res) => hasPermission({ act: expected.act, res }, granted))
  }
  // If multiple actions are granted, check that at least one of them matches the expectation
  if (Array.isArray(granted.act)) {
    return granted.act.some((act) => hasPermission(expected, { act, res: granted.res }))
  }
  // If multiple resource are granted, check that at least one of them matches the expectation
  if (Array.isArray(granted.res)) {
    return granted.res.some((res) => hasPermission(expected, { act: granted.act, res }))
  }
  // Sanity check
  if (granted.act === '' || granted.res === '') {
    return false
  }
  // Check for exact or wildcard match of the action and resource
  if (isMatch(expected.act, granted.act) && isMatch(expected.res, granted.res)) {
    return true
  }
  // Check for partial match of the action and resource
  return hasPartsMatch(expected.act, granted.act) && hasPartsMatch(expected.res, granted.res)
}

export function assertNonExpired(payload: { exp?: number }, atTime?: number): void {
  if (payload.exp != null && payload.exp < (atTime ?? now())) {
    throw new Error('Invalid token: expired')
  }
}

export function assertValidDelegation(
  from: CapabilityPayload,
  to: CapabilityPayload,
  atTime?: number,
): void {
  if (to.iss !== from.aud) {
    throw new Error('Invalid capability: audience mismatch')
  }
  if (to.sub !== from.sub) {
    throw new Error('Invalid capability: subject mismatch')
  }
  assertNonExpired(from, atTime)
  if (!hasPermission(to, from)) {
    throw new Error('Invalid capability: permission mismatch')
  }
}

export async function checkDelegationChain(
  payload: CapabilityPayload,
  capabilities: Array<string>,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DELEGATION_DEPTH

  if (capabilities.length > maxDepth) {
    throw new Error(
      `Invalid capability: delegation chain exceeds maximum depth of ${maxDepth}`,
    )
  }

  if (capabilities.length === 0) {
    if (payload.iss !== payload.sub) {
      throw new Error('Invalid capability: issuer should be subject')
    }
    assertNonExpired(payload, atTime)
    return
  }

  const [head, ...tail] = capabilities
  const next = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(next)
  assertValidDelegation(next.payload, payload, atTime)
  await checkDelegationChain(next.payload, tail, atTime, options)
}

export async function checkCapability(
  permission: Permission,
  payload: SignedPayload,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  if (payload.sub == null) {
    throw new Error('Invalid payload: no subject')
  }

  const time = atTime ?? now()
  if (payload.iss === payload.sub) {
    // Subject is issuer, no delegation required
    // But still need to validate the permission is granted
    assertNonExpired(payload, time)

    // Validate that the token grants the requested permission
    const tokenPermission = {
      act: (payload as { act?: string | Array<string> }).act,
      res: (payload as { res?: string | Array<string> }).res,
    }

    if (tokenPermission.act == null || tokenPermission.res == null) {
      throw new Error('Invalid payload: missing act or res for self-issued token')
    }

    if (!hasPermission(permission, tokenPermission as Permission)) {
      throw new Error('Invalid capability: permission not granted')
    }

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

  const toCapability = { ...payload, ...permission } as CapabilityPayload
  assertValidDelegation(capability.payload, toCapability, time)
  await checkDelegationChain(capability.payload, tail, time, options)
}
