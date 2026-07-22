import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local browser development and packaged mobile apps always use the
    // production API. Do not point mobile clients at a local admin server.
    proxy: {
      '/api': {
        target: 'https://app.openbible.live',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
      },
    },
  },
})
