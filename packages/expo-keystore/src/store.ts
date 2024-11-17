import type { KeyStore } from '@enkaku/protocol'

import { ExpoKeyEntry } from './entry.js'

export const ExpoKeyStore: KeyStore<Uint8Array, ExpoKeyEntry> = {
  entry: (keyID: string): ExpoKeyEntry => {
    return new ExpoKeyEntry(keyID)
  },
}
