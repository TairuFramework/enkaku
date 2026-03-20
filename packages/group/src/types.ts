import type { CryptoProvider } from 'ts-mls'

import type { GroupPermission } from './capability.js'

export type GroupOptions = {
  /** Custom CryptoProvider for ts-mls. Defaults to nobleCryptoProvider. */
  cryptoProvider?: CryptoProvider
  /** Ciphersuite name. Defaults to MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519. */
  ciphersuiteName?: string
  /** Group extensions. */
  extensions?: Array<unknown>
}

export type GroupSyncScope = {
  groupID: string
  models: Array<{ modelID: string; filter?: Record<string, unknown> }>
}

export type Invite = {
  /** Group ID the invite is for */
  groupID: string
  /** Delegated membership capability token (stringified) for the invitee */
  capabilityToken: string
  /** The full capability chain to validate the invite */
  capabilityChain: Array<string>
  /** Permission level being granted */
  permission: GroupPermission
  /** Inviter's DID */
  inviterDID: string
}

export type KeyPackageBundle = {
  /** MLS key package (binary) */
  publicPackage: unknown
  /** Private key material (keep secret) */
  privatePackage: unknown
  /** The DID of the key package owner */
  ownerDID: string
}
