/**
 * What the hub sees for each routed message.
 * The payload is encrypted and opaque to the hub.
 */
export type RoutedMessage = {
  senderDID: string
  groupID: string
  epoch: number
  contentType: 'commit' | 'proposal' | 'welcome' | 'application'
  /** Base64-encoded encrypted payload */
  payload: string
}

/**
 * Storage contract for hub persistence.
 * Implementations are external (e.g., in-memory, Kubun-backed).
 *
 * Note: `dequeue` and `fetchKeyPackages` are destructive — they consume
 * and remove the returned items from storage. This matches MLS semantics
 * where key packages are single-use and queued messages are delivered once.
 */
export type HubStore = {
  enqueue(recipientDID: string, message: RoutedMessage): Promise<void>
  /** Dequeue and remove up to `limit` messages for the recipient. */
  dequeue(recipientDID: string, limit?: number): Promise<Array<RoutedMessage>>
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  /** Fetch and consume up to `count` key packages (single-use). */
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
  setGroupMembers(groupID: string, members: Array<string>): Promise<void>
  getGroupMembers(groupID: string): Promise<Array<string>>
}
