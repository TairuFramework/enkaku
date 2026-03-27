export type LedgerTransport = {
  send(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array): Promise<Uint8Array>
}
