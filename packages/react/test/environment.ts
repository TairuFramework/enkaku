import { ReadableStream, WritableStream } from 'node:stream/web'
import { TextDecoder, TextEncoder } from 'node:util'
import Environment from 'jest-environment-jsdom'

export default class TestEnvironment extends Environment {
  async setup() {
    await super.setup()
    // @ts-ignore different ReadableStream types in DOM and Node
    this.global.ReadableStream = ReadableStream
    // @ts-ignore different WritableStream types in DOM and Node
    this.global.WritableStream = WritableStream
    // @ts-ignore different TextDecoder types in DOM and Node
    this.global.TextDecoder = TextDecoder
    this.global.TextEncoder = TextEncoder
  }
}
