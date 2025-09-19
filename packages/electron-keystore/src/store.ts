import type { KeyStore } from '@enkaku/protocol'
import Store from 'electron-store'

import { ElectronKeyEntry } from './entry.js'
import type { KeyStorage } from './types.js'

type StoreValues = { keys: Record<string, string> }

export class ElectronKeyStore implements KeyStore<string, ElectronKeyEntry> {
  static #byName: Record<string, ElectronKeyStore> = {}

  static open(name = 'keystore'): ElectronKeyStore {
    if (ElectronKeyStore.#byName[name] == null) {
      ElectronKeyStore.#byName[name] = new ElectronKeyStore(name)
    }
    return ElectronKeyStore.#byName[name]
  }

  #entries: Record<string, ElectronKeyEntry> = {}
  #storage: KeyStorage

  constructor(name: string) {
    const store = new Store<StoreValues>({
      name,
      schema: {
        keys: {
          type: 'object',
          properties: {
            key: { type: 'string' },
          },
        },
      },
      defaults: {
        keys: {},
      },
    })
    this.#storage = {
      getKeys: () => store.get('keys', {}),
      setKeys: (keys) => store.set('keys', keys),
    }
  }

  entry(keyID: string): ElectronKeyEntry {
    this.#entries[keyID] ??= new ElectronKeyEntry(this.#storage, keyID)
    return this.#entries[keyID]
  }
}
