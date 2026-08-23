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
