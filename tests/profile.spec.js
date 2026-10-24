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

  it('addXp 负数不穿底：加到负值时归零并按 0 持久化', () => {
    const s = useProfileStore()
    s.addXp(10)
    expect(s.xp).toBe(10)
    expect(s.addXp(-100)).toBe(0)
    expect(s.xp).toBe(0)
    const saved = JSON.parse(localStorage.getItem('tarot.profile.v1'))
    expect(saved.xp).toBe(0)
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

// 存量坏数据兜底（评审 2026-09-06）：xp 坏成字符串曾让 addXp 走拼接（"10"+5="105"）
describe('profile store：存量坏数据兜底', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('xp/maxStreak 非数值归一为 0，addXp 走数值加法', () => {
    localStorage.setItem('tarot.profile.v1', JSON.stringify({ xp: '10', birthday: '', maxStreak: '3' }))
    setActivePinia(createPinia())
    const s = useProfileStore()
    expect(s.xp).toBe(0)
    expect(s.maxStreak).toBe(0)
    expect(s.addXp(5)).toBe(5)
  })

  it('坏 JSON 回落默认值，且随后可正常写入', () => {
    localStorage.setItem('tarot.profile.v1', '{oops')
    setActivePinia(createPinia())
    const s = useProfileStore()
    expect(s.xp).toBe(0)
    expect(s.birthday).toBe('')
    expect(s.maxStreak).toBe(0)
    expect(s.addXp(3)).toBe(3)
  })

  it('非对象 JSON（数组/字符串/数字）回落默认值', () => {
    for (const bad of [JSON.stringify([1, 2]), JSON.stringify('hello'), JSON.stringify(42)]) {
      localStorage.setItem('tarot.profile.v1', bad)
      setActivePinia(createPinia())
      const s = useProfileStore()
      expect(s.xp).toBe(0)
      expect(s.birthday).toBe('')
      expect(s.maxStreak).toBe(0)
    }
  })

  it('birthday 非字符串置空但其余字段保留（不因生日坏而整包拒绝）', () => {
    localStorage.setItem('tarot.profile.v1', JSON.stringify({ xp: 20, maxStreak: 2, birthday: 19990523 }))
    setActivePinia(createPinia())
    const s = useProfileStore()
    expect(s.xp).toBe(20)
    expect(s.maxStreak).toBe(2)
    expect(s.birthday).toBe('')
  })
})
