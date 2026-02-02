/**
 * Enkaku Electron keystore.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/electron-keystore
 * ```
 *
 * @module electron-keystore
 */

export { ElectronKeyEntry } from './entry.js'
export { provideFullIdentity, provideFullIdentityAsync } from './signer.js'
export { ElectronKeyStore } from './store.js'
