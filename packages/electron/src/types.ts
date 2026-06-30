export type MessageFunc<T> = (message: T) => void

export type CreateProcess = <R, W>(name: string, onMessage: MessageFunc<R>) => MessageFunc<W>
