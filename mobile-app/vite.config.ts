import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiOrigin = env.VITE_API_ORIGIN || 'https://app.openbible.live'

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      // Use VITE_API_ORIGIN=http://127.0.0.1:3000 with a local test database.
      // Production remains the default when no override is configured.
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
          secure: apiOrigin.startsWith('https://'),
          cookieDomainRewrite: '',
        },
      },
    },
  }
})
