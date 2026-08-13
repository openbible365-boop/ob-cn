import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

// 强制使用配置好的 Client ID，防止由于 Vite 环境变量未正确加载导致向 Google 发送空的客户端请求报错
const clientId = import.meta.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '307380593339-lkskv3k92uc2qamj0gebkkfkmfjce045.apps.googleusercontent.com';
console.log("Current Google Client ID being used:", clientId);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
