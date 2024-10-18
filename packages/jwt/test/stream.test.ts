import { type TransformStepSuccess, createPipeline } from '@enkaku/stream'

import { randomSigner } from '../src/principal.js'
import { createSignTokenStream, createVerifyTokenStream } from '../src/stream.js'
import {
  type Token,
  type UnsignedToken,
  createUnsignedToken,
  isVerifiedToken,
} from '../src/token.js'

test('sign and verify streams', async () => {
  const signer = await randomSigner()
  const pipeline = createPipeline<UnsignedToken, Token>({
    steps: [createSignTokenStream(signer), createVerifyTokenStream()],
    sink: (result, controller) => {
      if (result.ok) {
        controller.enqueue(result.value)
      }
    },
  })

  const writer = pipeline.writable.getWriter()
  await writer.write(createUnsignedToken({ test: 1 }))
  await writer.write(createUnsignedToken({ test: 2 }))
  await writer.close()

  const reader = pipeline.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    expect(isVerifiedToken(value)).toBe(true)
    expect(value.payload.iss).toBe(signer.did)
  }
})
