import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // 向上级目录查找 .env 文件
  envDir: '../',
  // 允许的前缀，确保引入 GOOGLE_CLIENT_ID
  envPrefix: ['VITE_', 'GOOGLE_'],
  // Only use /admin/ base path in production for Vercel routing
  base: mode === 'production' ? '/admin/' : '/',
}))
