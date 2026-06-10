import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite 配置:React 插件 + PWA 插件
// PWA 策略(见 DESIGN.md 4.4):只预缓存构建产物(App Shell),
// 不缓存任何业务数据请求——数据永远以 Supabase 服务端为准。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 有新版本时自动更新 service worker,无需用户手动刷新
      registerType: 'autoUpdate',
      // public/ 下需要一并预缓存的静态资源
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '双人小屋',
        short_name: '双人小屋',
        description: '只属于我们两个人的小屋',
        lang: 'zh-CN',
        theme_color: '#FB7185',
        background_color: '#FFF8F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA 路由回退:刷新 /ledger 等子路径时返回 index.html
        navigateFallback: '/index.html',
        // 不对跨域请求(Supabase API)做任何运行时缓存
        runtimeCaching: [],
      },
    }),
  ],
})
