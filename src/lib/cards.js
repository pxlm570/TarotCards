// 牌面索引（id → 卡片定义）：牌 id 是全局契约（major-00…21 / 花色-01…14），
// 视图/组件按 id 查牌统一走这里，不再各自 new Map。
import cardsData from '../data/cards.json'

export const cardById = new Map(cardsData.map((c) => [c.id, c]))
