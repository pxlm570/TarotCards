// AI 提示词模块（M4 Task 3）：各 builder 输出含关键字段、persona 注入。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildReadingMessages,
  buildClarifyMessages,
  buildTutorMessages,
  buildSelfReadMessages,
  buildRecapMessages,
  PERSONAS,
  SAFETY
} from '../src/lib/ai-prompts.js'
import { saveSettings } from '../src/lib/storage.js'

const spread = {
  name: '时间之流',
  positions: [{ key: 'past', label: '过去' }, { key: 'present', label: '现在' }]
}
const drawn = [
  { cardId: 'major-00', positionKey: 'past', reversed: false },
  { cardId: 'major-01', positionKey: 'present', reversed: true }
]
const cards = [
  { id: 'major-00', name: '愚人', meaning: { upright: '新的开始', reversed: '鲁莽' } },
  { id: 'major-01', name: '魔术师', meaning: { upright: '创造', reversed: '误用' } }
]

describe('ai-prompts', () => {
  beforeEach(() => localStorage.clear())

  it('解读消息含系统 persona + 安全边界 + 用户问题与牌面', () => {
    const msgs = buildReadingMessages({ question: '我的事业', domain: 'career', spread, drawn, cardsData: cards })
    const system = msgs[0].content
    expect(system).toContain(SAFETY)
    expect(msgs[1].content).toContain('我的事业')
    expect(msgs[1].content).toContain('愚人')
    expect(msgs[1].content).toContain('魔术师')
    expect(msgs[1].content).toContain('逆位')
  })

  it('persona 随 settings.persona 切换', () => {
    saveSettings({ persona: 'direct' })
    const msgs = buildReadingMessages({ question: '', domain: null, spread, drawn, cardsData: cards })
    expect(msgs[0].content).toContain('直率犀利')
  })

  it('澄清消息包含原始问题', () => {
    const msgs = buildClarifyMessages('我会不会成功')
    expect(msgs[1].content).toContain('我会不会成功')
  })

  it('助教消息含章节与提问', () => {
    const msgs = buildTutorMessages({ chapterTitle: '正逆位', content: '逆位是受阻或过度', userQuestion: '什么是逆位' })
    expect(msgs[0].content).toContain('正逆位')
    expect(msgs[1].content).toContain('什么是逆位')
  })

  it('我先解消息含我的理解与牌名', () => {
    const msgs = buildSelfReadMessages({ drawn, cardsData: cards, userInterpretation: '我觉得是新的开始' })
    expect(msgs[1].content).toContain('愚人')
    expect(msgs[1].content).toContain('新的开始')
  })

  it('复盘消息含摘要与统计', () => {
    const msgs = buildRecapMessages({ readingsSummary: '近一月 5 次占卜', mirrorStats: '事业出现 3 次' })
    expect(msgs[1].content).toContain('近一月 5 次占卜')
    expect(msgs[1].content).toContain('事业出现 3 次')
  })
})
