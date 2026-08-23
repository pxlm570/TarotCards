// 分享卡片（M5 Task 2）：Canvas 2D 绘制 1080×1350（4:5）。
// 布局部分抽成纯函数（可测）；绘制依赖浏览器 Canvas（分享时用，jsdom 不测）。

export const SHARE_W = 1080
export const SHARE_H = 1350

export function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// 纯布局：把 reading 的牌映射到卡片缩略位置（单列纵排小牌）
export function buildShareLayout(reading, spread, { includeQuestion } = {}) {
  const n = reading.cards.length
  const area = { top: includeQuestion ? 360 : 300, height: 720 }
  const gap = 24
  const cardH = Math.min(400, (area.height - gap * (n - 1)) / Math.max(1, n))
  const cardW = cardH * (300 / 527)
  const left = (SHARE_W - cardW) / 2
  const positions = reading.cards.map((c, i) => ({
    cardId: c.cardId,
    reversed: c.reversed,
    x: left,
    y: area.top + i * (cardH + gap),
    w: cardW,
    h: cardH,
    label: spread?.positions?.find((p) => p.key === c.positionKey)?.label ?? ''
  }))
  return {
    positions,
    // 30 字上限：30px 字号 x 30 字 + 引号 ≈ 960px < 1080px 画布宽（旧 40 字会尾部裁切）
    question: includeQuestion ? truncate(reading.question || '', 30) : '',
    keywords: (reading.cards[0] ? ['星语塔罗'] : []).slice(0, 1)
  }
}

export async function generateShareCard(reading, spread, { includeQuestion = false } = {}) {
  const layout = buildShareLayout(reading, spread, { includeQuestion })
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_W
  canvas.height = SHARE_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不支持')

  // 底色（暗夜藏青）
  const grad = ctx.createLinearGradient(0, 0, 0, SHARE_H)
  grad.addColorStop(0, '#14162E')
  grad.addColorStop(1, '#0F1523')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SHARE_W, SHARE_H)

  // 顶部产品名
  ctx.fillStyle = '#E8B93E'
  ctx.font = '700 52px "Songti SC","SimSun",serif'
  ctx.textAlign = 'center'
  ctx.fillText('星语塔罗', SHARE_W / 2, 150)

  // 牌面缩略：金边占位矩形（不加载牌面图——异步装配复杂度高，v1.x 用占位语言；
  // 载入真图列入 backlog）
  for (const p of layout.positions) {
    ctx.fillStyle = '#232850'
    ctx.fillRect(p.x, p.y, p.w, p.h)
    ctx.strokeStyle = '#E8B93E'
    ctx.lineWidth = 3
    ctx.strokeRect(p.x, p.y, p.w, p.h)
    if (p.label) {
      ctx.fillStyle = '#9A97B8'
      ctx.font = '500 24px sans-serif'
      ctx.fillText(p.label, p.x + p.w / 2, p.y - 12)
    }
    if (p.reversed) {
      ctx.fillStyle = '#9A97B8'
      ctx.fillText('逆位', p.x + p.w / 2, p.y + p.h + 26)
    }
  }

  // 问题（可选）
  if (layout.question) {
    ctx.fillStyle = '#F1EDE2'
    ctx.font = '400 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`「${layout.question}」`, SHARE_W / 2, 1120)
  }

  // 底部产品地址
  ctx.fillStyle = '#9A97B8'
  ctx.font = '400 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`来自 星语塔罗 · ${location.origin}${import.meta.env.BASE_URL}`, SHARE_W / 2, SHARE_H - 60)

  // toBlob 失败（画布过大被浏览器拒绝等）必须 reject，让调用方走失败分支而不是拿 null blob
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('分享卡生成失败'))), 'image/png')
  )
}
