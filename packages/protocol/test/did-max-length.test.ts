import { createIdentity } from '@kokuin/token'
import { createValidator, isType } from '@sozai/schema'
import { describe, expect, test } from 'vitest'

import { createSignedMessageSchema } from '../src/schemas/message.js'

// A did:peer:4 long form inlines the DID document, so a signed frame's `iss`
// runs well past the old 256 cap. These guard that the widened bound admits a
// real peer:4 long-form token yet still rejects an oversized claim.
describe('signed message DID claim length', () => {
  const payloadSchema = {
    type: 'object',
    properties: { typ: { type: 'string' }, prc: { type: 'string' }, rid: { type: 'string' } },
    required: ['typ', 'prc', 'rid'],
    additionalProperties: false,
  } as const

  test('admits a real did:peer:4 long-form iss and rejects an over-long one', async () => {
    const identity = await createIdentity({
      didMethod: 'peer:4',
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    // The long form is what embedLongForm puts on the wire; sanity-check it is
    // the case this fix exists for (past 256, within the new bound).
    expect(identity.longForm.length).toBeGreaterThan(256)
    expect(identity.longForm.length).toBeLessThanOrEqual(1024)

    const token = await identity.signToken(
      { typ: 'request', prc: 'test/request', rid: '1' },
      { embedLongForm: true },
    )
    expect(token.payload.iss).toBe(identity.longForm)

    const validator = createValidator({
      ...createSignedMessageSchema(payloadSchema),
      $id: 'did-max-length',
    })
    expect(isType(validator, token)).toBe(true)

    const overLong = { ...token, payload: { ...token.payload, iss: 'x'.repeat(1025) } }
    expect(isType(validator, overLong)).toBe(false)
  })
})
