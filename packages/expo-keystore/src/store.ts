import type { KeyStore } from '@enkaku/protocol'

import { ExpoKeyEntry, type StoreEntryOptions } from './entry.js'

export const ExpoKeyStore: KeyStore<Uint8Array, ExpoKeyEntry> = {
  entry: (keyID: string, options?: StoreEntryOptions): ExpoKeyEntry => {
    return new ExpoKeyEntry(keyID, options)
  },
}
