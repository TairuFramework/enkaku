import { describe, expect, test } from 'vitest'

import type { CommitContext, GroupMLS } from '../src/crypto.js'

/**
 * A throwaway fake exercising the port's call shape — the full reference
 * implementation lands later. Models a single epoch counter: a non-empty Commit
 * advances it; GroupInfo carries the epoch so recovery can jump forward.
 */
function createFakeGroupMLS(recoverySecret: Uint8Array): GroupMLS & { epoch: () => number } {
  let epoch = 0
  let lastSender: string | undefined
  return {
    epoch: () => epoch,
    async processCommit(commit: Uint8Array, context: CommitContext) {
      lastSender = context.senderDID
      if (commit.length === 0) {
        return { advanced: false }
      }
      epoch += 1
      return { advanced: true }
    },
    async exportGroupInfo() {
      return Uint8Array.from([epoch])
    },
    async applyRecovery(groupInfo: Uint8Array) {
      const target = groupInfo[0] ?? epoch
      if (target <= epoch) {
        return { advanced: false }
      }
      epoch = target
      return { advanced: true }
    },
    exportRecoverySecret() {
      return recoverySecret
    },
  } as GroupMLS & { epoch: () => number; lastSender?: string }
}

describe('GroupMLS port', () => {
  test('processCommit advances the epoch and reports it', async () => {
    const mls = createFakeGroupMLS(new Uint8Array(32).fill(1))
    expect(await mls.processCommit(new Uint8Array([1]), { senderDID: 'did:key:zA' })).toEqual({
      advanced: true,
    })
    expect(mls.epoch()).toBe(1)
  })

  test('a no-op commit does not advance', async () => {
    const mls = createFakeGroupMLS(new Uint8Array(32).fill(1))
    expect(await mls.processCommit(new Uint8Array(), {})).toEqual({ advanced: false })
    expect(mls.epoch()).toBe(0)
  })

  test('exportGroupInfo + applyRecovery jumps a stranded peer forward', async () => {
    const live = createFakeGroupMLS(new Uint8Array(32).fill(1))
    await live.processCommit(new Uint8Array([1]), {})
    await live.processCommit(new Uint8Array([1]), {})

    const stranded = createFakeGroupMLS(new Uint8Array(32).fill(1))
    const groupInfo = await live.exportGroupInfo()
    expect(await stranded.applyRecovery(groupInfo)).toEqual({ advanced: true })
    expect(stranded.epoch()).toBe(live.epoch())
  })

  test('applyRecovery is a no-op when already current', async () => {
    const mls = createFakeGroupMLS(new Uint8Array(32).fill(1))
    expect(await mls.applyRecovery(await mls.exportGroupInfo())).toEqual({ advanced: false })
  })

  test('exportRecoverySecret is stable and epoch-independent', async () => {
    const secret = new Uint8Array(32).fill(7)
    const mls = createFakeGroupMLS(secret)
    const before = await mls.exportRecoverySecret()
    await mls.processCommit(new Uint8Array([1]), {})
    const after = await mls.exportRecoverySecret()
    expect(Array.from(after)).toEqual(Array.from(before))
    expect(Array.from(after)).toEqual(Array.from(secret))
  })
})
