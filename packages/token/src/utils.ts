import { b64uFromJSON } from '@enkaku/codec'

import type { Token } from './types.js'

/**
 * Convert a Token object to its JWT string representation.
 */
export function stringifyToken(token: Token): string {
  const parts = [b64uFromJSON(token.header), b64uFromJSON(token.payload)]
  if (token.signature != null) {
    parts.push(token.signature)
  }
  return parts.join('.')
}
