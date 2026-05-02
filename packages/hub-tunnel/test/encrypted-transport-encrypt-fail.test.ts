import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'
import { EncryptError } from '../src/errors.js'

import { FakeEncryptor } from './fixtures/fake-encryptor.js'
import { FakeHub } from './fixtures/fake-hub.js'

const SHARED_KEY = new Uint8Array([0x42, 0x13, 0x37, 0x99])

type Msg = { msg: string }

describe('createEncryptedHubTunnelTransport encrypt failures', () => {
  test('encrypt failure surfaces EncryptError to caller and tears down the session', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-encrypt-fail'
    const groupID = 'group-encrypt-fail'
    const aDID = 'did:peer:a'
    const bDID = 'did:peer:b'

    const aEncryptor = new FakeEncryptor({ key: SHARED_KEY })
    const bEncryptor = new FakeEncryptor({ key: SHARED_KEY })

    aEncryptor.failNextEncrypts(1)

    const aTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
      encryptor: aEncryptor,
      groupID,
    })
    const bTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      encryptor: bEncryptor,
      groupID,
    })

    try {
      expect(hub.subscriberCount(aDID)).toBe(1)

      let writeError: unknown
      try {
        await aTransport.write({ msg: 'm-0' })
      } catch (err) {
        writeError = err
      }

      expect(writeError).toBeDefined()
      const isEncryptError =
        writeError instanceof EncryptError ||
        (writeError instanceof Error &&
          (writeError as Error & { cause?: unknown }).cause instanceof EncryptError)
      expect(isEncryptError).toBe(true)

      let readError: unknown
      try {
        await aTransport.read()
      } catch (err) {
        readError = err
      }
      expect(readError).toBeDefined()

      expect(hub.subscriberCount(aDID)).toBe(0)
    } finally {
      try {
        await aTransport.dispose()
      } catch {
        // ignore
      }
      try {
        await bTransport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(aDID)
      hub.disconnect(bDID)
    }
  })
})
