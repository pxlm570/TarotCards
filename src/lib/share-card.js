// 分享卡片（M5 Task 2）：Canvas 2D 绘制 1080×1350（4:5）。
// 布局部分抽成纯函数（可测）；绘制依赖浏览器 Canvas（分享时用，jsdom 不测）。
// 牌面真图（2026-09-03）：调用方传入 cardUrl 解析当前皮肤真牌面，异步加载后
// 圆角 cover 绘制、逆位旋转 180°；单图缺失/加载失败回退金边占位——分享永不因一张图失败而失败。

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

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // 单图失败不拖垮整卡
    img.src = url
  })
}

// 牌面图 500x839 与布局 300/527 比例略有出入，直接拉伸会轻微变形——按目标框居中 cover 裁剪
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height
  const r = w / h
  let sw = img.width
  let sh = img.height
  let sx = 0
  let sy = 0
  if (ir > r) {
    sw = img.height * r
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / r
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// 圆角路径（ctx.roundRect 较新，老 WebView 降级直角）
function pathCard(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

export async function generateShareCard(reading, spread, { includeQuestion = false, cardUrl = null } = {}) {
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

  // 牌面：真图优先（圆角 clip + cover），无图回退占位底色；统一金色描边
  const imgs = await Promise.all(
    layout.positions.map((p) => (cardUrl && cardUrl(p.cardId) ? loadImage(cardUrl(p.cardId)) : Promise.resolve(null)))
  )
  layout.positions.forEach((p, i) => {
    const img = imgs[i]
    ctx.save()
    pathCard(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.clip()
    if (img) {
      if (p.reversed) {
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
        ctx.rotate(Math.PI)
        drawCover(ctx, img, -p.w / 2, -p.h / 2, p.w, p.h)
      } else {
        drawCover(ctx, img, p.x, p.y, p.w, p.h)
      }
    } else {
      ctx.fillStyle = '#232850'
      ctx.fillRect(p.x, p.y, p.w, p.h)
    }
    ctx.restore()
    ctx.strokeStyle = '#E8B93E'
    ctx.lineWidth = 3
    pathCard(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.stroke()
    if (p.label) {
      ctx.fillStyle = '#9A97B8'
      ctx.font = '500 24px sans-serif'
      ctx.fillText(p.label, p.x + p.w / 2, p.y - 12)
    }
    if (p.reversed) {
      ctx.fillStyle = '#9A97B8'
      ctx.fillText('逆位', p.x + p.w / 2, p.y + p.h + 26)
    }
  })

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
