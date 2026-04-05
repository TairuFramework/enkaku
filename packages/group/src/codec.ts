import {
  type ClientState,
  clientStateDecoder,
  clientStateEncoder,
  decode,
  encode,
  type RatchetTree,
} from 'ts-mls'

export type { ClientState }

export function decodeClientState(encoded: Uint8Array): ClientState | undefined {
  return decode(clientStateDecoder, encoded)
}

export function encodeClientState(state: ClientState): Uint8Array {
  return encode(clientStateEncoder, state)
}

export function sanitizeRatchetTree(tree: ReadonlyArray<unknown>): RatchetTree {
  return tree.map((node) => (node == null ? undefined : node)) as RatchetTree
}
