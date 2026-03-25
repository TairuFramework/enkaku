import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  define: {
    DEV: process.env.NODE_ENV === 'development' ? 'true' : 'false',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  optimizeDeps: {
    rolldownOptions: {
      resolve: {
        extensions: [
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
      },
    },
  },
  resolve: {
    alias: {
      'react-native': 'react-native-electron',
    },
  },
})
