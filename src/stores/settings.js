// AI 配置 store（M4 Task 1）：包装 storage.js 的 settings，提供响应式状态。
// 单写入口约定（评审 2026-09-06）：凡是 store 状态有响应式消费者的字段（hasAI/persona）
// 必须经 update() 写入；lib 层自管字段（theme/use-deck 的 deckId、backId）无响应式消费者，
// 由各自模块直写 saveSettings——新代码请勿从本 store 读那些字段（会读到陈旧值）。
import { defineStore } from 'pinia'
import { loadSettings, saveSettings } from '../lib/storage.js'

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...loadSettings() }),
  getters: {
    hasAI: (s) => !!s.baseUrl && !!s.apiKey && !!s.model
  },
  actions: {
    update(patch) {
      const next = saveSettings(patch)
      Object.assign(this, next)
      return next
    }
  }
})
