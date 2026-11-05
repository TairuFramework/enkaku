import { cpSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'

const require = createRequire(import.meta.url)

// https://vitejs.dev/config
export default defineConfig({
  // The main build is CJS, where Vite leaves import.meta.url undefined.
  define: { 'import.meta.url': "require('node:url').pathToFileURL(__filename).href" },
  plugins: [
    {
      name: 'copy-crypto-napi-binary',
      // Bundling moves @kokuin/crypto-napi into .vite/build, so it looks for its binary in
      // .vite/native rather than in its package.
      writeBundle(options) {
        const source = join(dirname(require.resolve('@kokuin/crypto-napi')), '..', 'native')
        if (options.dir != null && existsSync(source)) {
          cpSync(source, join(options.dir, '..', 'native'), { recursive: true })
        }
      },
    },
  ],
})
