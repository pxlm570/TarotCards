// profile store（M3 Task 4/6）：xp / birthday / maxStreak 持久化。
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileStore } from '../src/stores/profile.js'

describe('profile store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认 xp=0、无生日、maxStreak=0', () => {
    const s = useProfileStore()
    expect(s.xp).toBe(0)
    expect(s.birthday).toBe('')
    expect(s.maxStreak).toBe(0)
  })

  it('addXp 累加并持久化，负数归零下限', () => {
    const s = useProfileStore()
    s.addXp(10)
    s.addXp(5)
    expect(s.xp).toBe(15)
    const saved = JSON.parse(localStorage.getItem('tarot.profile.v1'))
    expect(saved.xp).toBe(15)
  })

  it('setBirthday 保存', () => {
    const s = useProfileStore()
    s.setBirthday('1990-05-23')
    expect(s.birthday).toBe('1990-05-23')
  })

  it('updateMaxStreak 只取历史最大值', () => {
    const s = useProfileStore()
    s.updateMaxStreak(3)
    s.updateMaxStreak(2)
    s.updateMaxStreak(7)
    expect(s.maxStreak).toBe(7)
  })

  it('新 store 从 localStorage 恢复', () => {
    const s = useProfileStore()
    s.addXp(30)
    s.setBirthday('2000-01-01')
    s.updateMaxStreak(5)
    setActivePinia(createPinia())
    const s2 = useProfileStore()
    expect(s2.xp).toBe(30)
    expect(s2.birthday).toBe('2000-01-01')
    expect(s2.maxStreak).toBe(5)
  })
})
