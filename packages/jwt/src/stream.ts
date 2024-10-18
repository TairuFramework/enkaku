import { type TransformStepStream, createTransformStep } from '@enkaku/stream'

import { type Signer, getSigner } from './principal.js'
import { type SignedToken, type Token, signToken, verifyToken } from './token.js'

export type SignerInput = Signer | Promise<Signer> | Uint8Array | string

export function createSignTokenStream<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(signerInput: SignerInput): TransformStepStream<Token<Payload>, SignedToken<Payload>> {
  const signerPromise =
    typeof signerInput === 'string' || signerInput instanceof Uint8Array
      ? getSigner(signerInput)
      : signerInput

  return createTransformStep(async (token) => {
    const signer = await signerPromise
    return await signToken(signer, token)
  })
}

export function createVerifyTokenStream<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(): TransformStepStream<Token<Payload>> {
  return createTransformStep(verifyToken)
}
