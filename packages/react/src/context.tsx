import type { Client } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { createContext, type ReactNode, use, useMemo } from 'react'

import { ReactClient } from './client.js'

export const EnkakuContext = createContext<ReactClient | null>(null)

export type EnkakuProviderProps = {
  client: Client<ProtocolDefinition>
  children: ReactNode
}

export function EnkakuProvider({ client, children }: EnkakuProviderProps) {
  const value = useMemo(() => new ReactClient({ client }), [client])
  return <EnkakuContext.Provider value={value}>{children}</EnkakuContext.Provider>
}

export function useEnkakuClient<P extends ProtocolDefinition>(): ReactClient<P> {
  const client = use(EnkakuContext) as ReactClient<P> | null
  if (client == null) {
    throw new Error('useEnkakuClient must be used within an EnkakuProvider')
  }
  return client
}
