import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import type { KeyStore } from '@enkaku/protocol'
import { createFullIdentity, type FullIdentity, type IdentityProvider } from '@enkaku/token'
import { mnemonicToSeedSync } from '@scure/bip39'

import { resolveDerivationPath } from './derivation.js'
import { HDKeyEntry } from './entry.js'

const DEFAULT_BASE_PATH = "44'/876'"
const tracer = createTracer('keystore.hd')
const logger = getEnkakuLogger('hd-keystore')

export type HDKeyStoreParams = {
  seed: Uint8Array
  basePath?: string
}

export class HDKeyStore
  implements KeyStore<Uint8Array, HDKeyEntry>, IdentityProvider<FullIdentity>
{
  #seed: Uint8Array
  #basePath: string
  #entries: Record<string, HDKeyEntry> = {}

  static fromMnemonic(mnemonic: string, options?: { basePath?: string }): HDKeyStore {
    const seed = mnemonicToSeedSync(mnemonic)
    return new HDKeyStore({ seed, basePath: options?.basePath })
  }

  static fromSeed(seed: Uint8Array, options?: { basePath?: string }): HDKeyStore {
    return new HDKeyStore({ seed, basePath: options?.basePath })
  }

  constructor(params: HDKeyStoreParams) {
    this.#seed = params.seed
    this.#basePath = params.basePath ?? DEFAULT_BASE_PATH
  }

  entry(keyID: string): HDKeyEntry {
    const path = resolveDerivationPath(keyID, this.#basePath)
    this.#entries[path] ??= new HDKeyEntry({ seed: this.#seed, path })
    return this.#entries[path]
  }

  async provideIdentity(keyID: string): Promise<FullIdentity> {
    return withSpan(
      tracer,
      SpanNames.KEYSTORE_GET_OR_CREATE,
      { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'hd' } },
      async (span) => {
        const entry = this.entry(keyID)
        const privateKey = await entry.provideAsync()
        const identity = createFullIdentity(privateKey)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        logger.info('HD identity derived: {did}', { did: identity.id })
        return identity
      },
    )
  }
}
