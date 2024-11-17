export type KeyEntry<PrivateKeyType> = {
  readonly keyID: string
  getAsync(): Promise<PrivateKeyType | null>
  setAsync(privateKey: PrivateKeyType): Promise<void>
  provideAsync(): Promise<PrivateKeyType>
  removeAsync(): Promise<void>
}

export type KeyStore<
  PrivateKeyType,
  EntryType extends KeyEntry<PrivateKeyType> = KeyEntry<PrivateKeyType>,
> = {
  entry(keyID: string): EntryType
}
