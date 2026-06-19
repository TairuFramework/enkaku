import { Disposer } from '@enkaku/async'
import type { TransportType } from '@enkaku/transport'

import type { BroadcastMessage } from './transport.js'

export type RequestData = { kind: 'req'; rid: string; prm: unknown }
export type ReplyData = { kind: 'res'; rid: string; from: string; ok?: unknown; err?: string }

export type RequestOptions = { errorThreshold?: number; timeoutMs?: number }
export type GatherOptions = { quorum?: number; timeoutMs?: number }
export type GatheredReply = { from: string; value: unknown }

export type BroadcastClientParams = {
  transport: TransportType<BroadcastMessage, BroadcastMessage>
  getRandomID?: () => string
}

const DEFAULT_TIMEOUT_MS = 5000

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

type Collector = (reply: ReplyData) => void

export class BroadcastClient extends Disposer {
  #transport: TransportType<BroadcastMessage, BroadcastMessage>
  #getRandomID: () => string
  #pending: Map<string, Collector> = new Map()

  constructor(params: BroadcastClientParams) {
    super({
      dispose: async (reason?: unknown) => {
        await this.#transport.dispose(reason)
      },
    })
    this.#transport = params.transport
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#read()
  }

  async #read(): Promise<void> {
    for await (const msg of this.#transport) {
      const payload = msg?.payload
      if (payload?.typ !== 'event') {
        continue
      }
      const data = payload.data as Partial<ReplyData> | undefined
      if (data?.kind === 'res' && typeof data.rid === 'string') {
        this.#pending.get(data.rid)?.(data as ReplyData)
      }
    }
  }

  async dispatch(prc: string, data: Record<string, unknown> = {}): Promise<void> {
    await this.#transport.write({ payload: { typ: 'event', prc, data } })
  }

  async request(prc: string, prm: unknown = {}, options: RequestOptions = {}): Promise<unknown> {
    const rid = this.#getRandomID()
    const errorThreshold = options.errorThreshold ?? Number.POSITIVE_INFINITY
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return new Promise<unknown>((resolve, reject) => {
      let errorCount = 0
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Broadcast request "${prc}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.#pending.delete(rid)
      }
      this.#pending.set(rid, (reply) => {
        if (reply.err != null) {
          errorCount += 1
          if (errorCount >= errorThreshold) {
            cleanup()
            reject(new Error(`Broadcast request "${prc}" failed after ${errorCount} errors`))
          }
          return
        }
        cleanup()
        resolve(reply.ok)
      })
      this.#transport
        .write({ payload: { typ: 'event', prc, data: { kind: 'req', rid, prm } } })
        .catch((error) => {
          cleanup()
          reject(error)
        })
    })
  }

  async gather(
    prc: string,
    prm: unknown = {},
    options: GatherOptions = {},
  ): Promise<Array<GatheredReply>> {
    const rid = this.#getRandomID()
    const quorum = options.quorum ?? Number.POSITIVE_INFINITY
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return new Promise<Array<GatheredReply>>((resolve) => {
      const replies: Array<GatheredReply> = []
      const seen = new Set<string>()
      const finish = () => {
        clearTimeout(timer)
        this.#pending.delete(rid)
        resolve(replies)
      }
      const timer = setTimeout(finish, timeoutMs)
      this.#pending.set(rid, (reply) => {
        if (reply.err != null || seen.has(reply.from)) {
          return
        }
        seen.add(reply.from)
        replies.push({ from: reply.from, value: reply.ok })
        if (replies.length >= quorum) {
          finish()
        }
      })
      this.#transport
        .write({ payload: { typ: 'event', prc, data: { kind: 'req', rid, prm } } })
        .catch(() => finish())
    })
  }
}
