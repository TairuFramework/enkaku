/**
 * Enkaku key store for desktop.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/desktop-keystore
 * ```
 *
 * @module desktop-keystore
 */

export { DesktopKeyEntry } from './entry.js'
export { provideTokenSigner, provideTokenSignerAsync } from './signer.js'
export { DesktopKeyStore } from './store.js'
