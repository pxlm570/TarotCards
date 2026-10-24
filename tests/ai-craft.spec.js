// src/lib/ai-craft：占卜师技艺层契约——TAROT_CRAFT 必须是四段按序拼接的全文
//（reading 场景注入用，ai-prompts.spec 已断言逐字包含），PERSONA_CRAFT 三人格
// 齐全且格式一致（人格开关切换只改这一层，不动方法论）。
import { describe, it, expect } from 'vitest'
import { CRAFT_SECTIONS, TAROT_CRAFT, PERSONA_CRAFT } from '../src/lib/ai-craft.js'

describe('ai-craft：技艺层结构', () => {
  it('TAROT_CRAFT = method/interaction/language/followup 四段按序拼接', () => {
    expect(TAROT_CRAFT).toBe(
      [CRAFT_SECTIONS.method, CRAFT_SECTIONS.interaction, CRAFT_SECTIONS.language, CRAFT_SECTIONS.followup].join('\n')
    )
  })

  it('四段各自非空且以编号标题开头（拆段裁剪场景依赖的稳定锚点）', () => {
    expect(Object.keys(CRAFT_SECTIONS)).toEqual(['method', 'interaction', 'language', 'followup'])
    expect(CRAFT_SECTIONS.method.startsWith('一、解读方法论')).toBe(true)
    expect(CRAFT_SECTIONS.interaction.startsWith('二、与提问者的互动')).toBe(true)
    expect(CRAFT_SECTIONS.language.startsWith('三、语言风格红线')).toBe(true)
    expect(CRAFT_SECTIONS.followup.startsWith('四、多轮与追问')).toBe(true)
    for (const section of Object.values(CRAFT_SECTIONS)) expect(section.trim().length).toBeGreaterThan(50)
  })

  it('PERSONA_CRAFT 恰好三人格，均以「人格：」开头（settings.persona 枚举的一一对应）', () => {
    expect(Object.keys(PERSONA_CRAFT).sort()).toEqual(['direct', 'gentle', 'scholar'])
    for (const text of Object.values(PERSONA_CRAFT)) {
      expect(text.startsWith('人格：')).toBe(true)
      expect(text.trim().length).toBeGreaterThan(20)
    }
  })

  it('三人格文案互不相同（切换人格必须产生可感知差异）', () => {
    const values = Object.values(PERSONA_CRAFT)
    expect(new Set(values).size).toBe(3)
  })
})
