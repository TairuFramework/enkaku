import { type DIDDoc, encodePeer4, isPeer4 } from './peer4.js'

/**
 * Resolves a DID string to a DID document.
 * Implementations may be sync or async, returning undefined when the DID is unknown.
 */
export type DIDResolver = (did: string) => DIDDoc | undefined | Promise<DIDDoc | undefined>

/**
 * Content-addressed store for did:peer:4 documents, keyed by the short-form DID.
 * `set` MUST verify that the short form matches the hash of the canonical doc before storing.
 */
export type DIDCache = {
  get(shortForm: string): DIDDoc | undefined | Promise<DIDDoc | undefined>
  set(shortForm: string, doc: DIDDoc): void | Promise<void>
}

/**
 * Build an in-memory DID cache. The returned cache verifies short-form/doc binding on every set.
 */
export function createInMemoryDIDCache(): DIDCache {
  const docs = new Map<string, DIDDoc>()
  return {
    get(shortForm) {
      return docs.get(shortForm)
    },
    set(shortForm, doc) {
      if (!isPeer4(shortForm)) {
        return Promise.reject(new Error('DIDCache: short form must be a did:peer:4 identifier'))
      }
      const expected = encodePeer4(doc).shortForm
      if (expected !== shortForm) {
        return Promise.reject(new Error('DIDCache: short form/doc hash mismatch'))
      }
      docs.set(shortForm, doc)
      return Promise.resolve()
    },
  }
}
