import type { ClientDefinitionsType, RequestCall } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { use, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import type { ReferencedCall } from './client.js'
import { useEnkakuClient } from './context.js'

export type SendRequest<Param, Result> = (
  ...args: Param extends never ? [] : [Param]
) => RequestCall<Result>

export function useSendRequest<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Requests'] & string = keyof Definitions['Requests'] & string,
  Param = Definitions['Requests'][Procedure]['Param'],
  Result = Definitions['Requests'][Procedure]['Result'],
>(procedure: Procedure): [SendRequest<Param, Result>, RequestCall<Result> | null] {
  const client = useEnkakuClient<Protocol>()
  const cacheID = useId()
  const activeCallRef = useRef<ReferencedCall<RequestCall<Result>> | null>(null)
  const [currentCall, setCurrentCall] = useState<ReferencedCall<RequestCall<Result>> | null>(null)

  const sendRequest = useCallback(
    function sendRequest(...args: Param extends never ? [] : [Param]): RequestCall<Result> {
      const config = args[0] ? { param: args[0] } : {}
      // @ts-expect-error config type
      const ref = client.request(procedure, { ...config, cacheID }) as ReferencedCall<
        RequestCall<Result>
      >
      const call = ref[0]
      activeCallRef.current = ref
      call
        .catch(() => {
          // Suppress the error to avoid uncaught exception
        })
        .finally(() => {
          if (activeCallRef.current === ref) {
            activeCallRef.current = null
          }
        })
      setCurrentCall(ref)
      return call
    },
    [cacheID, client, procedure],
  )

  useEffect(() => {
    return () => {
      activeCallRef.current?.[1]()
    }
  }, [])

  return [sendRequest, currentCall?.[0] ?? null] as const
}

const SUSPENSE_CONFIG = { cache: true }

export function useRequest<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Requests'] & string = keyof Definitions['Requests'] & string,
  Param = Definitions['Requests'][Procedure]['Param'],
  Result = Definitions['Requests'][Procedure]['Result'],
>(procedure: Procedure, ...args: Param extends never ? [] : [Param]): RequestCall<Result> {
  const client = useEnkakuClient<Protocol>()
  const cacheID = useId()
  const activeCallRef = useRef<ReferencedCall<RequestCall<Result>> | null>(null)

  const config = useMemo(() => {
    return args[0] ? { cache: true, param: args[0] } : SUSPENSE_CONFIG
  }, [args[0]])
  const call = useMemo(() => {
    // @ts-expect-error config type
    const ref = client.request(procedure, { ...config, cacheID }) as ReferencedCall<
      RequestCall<Result>
    >
    activeCallRef.current = ref
    const call = ref[0]
    call
      .catch(() => {
        // Suppress the error to avoid uncaught exception
      })
      .finally(() => {
        if (activeCallRef.current === ref) {
          activeCallRef.current = null
        }
      })
    return call
  }, [cacheID, client, config, procedure])

  useEffect(() => {
    return () => {
      activeCallRef.current?.[1]()
    }
  }, [])

  return call
}

export function useRequestResult<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Requests'] & string = keyof Definitions['Requests'] & string,
  Param = Definitions['Requests'][Procedure]['Param'],
  Result = Definitions['Requests'][Procedure]['Result'],
>(procedure: Procedure, ...args: Param extends never ? [] : [Param]): Result {
  const call = useRequest<Protocol, Definitions, Procedure, Param, Result>(procedure, ...args)
  return use(call)
}
