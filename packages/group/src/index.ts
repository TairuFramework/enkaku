export { createDIDAuthenticationService } from './authentication.js'
export {
  createGroupCapability,
  type DelegateGroupMembershipParams,
  delegateGroupMembership,
  type GroupPermission,
  type ValidateGroupCapabilityParams,
  validateGroupCapability,
} from './capability.js'
export { type ClientState, decodeClientState, encodeClientState } from './codec.js'
export {
  credentialToMLSIdentity,
  extractPermission,
  type MemberCredential,
  mlsIdentityToSerializedCredential,
  type SerializedCredential,
} from './credential.js'
export {
  createNobleCryptoProvider,
  type NobleCryptoProviderOptions,
  nobleCryptoProvider,
} from './crypto.js'
export {
  type CommitInviteResult,
  type CreateGroupResult,
  type CreateInviteParams,
  type CreateInviteResult,
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  GroupHandle,
  type GroupHandleParams,
  type ProcessWelcomeParams,
  type ProcessWelcomeResult,
  processWelcome,
  type RemoveMemberResult,
  type RestoreGroupParams,
  removeMember,
  restoreGroup,
} from './group.js'
export type { GroupOptions, GroupSyncScope, Invite, KeyPackageBundle } from './types.js'
