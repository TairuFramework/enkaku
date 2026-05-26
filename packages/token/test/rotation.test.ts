import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { createIdentity } from '../src/identity.js'
import { createRotationAssertion } from '../src/rotation.js'
import { verifyToken } from '../src/token.js'

describe('createRotationAssertion', () => {
  it('produces a signed token linking old → new', async () => {
    const oldId = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    const newId = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    const assertion = await createRotationAssertion(oldId, newId)
    expect(assertion.payload.iss).toBe(oldId.did)
    expect(assertion.payload.type).toBe('did-rotation')
    expect(assertion.payload.to).toBe(newId.did)
    expect(assertion.payload.toLongForm).toBe(newId.longForm)
    expect(typeof assertion.payload.issuedAt).toBe('number')
  })

  it('verifies under the old identity', async () => {
    const oldId = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    const newId = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    const assertion = await createRotationAssertion(oldId, newId)
    const cache = createInMemoryDIDCache()
    const verified = await verifyToken(assertion, undefined, undefined, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toBeDefined()
  })
})
