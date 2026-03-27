import HDKey from 'micro-key-producer/slip10.js'

const DEFAULT_BASE_PATH = "44'/876'"
const INDEX_RE = /^\d+$/

export function resolveDerivationPath(keyID: string, basePath: string = DEFAULT_BASE_PATH): string {
  if (keyID.startsWith('m/')) {
    return keyID
  }
  if (INDEX_RE.test(keyID)) {
    return `m/${basePath}/${keyID}'`
  }
  throw new Error(`Invalid keyID: "${keyID}" — expected a numeric index or full derivation path`)
}

export function derivePrivateKey(seed: Uint8Array, path: string): Uint8Array {
  const root = HDKey.fromMasterSeed(seed)
  if (path === 'm') {
    return root.privateKey
  }
  return root.derive(path).privateKey
}
