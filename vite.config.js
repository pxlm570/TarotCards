import { defineConfig } from 'vitest/config' // 兼容 test 字段；构建行为与 vite 的 defineConfig 一致
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/TarotCards/', // GitHub Pages 路径 = 仓库名；仓库改名或用自定义域名时同步修改（自定义域名用 '/'）
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        lang: 'zh-CN',
        name: '星语塔罗',
        short_name: '星语塔罗',
        description: '私人塔罗空间：占卜、学习、记录',
        // M1.5 定稿双主题：manifest 不支持媒体查询，取默认基准（浅色 --bg）
        theme_color: '#FAF6ED',
        background_color: '#FAF6ED',
        display: 'standalone',
        icons: [
          { src: 'manifest-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'manifest-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'manifest-icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // 牌面/牌背图不进预缓存（150+ 张 webp 会让首访/每次发版全量拉 20MB）：
        // 改为运行时缓存（CacheFirst，30 天）。已浏览过的离线可见，未浏览允许缺图。
        globPatterns: ['**/*.{js,css,html,svg,jpg,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/decks\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'deck-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/backs\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'back-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  // threads+isolate:false：forks 池在本机高负载下 worker 启动超时；复用单 worker 保证任何负载下可跑，
  // 且省去每文件 ~35s 的 jsdom 环境重复启动。测试自身用 beforeEach 清理共享状态（localStorage 等）。
  test: { environment: 'jsdom', pool: 'threads', isolate: false }
})
