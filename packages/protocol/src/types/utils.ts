export type Maybe<T> = T extends undefined ? never : T

export type ValueOf<T> = T[keyof T]

export type OptionalRecord = Record<string, unknown> | undefined
