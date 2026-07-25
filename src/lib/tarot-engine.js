// crypto 真随机；拒绝采样消除取模偏差（2^32 不能被 78 整除，直接 % 会让低下标牌概率偏高）
function randomInt(maxExclusive) {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  let x
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % maxExclusive
}

export function shuffleDeck(deck) {
  const a = [...deck]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function drawCards(deck, n, { allowReversed = true } = {}) {
  if (!Number.isInteger(n) || n < 0 || n > deck.length) {
    throw new RangeError(`drawCards: n 须为 0 到 ${deck.length} 的整数，收到 ${n}`)
  }
  const shuffled = shuffleDeck(deck)
  return shuffled.slice(0, n).map((id) => ({
    id,
    reversed: allowReversed ? randomInt(2) === 1 : false
  }))
}
