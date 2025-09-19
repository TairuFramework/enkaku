export type KeyStorage = {
  getKeys: () => Record<string, string>
  setKeys: (keys: Record<string, string>) => void
}
