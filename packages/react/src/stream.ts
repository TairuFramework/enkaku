import type { ClientDefinitionsType, StreamCall } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import type { ReferencedCall } from './client.js'
import { useEnkakuClient } from './context.js'

export type CreateStream<Param, Receive, Result> = (
  ...args: Param extends never ? [] : [Param]
) => StreamCall<Receive, Result>

export function useCreateStream<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Streams'] & string = keyof Definitions['Streams'] & string,
  Param = Definitions['Streams'][Procedure]['Param'],
  Receive = Definitions['Streams'][Procedure]['Receive'],
  Result = Definitions['Streams'][Procedure]['Result'],
>(
  procedure: Procedure,
): [CreateStream<Param, Receive, Result>, StreamCall<Receive, Result> | null] {
  const client = useEnkakuClient<Protocol>()
  const cacheID = useId()
  const activeCallRef = useRef<ReferencedCall<StreamCall<Receive, Result>> | null>(null)
  const [currentCall, setCurrentCall] = useState<ReferencedCall<
    StreamCall<Receive, Result>
  > | null>(null)

  const createStream = useCallback(
    function createStream(
      ...args: Param extends never ? [] : [Param]
    ): StreamCall<Receive, Result> {
      const config = args[0] ? { param: args[0] } : {}
      // @ts-expect-error config type
      const ref = client.createStream(procedure, { ...config, cacheID }) as ReferencedCall<
        StreamCall<Receive, Result>
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

  return [createStream, currentCall?.[0] ?? null] as const
}

export function useReceiveLatest<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Streams'] & string = keyof Definitions['Streams'] & string,
  Receive = Definitions['Streams'][Procedure]['Receive'],
  Result = Definitions['Streams'][Procedure]['Result'],
>(call: StreamCall<Receive, Result> | null): Receive | null {
  const callRef = useRef(call)
  const writerRef = useRef<WritableStream<Receive> | null>(null)
  const [latest, setLatest] = useState<Receive | null>(null)

  useEffect(() => {
    if (callRef.current !== call) {
      callRef.current = call
      setLatest(null)
      // Just set the ref to null instead of trying to close
      writerRef.current = null
      if (call != null) {
        writerRef.current = new WritableStream({ write: setLatest })
        call.readable.pipeTo(writerRef.current)
      }
    }
  }, [call])

  return latest
}

export function useReceiveAll<
  Protocol extends ProtocolDefinition,
  Definitions extends ClientDefinitionsType<Protocol> = ClientDefinitionsType<Protocol>,
  Procedure extends keyof Definitions['Streams'] & string = keyof Definitions['Streams'] & string,
  Receive = Definitions['Streams'][Procedure]['Receive'],
  Result = Definitions['Streams'][Procedure]['Result'],
>(call: StreamCall<Receive, Result> | null): [Array<Receive>, boolean, Promise<void> | null] {
  const callRef = useRef(call)
  const writerRef = useRef<WritableStream<Receive> | null>(null)
  const [values, setValues] = useState<Array<Receive>>([])
  const [done, setDone] = useState(false)
  const [donePromise, setDonePromise] = useState<Promise<void> | null>(null)

  useEffect(() => {
    if (callRef.current !== call) {
      callRef.current = call
      setDone(false)
      setValues([])
      // Just set the ref to null instead of trying to close
      writerRef.current = null
      if (call == null) {
        setDonePromise(null)
      } else {
        writerRef.current = new WritableStream({
          write: (value) => {
            setValues((values) => [...values, value])
          },
        })
        const promise = call.readable.pipeTo(writerRef.current)
        promise.then(() => {
          setDone(true)
        })
        setDonePromise(promise)
      }
    }
  }, [call])

  return [values, done, donePromise] as const
}
