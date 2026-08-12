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
      journal.updateNote(id, note)
      this._reload()
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
