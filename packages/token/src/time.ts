/**
 * Get the current time in seconds since Unix epoch.
 */
export function now(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Options for time-based token validation.
 */
export type TimeValidationOptions = {
  /** Current time in seconds. Defaults to now(). */
  atTime?: number
  /** Clock skew tolerance in seconds. Defaults to 0. */
  clockTolerance?: number
}

/**
 * Payload with optional time-based claims.
 */
export type TimeClaimsPayload = {
  /** Expiration time (seconds since epoch) */
  exp?: number
  /** Not before time (seconds since epoch) */
  nbf?: number
  /** Issued at time (seconds since epoch) */
  iat?: number
}

/**
 * Validate time-based claims in a token payload.
 * @throws Error if token is expired or not yet valid
 */
export function assertTimeClaimsValid(
  payload: TimeClaimsPayload,
  options: TimeValidationOptions = {},
): void {
  const time = options.atTime ?? now()
  const tolerance = options.clockTolerance ?? 0

  if (payload.exp != null && payload.exp + tolerance < time) {
    throw new Error('Token expired')
  }

  if (payload.nbf != null && payload.nbf - tolerance > time) {
    throw new Error('Token not yet valid')
  }
}
