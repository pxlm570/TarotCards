// 历史记录保存当时的语义与坐标，不依赖以后会被编辑/删除的注册表。
export function snapshotSpread(spread) {
  if (!spread || typeof spread.id !== 'string' || typeof spread.name !== 'string') return null
  if (!Array.isArray(spread.positions) || !spread.positions.length || spread.positions.length > 10) return null
  const keys = new Set()
  const positions = []
  for (const p of spread.positions) {
    if (!p || typeof p.key !== 'string' || !p.key || keys.has(p.key) || typeof p.label !== 'string') return null
    if (!['x', 'y'].every((key) => Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 100)) return null
    keys.add(p.key)
    const position = { key: p.key, label: p.label, meaning: typeof p.meaning === 'string' ? p.meaning : '', x: p.x, y: p.y }
    if (Number.isFinite(p.rotate)) position.rotate = p.rotate
    positions.push(position)
  }
  return { id: spread.id, name: spread.name, cardCount: positions.length, positions }
}

export function createReadingRecord(state, id, note = '') {
  return {
    id, ts: Date.now(), spreadId: state.spreadId, question: state.question,
    domain: state.domain ?? null, isDaily: !!state.isDaily, note,
    cards: state.drawn.map(({ cardId, positionKey, reversed }) => ({ cardId, positionKey, reversed })),
    spreadSnapshot: snapshotSpread(state.spread)
  }
}

export function resolveReadingSpread(reading, registry) {
  const snapshot = snapshotSpread(reading?.spreadSnapshot)
  if (snapshot && snapshot.id === reading.spreadId) return snapshot
  return registry.find((spread) => spread.id === reading?.spreadId) ?? null
}
