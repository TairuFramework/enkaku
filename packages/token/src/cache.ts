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

export type CreateInMemoryDIDCacheOptions = {
  /** Maximum number of cached entries. Oldest evicted first. Default 10_000. */
  maxEntries?: number
}

const DEFAULT_MAX_ENTRIES = 10_000

/**
 * Build an in-memory DID cache. The returned cache verifies short-form/doc binding on every set
 * and evicts least-recently-used entries when maxEntries is exceeded.
 */
export function createInMemoryDIDCache(options: CreateInMemoryDIDCacheOptions = {}): DIDCache {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  if (maxEntries < 1) {
    throw new Error('DIDCache: maxEntries must be at least 1')
  }
  const docs = new Map<string, DIDDoc>()

  function touch(shortForm: string, doc: DIDDoc): void {
    docs.delete(shortForm)
    docs.set(shortForm, doc)
  }

  return {
    get(shortForm) {
      const doc = docs.get(shortForm)
      if (doc != null) {
        touch(shortForm, doc)
      }
      return doc
    },
    set(shortForm, doc) {
      if (!isPeer4(shortForm)) {
        return Promise.reject(new Error('DIDCache: short form must be a did:peer:4 identifier'))
      }
      const expected = encodePeer4(doc).shortForm
      if (expected !== shortForm) {
        return Promise.reject(new Error('DIDCache: short form/doc hash mismatch'))
      }
      touch(shortForm, doc)
      while (docs.size > maxEntries) {
        const oldest = docs.keys().next().value
        if (oldest == null) break
        docs.delete(oldest)
      }
      return Promise.resolve()
    },
  }
}
