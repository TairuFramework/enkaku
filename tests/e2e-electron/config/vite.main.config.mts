import { copyFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { napiBindingPath } from '@kokuin/crypto-napi'
import { defineConfig, type Plugin } from 'vite'

// Bundled, the binding resolves `../native` from `.vite/build/main.cjs`. Forge packages only
// `.vite`, so the binary must land there. A missing binary fails the build, not the fallback.
const copyCryptoNapiBinary: Plugin = {
  name: 'copy-crypto-napi-binary',
  writeBundle({ dir }) {
    if (dir == null) throw new Error('Expected a build output directory')
    const source = napiBindingPath()
    const targetDir = join(dir, '..', 'native')
    mkdirSync(targetDir, { recursive: true })
    copyFileSync(source, join(targetDir, basename(source)))
  },
}

// https://vitejs.dev/config
export default defineConfig({
  // The main build is CJS, where `import.meta.url` is otherwise undefined: no binary would load.
  define: { 'import.meta.url': "require('node:url').pathToFileURL(__filename).href" },
  plugins: [copyCryptoNapiBinary],
})
