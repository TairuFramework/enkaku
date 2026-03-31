import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import {
  CODECS,
  type FullIdentity,
  getDID,
  type IdentityProvider,
  type SignedHeader,
  type SignedToken,
} from '@enkaku/token'

import {
  CLA,
  encodeDerivationPath,
  encodeSignMessageChunks,
  INS,
  parsePublicKeyResponse,
  parseSharedSecretResponse,
  parseSignatureResponse,
} from './apdu.js'
import { LedgerDisconnectedError } from './errors.js'
import type { LedgerTransport } from './types.js'

const DEFAULT_BASE_PATH = "44'/876'"
const tracer = createTracer('ledger-identity')
const logger = getEnkakuLogger('ledger-identity')

const INDEX_RE = /^\d+$/

function resolveKeyID(keyID: string, basePath: string): string {
  if (keyID.startsWith('m/')) return keyID
  if (INDEX_RE.test(keyID)) return `m/${basePath}/${keyID}'`
  throw new Error(`Invalid keyID: "${keyID}"`)
}

async function sendAPDU(
  transport: LedgerTransport,
  ins: number,
  p1: number,
  p2: number,
  data?: Uint8Array,
): Promise<Uint8Array> {
  try {
    return await transport.send(CLA, ins, p1, p2, data)
  } catch (error) {
    if (error instanceof Error && error.name === 'DisconnectedDevice') {
      throw new LedgerDisconnectedError(error)
    }
    throw error
  }
}

export type LedgerIdentityProviderOptions = {
  basePath?: string
}

export function createLedgerIdentityProvider(
  transport: LedgerTransport,
  options?: LedgerIdentityProviderOptions,
): IdentityProvider<FullIdentity> {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH
  const cache = new Map<string, FullIdentity>()

  async function provideIdentity(keyID: string): Promise<FullIdentity> {
    const path = resolveKeyID(keyID, basePath)
    const cached = cache.get(path)
    if (cached != null) return cached

    return withSpan(
      tracer,
      SpanNames.KEYSTORE_GET_OR_CREATE,
      { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'ledger' } },
      async (span) => {
        const pathBytes = encodeDerivationPath(path)
        const rawKey = await sendAPDU(transport, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
        const publicKey = parsePublicKeyResponse(rawKey)
        const id = getDID(CODECS.EdDSA, publicKey)

        span.setAttribute(AttributeKeys.AUTH_DID, id)
        logger.info('Ledger identity resolved: {did}', { did: id })

        async function signToken<
          Payload extends Record<string, unknown> = Record<string, unknown>,
          Header extends Record<string, unknown> = Record<string, unknown>,
        >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
          return withSpan(
            tracer,
            SpanNames.TOKEN_SIGN,
            {
              attributes: {
                [AttributeKeys.AUTH_DID]: id,
                [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA',
              },
            },
            async () => {
              if (payload.iss != null && payload.iss !== id) {
                throw new Error('Invalid payload: issuer does not match signer')
              }

              const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
              const fullPayload = { ...payload, iss: id }
              const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

              const messageBytes = fromUTF(data)
              const chunks = encodeSignMessageChunks(pathBytes, messageBytes)

              let signatureBytes: Uint8Array = new Uint8Array(0)
              for (const chunk of chunks) {
                signatureBytes = await sendAPDU(
                  transport,
                  INS.SIGN_MESSAGE,
                  chunk.p1,
                  chunk.p2,
                  chunk.data,
                )
              }

              return {
                header: fullHeader,
                payload: fullPayload,
                signature: toB64U(parseSignatureResponse(signatureBytes)),
                data,
              }
            },
          )
        }

        async function agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array> {
          const data = new Uint8Array(pathBytes.length + ephemeralPublicKey.length)
          data.set(pathBytes)
          data.set(ephemeralPublicKey, pathBytes.length)
          const response = await sendAPDU(transport, INS.ECDH_X25519, 0x00, 0x00, data)
          return parseSharedSecretResponse(response)
        }

        async function decrypt(jwe: string): Promise<Uint8Array> {
          const { decryptToken } = await import('@enkaku/token')
          return decryptToken({ id, decrypt, agreeKey }, jwe)
        }

        const identity: FullIdentity = { id, publicKey, signToken, agreeKey, decrypt }
        cache.set(path, identity)
        return identity
      },
    )
  }

  return { provideIdentity }
}
