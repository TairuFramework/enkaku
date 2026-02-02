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

export { CODECS, getAlgorithmAndPublicKey, getDID, getSignatureInfo } from './did.js'
export type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  OwnIdentity,
  SigningIdentity,
} from './identity.js'
export {
  createDecryptingIdentity,
  createFullIdentity,
  createSigningIdentity,
  isDecryptingIdentity,
  isFullIdentity,
  isSigningIdentity,
  randomIdentity,
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
  verifyToken,
} from './token.js'
export type * from './types.js'
export { stringifyToken } from './utils.js'
export {
  getVerifier,
  type Verifier,
  type Verifiers,
} from './verifier.js'
