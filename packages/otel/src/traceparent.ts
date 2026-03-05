export type TraceparentData = {
  traceID: string
  spanID: string
  traceFlags: number
}

const TRACEPARENT_REGEX = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/

/**
 * Format a W3C traceparent header value.
 */
export function formatTraceparent(traceID: string, spanID: string, traceFlags: number): string {
  return `00-${traceID}-${spanID}-${traceFlags.toString(16).padStart(2, '0')}`
}

/**
 * Parse a W3C traceparent header value. Returns undefined if invalid.
 */
export function parseTraceparent(header: string): TraceparentData | undefined {
  const match = TRACEPARENT_REGEX.exec(header)
  if (match == null) {
    return undefined
  }
  const [, version, traceID, spanID, flags] = match
  // Only support version 00
  if (version !== '00') {
    return undefined
  }
  return {
    traceID,
    spanID,
    traceFlags: Number.parseInt(flags, 16),
  }
}
