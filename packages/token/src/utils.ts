import { b64uFromJSON } from '@enkaku/codec'

import type { Token } from './types.js'

export function stringifyToken(token: Token): string {
  const parts = [b64uFromJSON(token.header), b64uFromJSON(token.payload)]
  if (token.signature != null) {
    parts.push(token.signature)
  }
  return parts.join('.')
}
