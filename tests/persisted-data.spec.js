// src/lib/persisted-data：导入与本机读取共用的纯校验层直测——真实日历校验
//（含闰年/假日期）、profile 生日边界（未来日清空、类型坏整键拒收）、成就去重与
// 未知 id 过滤、挑战计数取整、journal 快照 id 不匹配丢弃与容量裁剪。
// 经 doImport 的链路覆盖见 backup.spec，此处补纯函数分支。
import { describe, it, expect } from 'vitest'
import {
  validDate,
  sanitizeProfile,
  sanitizeAchievements,
  sanitizeChallenge,
  sanitizeJournal
} from '../src/lib/persisted-data.js'

describe('validDate：真实日历校验', () => {
  it('合法日期通过；格式不符拒绝', () => {
    expect(validDate('2026-06-15')).toBe(true)
    expect(validDate('2026-6-15')).toBe(false)
    expect(validDate('26-06-15')).toBe(false)
    expect(validDate('2026/06/15')).toBe(false)
    expect(validDate(20260615)).toBe(false)
  })

  it('假日期拒绝：2 月 31 日、平年 2 月 29 日；闰年 2 月 29 日通过', () => {
    expect(validDate('2026-02-31')).toBe(false)
    expect(validDate('2026-04-31')).toBe(false)
    expect(validDate('2023-02-29')).toBe(false)
    expect(validDate('2024-02-29')).toBe(true)
  })
})

describe('sanitizeProfile', () => {
  it('xp/maxStreak 缺省补 0，负数/非数值整键拒收（null）', () => {
    expect(sanitizeProfile({})).toEqual({ xp: 0, maxStreak: 0, birthday: '' })
    expect(sanitizeProfile({ xp: -1 })).toBeNull()
    expect(sanitizeProfile({ maxStreak: '5' })).toBeNull()
    expect(sanitizeProfile({ xp: 10, maxStreak: 3 })).toEqual({ xp: 10, maxStreak: 3, birthday: '' })
  })

  it('生日：过去/今天保留，未来日期清空，非字符串整键拒收', () => {
    expect(sanitizeProfile({ birthday: '1995-06-15' }).birthday).toBe('1995-06-15')
    expect(sanitizeProfile({ birthday: '2999-01-01' }).birthday).toBe('')
    expect(sanitizeProfile({ birthday: 19950615 })).toBeNull()
    expect(sanitizeProfile({ birthday: '2026-02-31' }).birthday).toBe('') // 假日期清空而非拒收
  })

  it('非对象输入 → null', () => {
    expect(sanitizeProfile(null)).toBeNull()
    expect(sanitizeProfile('x')).toBeNull()
    expect(sanitizeProfile([1])).toBeNull()
  })
})

describe('sanitizeAchievements / sanitizeChallenge', () => {
  it('成就：未知 id 过滤 + 去重；unlocked 非数组整键拒收', () => {
    expect(sanitizeAchievements({ unlocked: ['flash-10', 'flash-10', 'not-an-id'] }))
      .toEqual({ unlocked: ['flash-10'] })
    expect(sanitizeAchievements({ unlocked: 'flash-10' })).toBeNull()
    expect(sanitizeAchievements(null)).toBeNull()
  })

  it('挑战：count 向下取整、负数归 0、坏 last 清空；非对象 → null', () => {
    expect(sanitizeChallenge({ count: 2.9, last: '2026-06-15' })).toEqual({ count: 2, last: '2026-06-15' })
    expect(sanitizeChallenge({ count: -3 })).toEqual({ count: 0, last: '' })
    expect(sanitizeChallenge({ count: 'x', last: 'not-a-date' })).toEqual({ count: 0, last: '' })
    expect(sanitizeChallenge('x')).toBeNull()
  })
})

describe('sanitizeJournal', () => {
  const reading = (id, ts, extra = {}) => ({
    id, ts, spreadId: 'time-flow', question: 'q', note: '',
    cards: [{ cardId: 'major-00', positionKey: 'past', reversed: 'yes' }], // reversed 非布尔应归一
    ...extra
  })

  it('结构非法整键拒收：非对象/readings 非数组/dailyDraws 非对象', () => {
    expect(sanitizeJournal(null)).toBeNull()
    expect(sanitizeJournal({ readings: 'x', dailyDraws: {} })).toBeNull()
    expect(sanitizeJournal({ readings: [], dailyDraws: [] })).toBeNull()
  })

  it('reversed 严格归布尔、question/note 非字符串清空、未知 cardId 过滤', () => {
    const out = sanitizeJournal({
      readings: [reading('r1', 100, { question: 42, note: null, cards: [
        { cardId: 'major-00', positionKey: 'past', reversed: 'yes' },
        { cardId: 'no-such-card', positionKey: 'now', reversed: true }
      ] })],
      dailyDraws: {}
    })
    expect(out.readings[0].question).toBe('')
    expect(out.readings[0].note).toBe('')
    expect(out.readings[0].cards).toEqual([{ cardId: 'major-00', positionKey: 'past', reversed: false }])
  })

  it('快照 id 与 spreadId 不匹配 → 丢弃快照（详情页回退注册表）', () => {
    const snapshot = { id: 'other-spread', name: '别名阵', positions: [{ key: 'p1', label: '位', x: 50, y: 50 }] }
    const out = sanitizeJournal({ readings: [reading('r1', 100, { spreadSnapshot: snapshot })], dailyDraws: {} })
    expect(out.readings[0].spreadSnapshot).toBeUndefined()

    const matched = sanitizeJournal({
      readings: [reading('r1', 100, { spreadSnapshot: { ...snapshot, id: 'time-flow' } })],
      dailyDraws: {}
    })
    expect(matched.readings[0].spreadSnapshot.id).toBe('time-flow')
  })

  it('limit 参数生效：按 ts 降序取前 N，重复 id 只留最新', () => {
    const out = sanitizeJournal({
      readings: [reading('a', 100), reading('b', 300), reading('a', 500), reading('c', 200)],
      dailyDraws: {}
    }, 2)
    expect(out.readings.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('dailyDraws：坏日键/悬空引用剔除，合法保留', () => {
    const out = sanitizeJournal({
      readings: [reading('a', 100)],
      dailyDraws: { '2026-06-15': 'a', 'bad-key': 'a', '2026-06-16': 'ghost' }
    })
    expect(out.dailyDraws).toEqual({ '2026-06-15': 'a' })
  })
})
