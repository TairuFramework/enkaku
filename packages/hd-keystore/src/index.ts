/**
 * HD keystore with SLIP-0010 Ed25519 derivation for Enkaku.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/hd-keystore
 * ```
 *
 * @module hd-keystore
 */

export { derivePrivateKey, resolveDerivationPath } from './derivation.js'
export { HDKeyEntry, type HDKeyEntryParams } from './entry.js'
export { HDKeyStore, type HDKeyStoreParams } from './store.js'
