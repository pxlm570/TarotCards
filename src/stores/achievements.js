// 成就框架（M2 Task 6）：unlocked 持久化 tarot.achievements.v1；
// justUnlocked 队列供 AchievementToast 弹出。unlock 幂等。
import { defineStore } from 'pinia'
import achievementsData from '../data/achievements.json'
import { safeGetItem, safeSetItem } from '../lib/storage.js'

const KEY = 'tarot.achievements.v1'

function parseSaved() {
  const raw = safeGetItem(KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && Array.isArray(p.unlocked)) return p
    return null
  } catch {
    return null
  }
}

export const useAchievementsStore = defineStore('achievements', {
  state: () => ({ unlocked: [], justUnlocked: [], ...(parseSaved() ?? {}) }),

  getters: {
    count: (s) => s.unlocked.length,
    total: () => achievementsData.length,
    defById: () => (id) => achievementsData.find((a) => a.id === id)
  },

  actions: {
    unlock(id) {
      if (this.unlocked.includes(id)) return false
      this.unlocked.push(id)
      const def = achievementsData.find((a) => a.id === id)
      if (def) this.justUnlocked.push(def)
      this._persist()
      return true
    },
    _pop() {
      return this.justUnlocked.shift() || null
    },
    _persist() {
      safeSetItem(KEY, JSON.stringify({ unlocked: this.unlocked }))
    }
  }
})
