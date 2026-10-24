// 分享卡片（M5 Task 2）：纯布局与截断函数。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { truncate, buildShareLayout, SHARE_W, SHARE_H, generateShareCard } from '../src/lib/share-card.js'

const spread = { positions: [{ key: 'past', label: '过去' }, { key: 'present', label: '现在' }] }
const reading = {
  question: '我该如何准备这次机会',
  cards: [{ cardId: 'major-00', positionKey: 'past', reversed: false }, { cardId: 'major-01', positionKey: 'present', reversed: true }]
}

describe('share-card', () => {
  it('truncate 超长省略', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 5)).toBe('abc')
  })

  it('buildShareLayout 映射位置并居中', () => {
    const l = buildShareLayout(reading, spread, { includeQuestion: true })
    expect(l.positions).toHaveLength(2)
    expect(l.positions[0].label).toBe('过去')
    expect(l.positions[1].label).toBe('现在')
    expect(l.positions[1].reversed).toBe(true)
    // 居中：x + w/2 ≈ 画布中心
    expect(Math.abs(l.positions[0].x + l.positions[0].w / 2 - SHARE_W / 2)).toBeLessThan(2)
    expect(l.question).toContain('我该如何准备')
  })

  it('includeQuestion=false 时不带问题', () => {
    const l = buildShareLayout(reading, spread, { includeQuestion: false })
    expect(l.question).toBe('')
  })

  it('truncate 假值早退返回空串', () => {
    expect(truncate('', 30)).toBe('')
    expect(truncate(null, 30)).toBe('')
    expect(truncate(undefined, 30)).toBe('')
    expect(truncate(0, 30)).toBe('')
  })

  it('问题 30 字上限：恰好 30 原样、31 字截为 29 字加省略号、短问题原样', () => {
    const q30 = '一二三四五六七八九十'.repeat(3)
    const l30 = buildShareLayout({ question: q30, cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(l30.question).toBe(q30) // 恰好 30 字不截断

    // 31 个不重复汉字：输出锁 29 原字 + …（旧 40 字上限会尾部裁切，故收紧为 30）
    const q31 = Array.from({ length: 31 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('')
    const l31 = buildShareLayout({ question: q31, cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(l31.question).toBe(q31.slice(0, 29) + '…')
    expect(l31.question).toHaveLength(30)
    expect(l31.question).not.toContain(q31[30]) // 第 31 个原字符不得出现

    const lShort = buildShareLayout({ question: '今天运势如何', cards: [reading.cards[0]] }, spread, { includeQuestion: true })
    expect(lShort.question).toBe('今天运势如何')
  })

  it('未知 positionKey 与无 spread 时牌位标签为空串且不炸', () => {
    const r = { question: '', cards: [{ cardId: 'major-05', positionKey: 'no-such-key', reversed: false }] }
    expect(buildShareLayout(r, spread, {}).positions[0].label).toBe('')
    expect(() => buildShareLayout(r, null, {})).not.toThrow()
    expect(buildShareLayout(r, null, {}).positions[0].label).toBe('')
    expect(buildShareLayout(r, undefined, {}).positions[0].label).toBe('')
  })

  it('空 cards 时 positions 为空且 keywords 为空数组', () => {
    const l = buildShareLayout({ question: '', cards: [] }, spread, {})
    expect(l.positions).toHaveLength(0)
    expect(l.keywords).toEqual([])
  })

  it('多牌时卡高不超 400 上限、逐位递增且水平居中', () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({ cardId: `major-0${i}`, positionKey: 'past', reversed: false }))
    const l = buildShareLayout({ question: '', cards }, spread, {})
    expect(l.keywords).toEqual(['星语塔罗'])
    for (const p of l.positions) {
      expect(p.h).toBeLessThanOrEqual(400)
      expect(Math.abs(p.x + p.w / 2 - SHARE_W / 2)).toBeLessThan(2)
    }
    for (let i = 1; i < l.positions.length; i++) {
      expect(l.positions[i].y).toBeGreaterThan(l.positions[i - 1].y)
    }
    // 单牌也被 Math.min 压到 400 上限（而非占满 720 高）
    const single = buildShareLayout({ question: '', cards: [cards[0]] }, spread, {})
    expect(single.positions[0].h).toBe(400)
  })
})

// 布局边界（2026-10-24 补薄弱分支）：问题区起点、卡框比例、省略参数的默认口径
describe('share-card：布局边界', () => {
  it('画布尺寸 1080×1350（4:5）', () => {
    expect(SHARE_W).toBe(1080)
    expect(SHARE_H).toBe(1350)
  })

  it('includeQuestion 决定牌面区起点：true 360 / false 300', () => {
    expect(buildShareLayout(reading, spread, { includeQuestion: true }).positions[0].y).toBe(360)
    expect(buildShareLayout(reading, spread, { includeQuestion: false }).positions[0].y).toBe(300)
  })

  it('includeQuestion=true 但问题为空/缺失：question 为空串', () => {
    expect(buildShareLayout({ cards: reading.cards }, spread, { includeQuestion: true }).question).toBe('')
    expect(buildShareLayout({ question: '', cards: reading.cards }, spread, { includeQuestion: true }).question).toBe('')
  })

  it('options 省略：includeQuestion 视为 falsy（无问题、牌区起点 300）', () => {
    const omitted = buildShareLayout(reading, spread)
    expect(omitted.question).toBe('')
    expect(omitted.positions[0].y).toBe(300)
    const empty = buildShareLayout(reading, spread, {})
    expect(empty.question).toBe('')
    expect(empty.positions[0].y).toBe(300)
  })

  it('单牌卡框比例贴合 300/527（真牌面 cover 裁剪的基准比例）', () => {
    const p = buildShareLayout({ question: '', cards: [reading.cards[0]] }, spread, {}).positions[0]
    expect(p.h).toBe(400)
    expect(p.w).toBeCloseTo(400 * (300 / 527), 6)
    expect(p.w / p.h).toBeCloseTo(300 / 527, 6)
  })
})

// 绘制管线（2026-10-24 补覆盖）：jsdom 无 canvas 实现，stub 2D 上下文与 Image 走通
// generateShareCard 全链路——「分享永不因一张图失败而失败」「toBlob 空必须 reject」
// 这两条契约此前只有布局层在守，绘制层零覆盖。
describe('generateShareCard：绘制管线（stub 2D 上下文）', () => {
  const spread = { positions: [{ key: 'past', label: '过去' }, { key: 'present', label: '现在' }] }
  const reading2 = {
    question: '近期事业走势',
    cards: [
      { cardId: 'major-00', positionKey: 'past', reversed: false },
      { cardId: 'major-01', positionKey: 'present', reversed: true }
    ]
  }

  let ctx
  let blob
  // Image 行为按用例注入：默认 500×839 标准牌面加载成功；failSrc 命中片段的走 onerror
  let imgBehavior = {}

  function stubCanvas({ roundRect = true } = {}) {
    const calls = []
    const grad = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) }
    ctx = { calls }
    for (const prop of ['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign']) {
      let v
      Object.defineProperty(ctx, prop, {
        set: (x) => { calls.push([`set:${prop}`, x]); v = x },
        get: () => v
      })
    }
    Object.assign(ctx, {
      createLinearGradient: (...args) => { calls.push(['createLinearGradient', ...args]); return grad },
      fillRect: (...args) => calls.push(['fillRect', ...args]),
      fillText: (...args) => calls.push(['fillText', ...args]),
      beginPath: () => calls.push(['beginPath']),
      clip: () => calls.push(['clip']),
      save: () => calls.push(['save']),
      restore: () => calls.push(['restore']),
      translate: (...args) => calls.push(['translate', ...args]),
      rotate: (...args) => calls.push(['rotate', ...args]),
      drawImage: (...args) => calls.push(['drawImage', ...args]),
      stroke: () => calls.push(['stroke']),
      rect: (...args) => calls.push(['rect', ...args])
    })
    if (roundRect) ctx.roundRect = (...args) => calls.push(['roundRect', ...args])
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb, type) {
      cb(blob, type)
    })
    return ctx
  }

  function stubImage() {
    class FakeImage {
      set src(value) {
        this._src = value
        queueMicrotask(() => {
          if ((imgBehavior.failSrc ?? []).some((frag) => String(value).includes(frag))) this.onerror?.()
          else {
            this.width = imgBehavior.width ?? 500
            this.height = imgBehavior.height ?? 839
            this.onload?.()
          }
        })
      }
      get src() { return this._src }
    }
    vi.stubGlobal('Image', FakeImage)
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    imgBehavior = {}
  })

  it('真图管线：标题/问题/牌位标签/逆位/落款全部落笔，逆位旋转 180°，最终产出 blob', async () => {
    stubCanvas()
    stubImage()
    blob = { size: 42 }
    const out = await generateShareCard(reading2, spread, {
      includeQuestion: true,
      cardUrl: (id) => `/decks/rws/${id}.webp`
    })
    expect(out).toBe(blob)
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    const texts = ctx.calls.filter(([k]) => k === 'fillText').map(([, t]) => t)
    expect(texts).toContain('星语塔罗')
    expect(texts).toContain('「近期事业走势」')
    expect(texts).toContain('过去')
    expect(texts).toContain('现在')
    expect(texts).toContain('逆位')
    expect(texts.some((t) => String(t).includes('来自 星语塔罗'))).toBe(true)
    expect(texts.some((t) => String(t).includes(location.origin))).toBe(true)
    // 逆位卡：平移到牌位中心后旋转半圈
    expect(ctx.calls.filter(([k]) => k === 'rotate').map(([, a]) => a)).toEqual([Math.PI])
    expect(ctx.calls.filter(([k]) => k === 'drawImage')).toHaveLength(2)
  })

  it('cardUrl 缺席：不加载任何图片，牌位回退占位底色，分享照常产出', async () => {
    stubCanvas()
    stubImage()
    blob = { size: 1 }
    const out = await generateShareCard(reading2, spread, {})
    expect(out).toBe(blob)
    expect(ctx.calls.some(([k]) => k === 'drawImage')).toBe(false)
    expect(ctx.calls.filter(([k, v]) => k === 'set:fillStyle' && v === '#232850')).toHaveLength(2)
    // 占位底色同样走圆角裁剪 + 金边描边
    expect(ctx.calls.filter(([k]) => k === 'clip')).toHaveLength(2)
    expect(ctx.calls.filter(([k]) => k === 'stroke')).toHaveLength(2)
  })

  it('单图加载失败不拖垮整卡：失败位占位、成功位真图，依然 resolve', async () => {
    stubCanvas()
    stubImage()
    imgBehavior = { failSrc: ['major-01'] }
    blob = { size: 7 }
    const out = await generateShareCard(reading2, spread, { cardUrl: (id) => `/decks/rws/${id}.webp` })
    expect(out).toBe(blob)
    expect(ctx.calls.filter(([k]) => k === 'drawImage')).toHaveLength(1)
    expect(ctx.calls.filter(([k, v]) => k === 'set:fillStyle' && v === '#232850')).toHaveLength(1)
  })

  it('toBlob 回调 null（画布过大被拒等）必须 reject，不得拿空 blob 假成功', async () => {
    stubCanvas()
    stubImage()
    blob = null
    await expect(
      generateShareCard(reading2, spread, { cardUrl: (id) => `/decks/rws/${id}.webp` })
    ).rejects.toThrow('分享卡生成失败')
  })

  it('canvas 2D 上下文不可用（老内核）时明确报错', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(generateShareCard(reading2, spread, {})).rejects.toThrow('canvas 不支持')
  })

  it('cover 裁剪：图比框更宽时左右居中裁剪（sx>0、不变形）', async () => {
    stubCanvas()
    stubImage()
    imgBehavior = {}
    blob = { size: 1 }
    await generateShareCard(reading2, spread, { cardUrl: () => '/decks/rws/major-00.webp' })
    const [, img, sx, sy, sw, sh] = ctx.calls.find(([k]) => k === 'drawImage')
    expect(img.width).toBe(500)
    expect(img.height).toBe(839)
    expect(sx).toBeGreaterThan(0) // 500×839 装进 300/527 框：宽出部分左右各裁
    expect(sy).toBe(0)
    expect(sh).toBe(839) // 高度铺满
    expect(sw).toBeLessThan(500)
  })

  it('cover 裁剪：图比框更窄高时上下居中裁剪（sy>0）', async () => {
    stubCanvas()
    stubImage()
    imgBehavior = { width: 300, height: 1000 }
    blob = { size: 1 }
    await generateShareCard(reading2, spread, { cardUrl: () => '/decks/rws/major-00.webp' })
    const [, , sx, sy, sw, sh] = ctx.calls.find(([k]) => k === 'drawImage')
    expect(sx).toBe(0)
    expect(sy).toBeGreaterThan(0)
    expect(sw).toBe(300)
    expect(sh).toBeLessThan(1000)
  })

  it('老 WebView 无 roundRect：圆角降级直角矩形路径，不炸', async () => {
    stubCanvas({ roundRect: false })
    stubImage()
    blob = { size: 1 }
    const out = await generateShareCard(reading2, spread, {})
    expect(out).toBe(blob)
    expect(ctx.calls.some(([k]) => k === 'rect')).toBe(true)
    expect(ctx.calls.some(([k]) => k === 'roundRect')).toBe(false)
  })
})
