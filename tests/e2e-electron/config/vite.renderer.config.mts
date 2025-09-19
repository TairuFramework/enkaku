import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  define: {
    DEV: process.env.NODE_ENV === 'development' ? 'true' : 'false',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: [
        '.web.js',
        '.web.jsx',
        '.web.ts',
        '.web.tsx',
        '.mjs',
        '.js',
        '.mts',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
      ],
      loader: {
        '.js': 'jsx',
      },
    },
  },
  resolve: {
    alias: {
      'react-native': 'react-native-electron',
    },
  },
})
