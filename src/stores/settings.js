// AI 配置 store（M4 Task 1）：包装 storage.js 的 settings，提供响应式状态。
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
