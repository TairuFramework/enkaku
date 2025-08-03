import type { ClientDefinitionsType, StreamCall } from '@enkaku/client'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  const [currentCall, setCurrentCall] = useState<StreamCall<Receive, Result> | null>(null)

  const createStream = useCallback(
    function createStream(
      ...args: Param extends never ? [] : [Param]
    ): StreamCall<Receive, Result> {
      const config = args[0] ? { param: args[0] } : {}
      // @ts-ignore config type
      const call = client.createStream(procedure, config) as StreamCall<Receive, Result>
      setCurrentCall(call)
      return call
    },
    [client, procedure],
  )

  return [createStream, currentCall] as const
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
      writerRef.current?.close()
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
      writerRef.current?.close()
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
