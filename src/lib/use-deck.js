// 当前皮肤的 manifest 单例加载（全部取图组件共用）。
// 失败时暴露 error + retry：已挂载视图靠 retry 恢复，不然会永久空白牌面。
import { ref } from 'vue'
import { loadDeck, cardImageUrl, backImageUrl } from './deck-loader.js'
import { loadSettings } from './storage.js'

const manifest = ref(null)
const error = ref(null)
let loading = null

function start() {
  error.value = null
  loading = loadDeck(loadSettings().deckId)
    .then((m) => {
      manifest.value = m
    })
    .catch((err) => {
      console.error('[deck] 皮肤加载失败', err)
      error.value = err
      loading = null // 允许重试
    })
}

export function useDeck() {
  if (!loading && !manifest.value) start()
  return {
    manifest,
    error,
    retry: () => {
      if (!manifest.value && !loading) start()
    },
    cardUrl: (cardId) => {
      if (!manifest.value) return ''
      try {
        return cardImageUrl(manifest.value, cardId)
      } catch {
        return '' // 皮肤缺牌不在渲染期抛崩整页
      }
    },
    backUrl: () => (manifest.value ? backImageUrl(manifest.value) : '')
  }
}
