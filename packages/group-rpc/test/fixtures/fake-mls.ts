import type { CommitContext, GroupMLS } from '../../src/crypto.js'

export type FakeMLS = GroupMLS & {
  epoch: () => number
  commits: () => number
  lastSender: () => string | undefined
}

export type FakeMLSOptions = {
  recoverySecret?: Uint8Array
  epoch?: number
  /** Called whenever the modelled epoch advances (e.g. to keep a FakeCrypto in step). */
  onAdvance?: (epoch: number) => void
}

/**
 * Deterministic GroupMLS for tests. Models a single epoch counter: a non-empty
 * Commit advances it; GroupInfo carries the epoch so a stranded peer can jump
 * forward. The recovery secret is fixed for the instance's life (epoch-independent).
 * NOT real MLS.
 */
export function createFakeMLS(options: FakeMLSOptions = {}): FakeMLS {
  const recoverySecret = options.recoverySecret ?? new Uint8Array(32).fill(0x33)
  let epoch = options.epoch ?? 0
  let commits = 0
  let lastSender: string | undefined

  const advance = (to: number): void => {
    epoch = to
    options.onAdvance?.(epoch)
  }

  return {
    epoch: () => epoch,
    commits: () => commits,
    lastSender: () => lastSender,
    async processCommit(commit: Uint8Array, context: CommitContext) {
      lastSender = context.senderDID
      if (commit.length === 0) {
        return { advanced: false }
      }
      commits += 1
      advance(epoch + 1)
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
      advance(target)
      return { advanced: true }
    },
    exportRecoverySecret() {
      return recoverySecret
    },
  }
}
