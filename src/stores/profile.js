// 个人资料 store（M3 Task 4/6）：XP、本命牌生日、历史最佳连胜。持久化 tarot.profile.v1。
import { defineStore } from 'pinia'
import { safeGetItem, safeSetItem } from '../lib/storage.js'

const KEY = 'tarot.profile.v1'

function parseSaved() {
  const raw = safeGetItem(KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') return p
    return null
  } catch {
    return null
  }
}

export const useProfileStore = defineStore('profile', {
  state: () => ({ xp: 0, birthday: '', maxStreak: 0, ...(parseSaved() ?? {}) }),

  actions: {
    addXp(n) {
      this.xp = Math.max(0, this.xp + n)
      this._persist()
      return this.xp
    },
    setBirthday(birthday) {
      this.birthday = birthday
      this._persist()
    },
    updateMaxStreak(v) {
      if (v > this.maxStreak) {
        this.maxStreak = v
        this._persist()
      }
    },
    _persist() {
      safeSetItem(KEY, JSON.stringify({ xp: this.xp, birthday: this.birthday, maxStreak: this.maxStreak }))
    }
  }
})
