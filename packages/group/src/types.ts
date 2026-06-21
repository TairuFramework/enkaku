import type { DIDCache, DIDResolver } from '@kokuin/token'
import type {
  Capabilities,
  CryptoProvider,
  GroupContextExtension,
  IncomingMessageCallback,
  KeyPackage,
  PrivateKeyPackage,
} from 'ts-mls'

import type { GroupPermission } from './capability.js'

export type GroupOptions = {
  /** Custom CryptoProvider for ts-mls. Defaults to nobleCryptoProvider. */
  cryptoProvider?: CryptoProvider
  /** Ciphersuite name. Defaults to MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519. */
  ciphersuiteName?: string
  /** Group extensions. */
  extensions?: Array<GroupContextExtension>
  /**
   * Raw ts-mls leaf-node capabilities. At createGroup, overrides the
   * auto-derived capabilities; at createKeyPackageBundle, sets the invitee
   * leaf's capabilities (default: defaultCapabilities()).
   */
  capabilities?: Capabilities
  /**
   * Default commit policy for the resulting GroupHandle. Invoked during
   * processMessage/decrypt for each incoming commit; return 'reject' to refuse
   * a commit (the handle stays at its pre-commit epoch and processMessage
   * throws CommitRejectedError). Overridable per call.
   */
  commitPolicy?: IncomingMessageCallback
  /** Optional DID cache for resolving did:peer:4 issuers in capability chains. Default: in-memory. */
  cache?: DIDCache
  /** Optional resolver for did:peer:4 short forms not in cache. */
  resolver?: DIDResolver
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
  inviterID: string
}

export type KeyPackageBundle = {
  /** MLS key package (binary) */
  publicPackage: KeyPackage
  /** Private key material (keep secret) */
  privatePackage: PrivateKeyPackage
  /** The DID of the key package owner */
  ownerDID: string
}
