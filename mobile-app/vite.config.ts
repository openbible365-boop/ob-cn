import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const sharedDataRoot = fileURLToPath(new URL('../data', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-shared-bible-data',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          let pathname = ''
          try {
            pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
          } catch {
            next()
            return
          }

          if (!pathname.startsWith('/data/')) {
            next()
            return
          }

          const filePath = resolve(sharedDataRoot, pathname.slice('/data/'.length))
          if (!filePath.startsWith(`${sharedDataRoot}${sep}`)) {
            response.statusCode = 403
            response.end()
            return
          }

          try {
            if (!statSync(filePath).isFile()) {
              next()
              return
            }
          } catch {
            next()
            return
          }

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          createReadStream(filePath).pipe(response)
        })
      },
    },
  ],
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
