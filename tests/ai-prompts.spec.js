// AI 提示词模块（M4 Task 3）：各 builder 输出含关键字段、persona 注入。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildReadingMessages,
  buildClarifyMessages,
  buildTutorMessages,
  buildSelfReadMessages,
  buildRecapMessages,
  buildGreetingMessages,
  PERSONAS,
  SAFETY,
  TAROT_CRAFT
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

  // Task 19/20-F：技艺层与人格双源
  it('system 完整注入 TAROT_CRAFT（一锤定音）', () => {
    const msgs = buildReadingMessages({ question: 'x', domain: null, spread, drawn, cardsData: cards })
    const s = msgs[0].content
    expect(s).toContain(TAROT_CRAFT)
    expect(s).toContain(SAFETY) // 安全边界仍在
  })

  it('三大人格各含专属用词倾向且互不串层（交叉断言）', () => {
    const get = () =>
      buildReadingMessages({ question: '', domain: null, spread, drawn, cardsData: cards })
        .map((m) => m.content)
        .join(' ')
    const gent = get()
    saveSettings({ persona: 'direct' })
    const dir = get()
    saveSettings({ persona: 'scholar' })
    const sch = get()
    // 各自专属关键词（身份句 + PERSONA_CRAFT 差异化层）
    expect(gent).toContain('或许')
    expect(gent).toContain('慢慢来')
    expect(dir).toContain('别绕弯')
    expect(dir).toContain('点出核心')
    expect(sch).toContain('符号学')
    expect(sch).toContain('元素对应')
    // 交叉互斥：不包含其他人格的专属词
    expect(gent).not.toContain('别绕弯')
    expect(gent).not.toContain('符号学')
    expect(dir).not.toContain('慢慢来')
    expect(dir).not.toContain('元素对应')
    expect(sch).not.toContain('或许')
    expect(sch).not.toContain('点出核心')
  })

  it('澄清场景注入「只帮提问者把问题问清楚、不展开解读」侧重', () => {
    const msgs = buildClarifyMessages('我会不会成功')
    expect(msgs[0].content).toContain('不展开牌意解读')
  })
})

// v1.5 Task 2：场景化裁剪--非解读场景不注入解读方法论（省 token、不稀释指令）
describe('场景化技艺层裁剪', () => {
  it('clarify 不含方法论与多轮段，保留互动/红线/安全边界', () => {
    const s = buildClarifyMessages('x')[0].content
    expect(s).not.toContain('一、解读方法论')
    expect(s).not.toContain('先整体、后逐位')
    expect(s).not.toContain('四、多轮与追问')
    expect(s).toContain('与提问者的互动')
    expect(s).toContain('不说空泛套话')
    expect(s).toContain(SAFETY)
  })

  it('tutor / recap 同样不注入方法论', () => {
    const t = buildTutorMessages({ chapterTitle: 'c', content: 'x', userQuestion: 'q' })[0].content
    expect(t).not.toContain('一、解读方法论')
    const r = buildRecapMessages({ readingsSummary: 's', mirrorStats: 'm' })[0].content
    expect(r).not.toContain('一、解读方法论')
  })

  it('selfRead 保留方法论但不注入多轮段；reading 全量不变', () => {
    const self = buildSelfReadMessages({ drawn, cardsData: cards, userInterpretation: 'u' })[0].content
    expect(self).toContain('一、解读方法论')
    expect(self).not.toContain('四、多轮与追问')
    const reading = buildReadingMessages({ question: 'q', domain: null, spread, drawn, cardsData: cards })[0].content
    expect(reading).toContain(TAROT_CRAFT) // 全量（四段都在）
  })
})

// v1.5 Task 2（#15 顺手）：首页每日问候随人格
describe('buildGreetingMessages：问候随人格', () => {
  it('默认温柔人格；切 direct 后提示词随人格切换', () => {
    const g = buildGreetingMessages('新的一天')
    expect(g[0].content).toContain('温柔治愈')
    expect(g[1].content).toContain('新的一天')
    saveSettings({ persona: 'direct' })
    const d = buildGreetingMessages('连胜第 3 天')
    expect(d[0].content).toContain('直率犀利')
    expect(d[0].content).not.toContain('温柔治愈')
    expect(d[1].content).toContain('连胜第 3 天')
  })

  it('问候保持轻量：不注入技艺层', () => {
    const g = buildGreetingMessages('新的一天')
    expect(g[0].content).not.toContain('一、解读方法论')
  })
})
