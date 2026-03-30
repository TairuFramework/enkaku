import { type ClientState, clientStateDecoder, clientStateEncoder, decode, encode } from 'ts-mls'

export type { ClientState }

export function decodeClientState(encoded: Uint8Array): ClientState | undefined {
  return decode(clientStateDecoder, encoded)
}

export function encodeClientState(state: ClientState): Uint8Array {
  return encode(clientStateEncoder, state)
}
