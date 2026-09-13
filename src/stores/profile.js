// 个人资料 store（M3 Task 4/6）：XP、本命牌生日、历史最佳连胜。持久化 tarot.profile.v1。
import { defineStore } from 'pinia'
import { safeGetItem, safeSetItem } from '../lib/storage.js'

const KEY = 'tarot.profile.v1'

function parseSaved() {
  const raw = safeGetItem(KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') {
      // 逐字段兜底（评审 2026-09-06）：xp 坏成字符串会让 addXp 走拼接（"10"+5="105"）
      if (typeof p.xp !== 'number') p.xp = 0
      if (typeof p.maxStreak !== 'number') p.maxStreak = 0
      if (typeof p.birthday !== 'string') p.birthday = ''
      return p
    }
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
