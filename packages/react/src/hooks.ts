import type { RequestCall } from '@enkaku/client'
import { useCallback, useMemo, useState } from 'react'

import type { ReactClient } from './client.js'
import { useEnkakuClient } from './context.js'

export type ExecuteCall<Call extends RequestCall<unknown>, Param> = (
  ...args: Param extends never ? [] : [Param]
) => Call

export type ExecuteRequest<Procedure extends string, Call extends RequestCall<unknown>, Param> = (
  client: ReactClient,
  procedure: Procedure,
  ...args: Param extends never ? [] : [Param]
) => Call

export type LazyRequestHook<Procedure extends string, Call extends RequestCall<unknown>, Param> = (
  procedure: Procedure,
) => [ExecuteCall<Call, Param>, Call | null]

export function createLazyRequestHook<
  Procedure extends string,
  Call extends RequestCall<unknown>,
  Param,
>(execute: ExecuteRequest<Procedure, Call, Param>) {
  return function useLazyRequest(procedure: Procedure): [ExecuteCall<Call, Param>, Call | null] {
    const client = useEnkakuClient()
    const [currentCall, setCurrentCall] = useState<Call | null>(null)

    const sendRequest = useCallback(
      function sendRequest(...args: Param extends never ? [] : [Param]): Call {
        const call = execute(client, procedure, ...args)
        setCurrentCall(call)
        return call
      },
      [client, execute, procedure],
    )

    return [sendRequest, currentCall] as const
  }
}

const SUSPENSE_CONFIG = { cache: true }

export type SuspenseRequestHook<
  Procedure extends string,
  Call extends RequestCall<unknown>,
  Param,
> = (procedure: Procedure, ...args: Param extends never ? [] : [Param]) => Call

export function createSuspenseRequestHook<
  Procedure extends string,
  Call extends RequestCall<unknown>,
  Param,
>(execute: ExecuteRequest<Procedure, Call, Param>) {
  return function useSuspenseRequest(
    procedure: Procedure,
    ...args: Param extends never ? [] : [Param]
  ): Call {
    const client = useEnkakuClient()
    const config = useMemo(() => {
      return args[0] ? { cache: true, param: args[0] } : SUSPENSE_CONFIG
    }, [args[0]])
    return useMemo(() => {
      // @ts-ignore config type
      return execute(client, procedure, config)
    }, [client, config, execute, procedure])
  }
}
