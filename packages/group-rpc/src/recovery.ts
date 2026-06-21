import { fromUTF, toUTF } from '@sozai/codec'

/**
 * Payload codecs for the recovery rendezvous carried on the handshake lane. A
 * request names a `requestID` so replies correlate and redundant responders can
 * observe-and-suppress; a reply echoes the `requestID` and carries the GroupInfo.
 */

export function encodeRecoveryRequest(requestID: string): Uint8Array {
  return fromUTF(requestID)
}

export function decodeRecoveryRequest(payload: Uint8Array): string {
  return toUTF(payload)
}

export function encodeRecoveryReply(requestID: string, groupInfo: Uint8Array): Uint8Array {
  const rid = fromUTF(requestID)
  if (rid.length > 0xffff) {
    throw new Error('recovery reply requestID is too long')
  }
  const out = new Uint8Array(2 + rid.length + groupInfo.length)
  new DataView(out.buffer).setUint16(0, rid.length, true)
  out.set(rid, 2)
  out.set(groupInfo, 2 + rid.length)
  return out
}

export function decodeRecoveryReply(payload: Uint8Array): {
  requestID: string
  groupInfo: Uint8Array
} {
  if (payload.length < 2) {
    throw new Error('recovery reply is too short')
  }
  const ridLen = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint16(
    0,
    true,
  )
  if (payload.length < 2 + ridLen) {
    throw new Error('recovery reply is truncated')
  }
  return {
    requestID: toUTF(payload.subarray(2, 2 + ridLen)),
    groupInfo: payload.subarray(2 + ridLen),
  }
}
