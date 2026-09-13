// 数据导出/导入（M3 Task 7）。
import { describe, it, expect, beforeEach } from 'vitest'
import { collectBackup, parseImport, applyImport } from '../src/lib/backup.js'

function seed() {
  localStorage.setItem('tarot.settings.v1', JSON.stringify({ theme: 'dark', deckId: 'rws' }))
  localStorage.setItem(
    'tarot.journal.v1',
    JSON.stringify({ readings: [{ id: 'a', ts: 1, cards: [] }], dailyDraws: { '2026-07-25': 'a' } })
  )
  localStorage.setItem('tarot.learning.v1', JSON.stringify({ unlocked: ['ch-01'], progress: {} }))
  localStorage.setItem('tarot.profile.v1', JSON.stringify({ xp: 10, birthday: '', maxStreak: 1 }))
  localStorage.setItem('tarot.achievements.v1', JSON.stringify({ unlocked: ['ch-01-done'] }))
}

describe('backup', () => {
  beforeEach(() => localStorage.clear())

  it('collectBackup 汇总全部 tarot.*.v1 键', () => {
    seed()
    const b = collectBackup()
    expect(b.version).toBe(1)
    expect(Object.keys(b.data).sort()).toEqual(
      ['tarot.achievements.v1', 'tarot.journal.v1', 'tarot.learning.v1', 'tarot.profile.v1', 'tarot.settings.v1']
    )
    expect(b.data['tarot.journal.v1'].readings).toHaveLength(1)
  })

  it('导出→全量覆盖导入往返无损', () => {
    seed()
    const text = JSON.stringify(collectBackup())
    localStorage.clear()
    const parsed = parseImport(text)
    applyImport(parsed, 'overwrite')
    expect(JSON.parse(localStorage.getItem('tarot.settings.v1')).theme).toBe('dark')
    expect(JSON.parse(localStorage.getItem('tarot.journal.v1')).readings).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('tarot.profile.v1')).xp).toBe(10)
  })

  it('合并模式：readings 按 id 去重，新记录并入', () => {
    seed()
    // 本地已有 id=a，备份里带 a（重复）和 b（新增）
    const backup = {
      version: 1,
      data: {
        'tarot.journal.v1': {
          readings: [{ id: 'a', ts: 1, cards: [] }, { id: 'b', ts: 2, cards: [] }],
          dailyDraws: { '2026-07-25': 'a', '2026-07-26': 'b' }
        }
      }
    }
    applyImport(backup, 'merge')
    const readings = JSON.parse(localStorage.getItem('tarot.journal.v1')).readings
    expect(readings.map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(readings).toHaveLength(2)
  })

  it('坏文件 parseImport 抛错', () => {
    expect(() => parseImport('{bad')).toThrow()
    expect(() => parseImport(JSON.stringify({ foo: 1 }))).toThrow()
    expect(() => parseImport(JSON.stringify({ version: 99, data: {} }))).toThrow()
  })

  it('自定义牌阵与挑战数据纳入导出（审查修复：换机不丢创作）', () => {
    seed()
    localStorage.setItem('tarot.custom-spreads.v1', JSON.stringify([{ id: 'custom-x', name: '我的阵', positions: [] }]))
    localStorage.setItem('tarot.challenge.v1', JSON.stringify({ count: 3, last: '2026-08-24' }))
    const b = collectBackup()
    expect(b.data['tarot.custom-spreads.v1']).toHaveLength(1)
    expect(b.data['tarot.challenge.v1'].count).toBe(3)
  })

  it('collectBackup 单键损坏跳过，不致整体崩溃', () => {
    seed()
    localStorage.setItem('tarot.profile.v1', '{corrupt')
    const b = collectBackup()
    expect(b.data['tarot.profile.v1']).toBeUndefined()
    expect(b.data['tarot.journal.v1'].readings).toHaveLength(1)
  })

  it('导入 journal 结构非法时拒绝写入（防静默清空现库）', () => {
    seed()
    const backup = { version: 1, data: { 'tarot.journal.v1': { readings: [{ id: 'x', ts: 1, cards: [] }] } } } // 缺 dailyDraws
    expect(() => applyImport(backup, 'overwrite')).toThrow()
    expect(JSON.parse(localStorage.getItem('tarot.journal.v1')).readings).toHaveLength(1) // 现库未动
  })

  it('导入超过 500 条时裁剪到容量上限', () => {
    const readings = Array.from({ length: 600 }, (_, i) => ({ id: `r${i}`, ts: i, cards: [] }))
    const backup = { version: 1, data: { 'tarot.journal.v1': { readings, dailyDraws: {} } } }
    applyImport(backup, 'overwrite')
    expect(JSON.parse(localStorage.getItem('tarot.journal.v1')).readings).toHaveLength(500)
  })
})

// 导入收口（评审 2026-09-06）：备份是唯一绕过 store 校验直达 localStorage 的写入通道
describe('backup：导入逐键校验与 flow 清理', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('journal 条目缺 cards/ts 被剔除，cards 内缺 cardId 的牌被过滤', () => {
    const backup = {
      version: 1,
      data: {
        'tarot.journal.v1': {
          readings: [
            { id: 'ok', ts: 1, cards: [{ cardId: 'major-00', reversed: false }, { reversed: true }, 'junk'] },
            { id: 'no-cards', ts: 2 },
            { id: 'no-ts', cards: [] }
          ],
          dailyDraws: {}
        }
      }
    }
    applyImport(backup, 'overwrite')
    const j = JSON.parse(localStorage.getItem('tarot.journal.v1'))
    expect(j.readings).toHaveLength(1)
    expect(j.readings[0].cards).toHaveLength(1)
    expect(j.readings[0].cards[0].cardId).toBe('major-00')
  })

  it('覆盖导入：dailyDraws 悬空引用被清理', () => {
    const backup = {
      version: 1,
      data: {
        'tarot.journal.v1': {
          readings: [{ id: 'a', ts: 1, cards: [] }],
          dailyDraws: { '2026-01-01': 'a', '2026-01-02': 'ghost', '2026-01-03': 42 }
        }
      }
    }
    applyImport(backup, 'overwrite')
    expect(JSON.parse(localStorage.getItem('tarot.journal.v1')).dailyDraws).toEqual({ '2026-01-01': 'a' })
  })

  it('合并导入按 ts 排序后裁剪，淘汰最旧而非最新；dailyDraws 悬空引用同步清理', () => {
    const existing = Array.from({ length: 499 }, (_, i) => ({ id: `old${i}`, ts: i, cards: [] }))
    localStorage.setItem('tarot.journal.v1', JSON.stringify({ readings: existing, dailyDraws: {} }))
    const backup = {
      version: 1,
      data: {
        'tarot.journal.v1': {
          readings: [
            { id: 'new1', ts: 900, cards: [] },
            { id: 'new2', ts: 901, cards: [] }
          ],
          dailyDraws: { '2026-05-01': 'new1', '2026-05-02': 'old0' }
        }
      }
    }
    applyImport(backup, 'merge')
    const j = JSON.parse(localStorage.getItem('tarot.journal.v1'))
    expect(j.readings).toHaveLength(500)
    expect(j.readings.some((r) => r.id === 'old0')).toBe(false)
    expect(j.readings.some((r) => r.id === 'new2')).toBe(true)
    expect(j.dailyDraws).toEqual({ '2026-05-01': 'new1' })
  })

  it('learning 键：sr/reviewLog/totalReviews 坏值归一，unlocked/progress 非法跳过整键', () => {
    const bad = { version: 1, data: { 'tarot.learning.v1': { unlocked: 'ch-01', progress: {} } } }
    expect(applyImport(bad, 'overwrite')).toContain('tarot.learning.v1')
    expect(localStorage.getItem('tarot.learning.v1')).toBeNull()

    const fixable = {
      version: 1,
      data: {
        'tarot.learning.v1': { unlocked: ['ch-01'], progress: {}, sr: null, reviewLog: 7, totalReviews: 'x' }
      }
    }
    applyImport(fixable, 'overwrite')
    const l = JSON.parse(localStorage.getItem('tarot.learning.v1'))
    expect(l.sr).toEqual({})
    expect(l.reviewLog).toEqual({})
    expect(l.totalReviews).toBe(0)
  })

  it('profile 键：xp/maxStreak 非数值跳过整键，数值型正常导入', () => {
    const bad = { version: 1, data: { 'tarot.profile.v1': { xp: '10', birthday: '', maxStreak: 1 } } }
    expect(applyImport(bad, 'overwrite')).toContain('tarot.profile.v1')
    expect(localStorage.getItem('tarot.profile.v1')).toBeNull()

    const good = { version: 1, data: { 'tarot.profile.v1': { xp: 42, birthday: '1995-06-15', maxStreak: 3 } } }
    applyImport(good, 'overwrite')
    expect(JSON.parse(localStorage.getItem('tarot.profile.v1')).xp).toBe(42)
  })

  it('全量覆盖导入后清 sessionStorage flow（防已删记录经「继续占卜」复活）', () => {
    sessionStorage.setItem('tarot.flow.v1', JSON.stringify({ phase: 'interpreting', journalId: 'a' }))
    const backup = { version: 1, data: { 'tarot.journal.v1': { readings: [], dailyDraws: {} } } }
    applyImport(backup, 'overwrite')
    expect(sessionStorage.getItem('tarot.flow.v1')).toBeNull()
  })

  it('journal 结构非法抛错时现库与 flow 均不动', () => {
    sessionStorage.setItem('tarot.flow.v1', JSON.stringify({ phase: 'interpreting', journalId: 'a' }))
    const backup = { version: 1, data: { 'tarot.journal.v1': { readings: [{ id: 'x' }] } } } // 缺 dailyDraws
    expect(() => applyImport(backup, 'overwrite')).toThrow()
    expect(sessionStorage.getItem('tarot.flow.v1')).not.toBeNull()
  })
})
