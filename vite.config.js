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
        theme_color: '#14162E',
        background_color: '#14162E',
        display: 'standalone',
        icons: [
          { src: 'manifest-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'manifest-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'manifest-icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,jpg,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  // threads+isolate:false：forks 池在本机高负载下 worker 启动超时；复用单 worker 保证任何负载下可跑，
  // 且省去每文件 ~35s 的 jsdom 环境重复启动。测试自身用 beforeEach 清理共享状态（localStorage 等）。
  test: { environment: 'jsdom', pool: 'threads', isolate: false }
})
