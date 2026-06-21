import type { KeyStore } from '@kokuin/token'

import { ExpoKeyEntry, type StoreEntryOptions } from './entry.js'

export const ExpoKeyStore: KeyStore<Uint8Array, ExpoKeyEntry> = {
  entry: (keyID: string, options?: StoreEntryOptions): ExpoKeyEntry => {
    return new ExpoKeyEntry(keyID, options)
  },
}
