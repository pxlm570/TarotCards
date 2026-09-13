// 占卜记录 store（M3 Task 1）：包装 journal-store 提供响应式状态。
import { defineStore } from 'pinia'
import * as journal from '../lib/journal-store.js'

export const useJournalStore = defineStore('journal', {
  state: () => ({
    readings: journal.listReadings(),
    dailyDraws: { ...journal.loadJournal().dailyDraws }
  }),

  getters: {
    count: (s) => s.readings.length
  },

  actions: {
    _reload() {
      this.readings = journal.listReadings()
      this.dailyDraws = { ...journal.loadJournal().dailyDraws }
    },
    addReading(reading) {
      journal.saveReading(reading)
      this._reload()
      return reading
    },
    saveNote(id, note) {
      // 返回是否为该记录的首次写感想（此前 note 为空）——解读页据此决定发不发 XP，
      // 「编辑→再存」反复保存不再可刷分（评审 2026-09-06）
      const first = !journal.getById(id)?.note
      journal.updateNote(id, note)
      this._reload()
      return first
    },
    remove(id) {
      journal.deleteReading(id)
      this._reload()
    },
    getById(id) {
      return journal.getById(id)
    },
    markDaily(dayKey, readingId) {
      journal.setDailyDraw(dayKey, readingId)
      this._reload()
    },
    dailyReading(dayKey) {
      const id = this.dailyDraws[dayKey]
      return id ? this.getById(id) : null
    }
  }
})
