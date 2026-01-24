import type { ClientDefinitionsType } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { useCallback } from 'react'

import { useEnkakuClient } from './context.js'

export type SendEvent<Data> = (
  ...args: Data extends never ? [config?: { data?: never }] : [config: { data: Data }]
) => Promise<void>

export function useSendEvent<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Events'] & string = keyof Definitions['Events'] & string,
  Data = Definitions['Events'][Procedure]['Data'],
>(procedure: Procedure): SendEvent<Data> {
  const client = useEnkakuClient<Protocol>()

  return useCallback(
    async function sendEvent(
      ...args: Data extends never ? [config?: { data?: never }] : [config: { data: Data }]
    ): Promise<void> {
      // @ts-expect-error data type
      await client.sendEvent(procedure, ...args)
    },
    [client, procedure],
  )
}
