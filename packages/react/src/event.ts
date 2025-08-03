import type { ClientDefinitionsType } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { useCallback } from 'react'

import { useEnkakuClient } from './context.js'

export type SendEvent<Data> = (...data: Data extends never ? [] : [Data]) => Promise<void>

export function useSendEvent<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Events'] & string = keyof Definitions['Events'] & string,
  Data = Definitions['Events'][Procedure]['Data'],
>(procedure: Procedure): SendEvent<Data> {
  const client = useEnkakuClient<Protocol>()

  return useCallback(
    async function sendEvent(...data: Data extends never ? [] : [Data]): Promise<void> {
      // @ts-ignore data type
      await client.sendEvent(procedure, ...data)
    },
    [client, procedure],
  )
}
