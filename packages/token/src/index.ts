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
  getSigner,
  getTokenSigner,
  randomPrivateKey,
  randomSigner,
  randomTokenSigner,
  toTokenSigner,
} from './signer.js'
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
