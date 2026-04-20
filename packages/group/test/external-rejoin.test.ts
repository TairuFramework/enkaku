import { randomIdentity } from '@enkaku/token'
import {
  decode,
  encode,
  mlsMessageDecoder,
  mlsMessageEncoder,
  protocolVersions,
  wireformats,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

import { createGroup, exportGroupInfo } from '../src/group.js'

describe('external rejoin codec round-trip', () => {
  test('mlsMessage(GroupInfo) encode → decode preserves version + wireformat', async () => {
    const alice = randomIdentity()
    const { group } = await createGroup(alice, 'codec-rt-group')

    const { groupInfo } = await exportGroupInfo({ group })
    expect(groupInfo).toBeInstanceOf(Uint8Array)

    const decoded = decode(mlsMessageDecoder, groupInfo)
    expect(decoded).toBeDefined()
    if (decoded == null) throw new Error('unreachable')
    expect(decoded.version).toBe(protocolVersions.mls10)
    expect(decoded.wireformat).toBe(wireformats.mls_group_info)

    // Re-encode and compare — round-trip stability
    const reencoded = encode(mlsMessageEncoder, decoded)
    expect(reencoded.length).toBe(groupInfo.length)
    expect(reencoded).toEqual(groupInfo)
  })
})
