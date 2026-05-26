/**
 * JWT signing and verification for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/token
 * ```
 *
 * @module token
 */

export {
  createInMemoryDIDCache,
  type DIDCache,
  type DIDResolver,
} from './cache.js'
export {
  CODECS,
  getAlgorithmAndPublicKey,
  getDID,
  getSignatureInfo,
  normalizeDID,
  type ResolveIssuerHeader,
  resolveIssuer,
} from './did.js'
export {
  type CreateIdentityInput,
  createDecryptingIdentity,
  createFullIdentity,
  createIdentity,
  createSigningIdentity,
  type DecryptingIdentity,
  type FullIdentity,
  type Identity,
  type IdentityKeySpec,
  type IdentityProvider,
  isDecryptingIdentity,
  isFullIdentity,
  isOwnIdentity,
  isSigningIdentity,
  type KeyAlg,
  type KeyPurpose,
  type MultiKeyIdentity,
  type OwnIdentity,
  type ResolvedKey,
  randomIdentity,
  type SigningIdentity,
  type SignOptions,
} from './identity.js'
export type {
  ConcatKDFParams,
  EncryptOptions,
  EnvelopeMode,
  JWEHeader,
  TokenEncrypter,
  UnwrapOptions,
  UnwrappedEnvelope,
  WrapOptions,
} from './jwe.js'
export {
  concatKDF,
  createTokenEncrypter,
  decryptToken,
  encryptToken,
  unwrapEnvelope,
  wrapEnvelope,
} from './jwe.js'
export {
  decodeMultibase,
  encodeMultibase,
  multihashSHA256,
  verifyMultihash,
} from './multibase.js'
export {
  type DecodePeer4Options,
  type DIDDoc,
  decodePeer4,
  encodePeer4,
  getPeer4ShortForm,
  isPeer4,
  type VerificationMethod,
  validateDIDDoc,
} from './peer4.js'
export {
  createRotationAssertion,
  type RotationPayload,
} from './rotation.js'
export {
  capabilitySchema,
  type SignatureAlgorithm,
  type SignedHeader,
  type SignedPayload,
  type SupportedHeader,
  signedHeaderSchema,
  signedPayloadSchema,
  supportedHeaderSchema,
  type UnsignedHeader,
  unsignedHeaderSchema,
  validateAlgorithm,
  validateSignedHeader,
  validateSignedPayload,
  validateUnsignedHeader,
} from './schemas.js'
export {
  decodePrivateKey,
  encodePrivateKey,
  randomPrivateKey,
} from './signer.js'
export {
  assertTimeClaimsValid,
  now,
  type TimeClaimsPayload,
  type TimeValidationOptions,
} from './time.js'
export {
  createUnsignedToken,
  isSignedToken,
  isUnsignedToken,
  isVerifiedToken,
  signToken,
  type VerifyTokenOptions,
  verifyToken,
} from './token.js'
export type * from './types.js'
export { stringifyToken } from './utils.js'
export {
  getVerifier,
  type Verifier,
  type Verifiers,
} from './verifier.js'
