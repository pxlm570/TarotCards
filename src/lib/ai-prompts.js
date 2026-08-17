// AI 提示词模块（M4 + Task 19 技艺层）：人格模板 + 安全边界 + 「占卜师技艺」技能手册。
// 每次调用的 system = 人格差异化 + TAROT_CRAFT + SAFETY + 场景侧重。
import { loadSettings } from './storage.js'
import { TAROT_CRAFT, PERSONA_CRAFT, CRAFT_SECTIONS } from './ai-craft.js'

const DOMAIN_LABEL = { love: '感情', career: '事业', wealth: '财运', study: '学业', general: '综合' }

// 人格身份句（差异化层在 ai-craft.js 的 PERSONA_CRAFT，那是唯一源）
export const PERSONAS = {
  gentle: '你是「星语」，一位温柔治愈的塔罗师。',
  direct: '你是「星语」，一位直率犀利的塔罗师。',
  scholar: '你是「星语」，一位学术严谨的塔罗师。'
}

export const SAFETY =
  '安全边界：不替代医疗、法律、金融的专业意见；遇到自伤倾向的表达时，温和建议寻求专业心理帮助；不做「你一定会…」的绝对预言，措辞留有余地。'

function persona() {
  const p = loadSettings().persona
  const key = PERSONAS[p] ? p : 'gentle'
  return `${PERSONAS[key]}\n${PERSONA_CRAFT[key]}`
}

// 人格段（身份句 + 差异化层）：首页问候等轻量场景复用，避免视图层再拼一遍
export function personaPrompt() {
  return persona()
}

// 场景侧重：在技艺层之上按场景微调
const SCENARIO = {
  reading: '本场景是对一次完整占卜的深度解读，请发挥「先整体后逐位」的方法论。',
  clarify: '本场景只帮提问者把问题问得清楚具体，不展开牌意解读，最多反问一个聚焦问题。',
  tutor: '你是塔罗学习助教，以教学为主，把知识点讲明白，而不是占卜。',
  selfRead: '先肯定提问者自己理解中的亮点，再补充 TA 遗漏的一到两个视角。',
  recap: '基于一段时间的占卜记录做模式洞察，温和、向前看，不作评判。'
}

// v1.5 Task 2 场景化裁剪：解读类全量；clarify/tutor/recap 只留互动与语言红线
// （这些场景不做牌面解读，方法论用不上--省几百 token 且不稀释指令）；
// 多轮段只有解读追问这种多轮对话有意义。
const CRAFT_BY_ROLE = {
  reading: TAROT_CRAFT,
  selfRead: [CRAFT_SECTIONS.method, CRAFT_SECTIONS.interaction, CRAFT_SECTIONS.language].join('\n'),
  clarify: [CRAFT_SECTIONS.interaction, CRAFT_SECTIONS.language].join('\n'),
  tutor: [CRAFT_SECTIONS.interaction, CRAFT_SECTIONS.language].join('\n'),
  recap: [CRAFT_SECTIONS.interaction, CRAFT_SECTIONS.language].join('\n')
}

function system(role) {
  return [persona(), CRAFT_BY_ROLE[role] ?? TAROT_CRAFT, SCENARIO[role] ?? '', SAFETY].filter(Boolean).join('\n\n')
}

function orientationText(reversed) {
  return reversed ? '逆位' : '正位'
}

export function buildReadingMessages({ question, domain, spread, drawn, cardsData }) {
  const lines = drawn.map((d) => {
    const card = cardsData.find((c) => c.id === d.cardId)
    const pos = spread.positions.find((p) => p.key === d.positionKey)
    if (!card) return ''
    const meaning = d.reversed ? card.meaning.reversed : card.meaning.upright
    return `【${pos?.label ?? ''}】${card.name}（${orientationText(d.reversed)}）：${meaning}`
  })
  const domainText = domain && DOMAIN_LABEL[domain] ? `提问领域：${DOMAIN_LABEL[domain]}。` : ''
  const user = [
    `我抽了「${spread.name}」牌阵，问题：${question || '（未填写，随心一问）'}。${domainText}`,
    `牌面如下：\n${lines.join('\n')}`,
    '请把这几张牌串联成一个整体叙事，结合我的问题，指出牌与牌之间的呼应（同花色、大小牌、正逆位分布），并给出一句可行动的建议。不要逐张复述牌意。'
  ].join('\n\n')
  return [
    { role: 'system', content: system('reading') },
    { role: 'user', content: user }
  ]
}

export function buildClarifyMessages(draft) {
  return [
    { role: 'system', content: system('clarify') },
    {
      role: 'user',
      content: `用户提的问题是：「${draft}」。请判断：如果足够清晰具体，回复「清晰」两个字即可；如果模糊，用一两句话反问，帮它聚焦到「具体的处境、可行动的方向」，最多一个问题。`
    }
  ]
}

export function buildTutorMessages({ chapterTitle, content, userQuestion }) {
  return [
    { role: 'system', content: `${system('tutor')}\n本章：${chapterTitle}` },
    { role: 'user', content: `本章内容摘要：${content}\n\n学习者的提问：${userQuestion}` }
  ]
}

export function buildSelfReadMessages({ drawn, cardsData, userInterpretation }) {
  const names = drawn.map((d) => cardsData.find((c) => c.id === d.cardId)?.name ?? d.cardId).join('、')
  return [
    { role: 'system', content: system('selfRead') },
    {
      role: 'user',
      content: `我抽了这些牌：${names}。我自己的理解是：「${userInterpretation}」。请先肯定我理解中的亮点，再补充我可能遗漏的一到两个视角。`
    }
  ]
}

export function buildRecapMessages({ readingsSummary, mirrorStats }) {
  return [
    { role: 'system', content: system('recap') },
    {
      role: 'user',
      content: `这是我最近一段时间的占卜记录摘要：${readingsSummary}\n统计：${mirrorStats}\n请总结这段时间我反复面对的主题与潜在的模式，并给我一个温和的、向前看的建议。`
    }
  ]
}

// 首页每日问候（v1.5 Task 2 收编人格 #15）：一句话轻量场景，不注技艺层
export function buildGreetingMessages(streakStatus) {
  return [
    { role: 'system', content: `${personaPrompt()}\n只用一句话问候今天的占卜者，不超过 30 个字。` },
    { role: 'user', content: `今天的状态：${streakStatus}。请给我一句开场问候。` }
  ]
}

// 供测试断言技艺层要素（避免魔法字符串漂移）
export { TAROT_CRAFT, PERSONA_CRAFT }
