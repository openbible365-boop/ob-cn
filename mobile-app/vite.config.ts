import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin /api in dev, mirroring the production nginx proxy to the
    // admin app (session cookie stays first-party).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
