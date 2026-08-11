// 当前皮肤的 manifest 单例加载（全部取图组件共用）。
// 失败时暴露 error + retry：已挂载视图靠 retry 恢复，不然会永久空白牌面。
// switchDeck：M2 皮肤切换（settings.deckId 变化后强制重载——manifest 是响应式 ref，
// 视图通过 cardUrl/backUrl 自动更新，无需组件自行重建）。
import { ref } from 'vue'
import { loadDeck, cardImageUrl, backImageUrl } from './deck-loader.js'
import { loadSettings, saveSettings } from './storage.js'

const deckId = ref(loadSettings().deckId)
const manifest = ref(null)
const error = ref(null)
let loading = null

function start() {
  error.value = null
  loading = loadDeck(deckId.value)
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
    deckId,
    manifest,
    error,
    retry: () => {
      if (!manifest.value && !loading) start()
    },
    // 切换到另一套皮肤：写 settings.deckId 并重载 manifest
    switchDeck: (id) => {
      if (id === deckId.value && manifest.value) return
      deckId.value = id
      manifest.value = null
      error.value = null
      loading = null
      saveSettings({ deckId: id })
      start()
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
