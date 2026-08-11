// 成就框架（M2 Task 6）：unlock 幂等、入队弹出、持久化 tarot.achievements.v1。
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAchievementsStore } from '../src/stores/achievements.js'

describe('achievements store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('默认未解锁任何成就', () => {
    const s = useAchievementsStore()
    expect(s.unlocked).toEqual([])
    expect(s.count).toBe(0)
  })

  it('unlock 幂等：重复解锁返回 false 且只记一次', () => {
    const s = useAchievementsStore()
    expect(s.unlock('ch-01-done')).toBe(true)
    expect(s.unlock('ch-01-done')).toBe(false)
    expect(s.unlocked).toEqual(['ch-01-done'])
  })

  it('解锁后进入 justUnlocked 队列，_pop 逐条消费', () => {
    const s = useAchievementsStore()
    s.unlock('ch-01-done')
    s.unlock('flash-10')
    const first = s._pop()
    const second = s._pop()
    expect(first.title).toBe('初识塔罗')
    expect(second.title).toBe('温故知新')
    expect(s._pop()).toBeNull()
  })

  it('持久化到 tarot.achievements.v1，新 store 可恢复', () => {
    const s = useAchievementsStore()
    s.unlock('ch-03-done')
    expect(localStorage.getItem('tarot.achievements.v1')).toBeTruthy()

    setActivePinia(createPinia())
    const s2 = useAchievementsStore()
    expect(s2.unlocked).toEqual(['ch-03-done'])
  })

  it('非法 id 解锁：入 unlocked 但不入队', () => {
    const s = useAchievementsStore()
    s.unlock('no-such')
    expect(s.unlocked).toContain('no-such')
    expect(s.justUnlocked).toEqual([])
  })
})
