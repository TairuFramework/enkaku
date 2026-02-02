import { describe, expect, test } from 'vitest'

import { randomIdentity } from '../src/identity.js'
import { createTokenEncrypter, unwrapEnvelope, wrapEnvelope } from '../src/jwe.js'

describe('wrapEnvelope / unwrapEnvelope', () => {
  test('plain mode round-trip', async () => {
    const payload = { typ: 'request', prc: 'test', rid: '123', prm: {} }
    const wrapped = await wrapEnvelope('plain', payload, {})
    const result = await unwrapEnvelope(wrapped, {})
    expect(result.mode).toBe('plain')
    expect(result.payload.typ).toBe('request')
  })

  test('jws mode round-trip', async () => {
    const identity = randomIdentity()
    const payload = { typ: 'request', prc: 'test', rid: '123', prm: {} }
    const wrapped = await wrapEnvelope('jws', payload, { signer: identity })
    const result = await unwrapEnvelope(wrapped, {})
    expect(result.mode).toBe('jws')
    expect(result.payload.prc).toBe('test')
  })

  test('jws-in-jwe mode round-trip', async () => {
    const sender = randomIdentity()
    const recipient = randomIdentity()
    const encrypter = createTokenEncrypter(recipient.id)
    const payload = { typ: 'request', prc: 'secret', rid: '456', prm: { key: 'value' } }

    const wrapped = await wrapEnvelope('jws-in-jwe', payload, {
      signer: sender,
      encrypter,
    })
    const result = await unwrapEnvelope(wrapped, { decrypter: recipient })
    expect(result.mode).toBe('jws-in-jwe')
    expect(result.payload.prc).toBe('secret')
  })

  test('jwe-in-jws mode round-trip', async () => {
    const sender = randomIdentity()
    const recipient = randomIdentity()
    const encrypter = createTokenEncrypter(recipient.id)
    const payload = { typ: 'request', prc: 'secret', rid: '789', prm: {} }

    const wrapped = await wrapEnvelope('jwe-in-jws', payload, {
      signer: sender,
      encrypter,
    })
    const result = await unwrapEnvelope(wrapped, { decrypter: recipient })
    expect(result.mode).toBe('jwe-in-jws')
    expect(result.payload.prc).toBe('secret')
  })

  test('wrapEnvelope throws if jws mode but no signer', async () => {
    const payload = { typ: 'request', prc: 'test', rid: '1' }
    await expect(wrapEnvelope('jws', payload, {})).rejects.toThrow('Signer required')
  })

  test('wrapEnvelope throws if encrypted mode but no encrypter', async () => {
    const identity = randomIdentity()
    const payload = { typ: 'request', prc: 'test', rid: '1' }
    await expect(
      wrapEnvelope('jws-in-jwe', payload, { signer: identity }),
    ).rejects.toThrow('Encrypter required')
  })
})
