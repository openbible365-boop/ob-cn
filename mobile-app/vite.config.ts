import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiOrigin = env.VITE_API_ORIGIN || 'https://app.openbible.live'

  return {
    plugins: [
      react(),
      {
        // 独立下载页 public/download/index.html：开发时让 /download 与线上 nginx 一样直达它，
        // 而不是被单页应用回退到 App 首页
        name: 'standalone-download-page',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/download' || req.url === '/download/' || req.url?.startsWith('/download?')) {
              req.url = '/download/index.html'
            }
            next()
          })
        },
      },
    ],
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
