/**
 * Stable Enkaku server error codes, sent in `ErrorReplyPayload.code`.
 *
 * These string values are part of the wire protocol — never renumber or
 * reuse a code. Add new codes at the end with the next free `EK` number.
 */
export const ErrorCodes = {
  /** EK01: Handler execution failed. */
  HANDLER_ERROR: 'EK01',
  /** EK02: Access denied (authorization failure). */
  ACCESS_DENIED: 'EK02',
  /** EK03: Server controller limit reached. */
  CONTROLLER_LIMIT: 'EK03',
  /** EK04: Server handler concurrency limit reached. */
  HANDLER_LIMIT: 'EK04',
  /** EK05: Request timeout (controller expired). */
  TIMEOUT: 'EK05',
  /** EK06: Message exceeds maximum size. */
  MESSAGE_TOO_LARGE: 'EK06',
  /** EK07: Encryption required but message is not encrypted. */
  ENCRYPTION_REQUIRED: 'EK07',
  /** EK08: Invalid protocol message (schema validation failed). */
  INVALID_MESSAGE: 'EK08',
} as const

/** Union of all known Enkaku server error code strings. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
