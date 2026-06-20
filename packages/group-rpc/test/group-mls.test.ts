import { describe, expect, test } from 'vitest'

import { createMemoryGroupMLS } from '../src/memory-group-mls.js'

describe('GroupMLS port', () => {
  test('processCommit advances the epoch and reports it', async () => {
    const mls = createMemoryGroupMLS({ recoverySecret: new Uint8Array(32).fill(1) })
    expect(await mls.processCommit(new Uint8Array([1]), { senderDID: 'did:key:zA' })).toEqual({
      advanced: true,
    })
    expect(mls.epoch()).toBe(1)
    expect(mls.lastSender()).toBe('did:key:zA')
  })

  test('a no-op commit does not advance', async () => {
    const mls = createMemoryGroupMLS({ recoverySecret: new Uint8Array(32).fill(1) })
    expect(await mls.processCommit(new Uint8Array(), {})).toEqual({ advanced: false })
    expect(mls.epoch()).toBe(0)
  })

  test('exportGroupInfo + applyRecovery jumps a stranded peer forward', async () => {
    const live = createMemoryGroupMLS({ recoverySecret: new Uint8Array(32).fill(1) })
    await live.processCommit(new Uint8Array([1]), {})
    await live.processCommit(new Uint8Array([1]), {})

    const stranded = createMemoryGroupMLS({ recoverySecret: new Uint8Array(32).fill(1) })
    const groupInfo = await live.exportGroupInfo()
    expect(await stranded.applyRecovery(groupInfo)).toEqual({ advanced: true })
    expect(stranded.epoch()).toBe(live.epoch())
  })

  test('applyRecovery is a no-op when already current', async () => {
    const mls = createMemoryGroupMLS({ recoverySecret: new Uint8Array(32).fill(1) })
    expect(await mls.applyRecovery(await mls.exportGroupInfo())).toEqual({ advanced: false })
  })

  test('exportRecoverySecret is stable and epoch-independent', async () => {
    const secret = new Uint8Array(32).fill(7)
    const mls = createMemoryGroupMLS({ recoverySecret: secret })
    const before = await mls.exportRecoverySecret()
    await mls.processCommit(new Uint8Array([1]), {})
    const after = await mls.exportRecoverySecret()
    expect(Array.from(after)).toEqual(Array.from(before))
    expect(Array.from(after)).toEqual(Array.from(secret))
  })
})
