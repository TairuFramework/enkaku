/**
 * Ledger hardware wallet identity provider for Enkaku.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/ledger-identity
 * ```
 *
 * @module ledger-identity
 */

export {
  LedgerAppNotOpenError,
  LedgerDisconnectedError,
  LedgerError,
  LedgerUserRejectedError,
} from './errors.js'
export { createLedgerIdentityProvider, type LedgerIdentityProviderOptions } from './provider.js'
export type { LedgerTransport } from './types.js'
