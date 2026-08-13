// 当前牌面（face）与牌背（back）的加载单例。牌面与牌背可自由组合：
//  - faceId（settings.deckId）：用哪套牌面图（如 rws / rws-sepia）
//  - backId（settings.backId）：用哪张独立牌背（如 星纹·暖金 / 霓虹壁画）
import { ref } from 'vue'
import { loadDeck, cardImageUrl, standaloneBackUrl, listBacks } from './deck-loader.js'
import { loadSettings, saveSettings } from './storage.js'

const faceId = ref(loadSettings().deckId || 'rws')
const manifest = ref(null)
const error = ref(null)
let loading = null

const backId = ref(loadSettings().backId || 'star-gold')
const backItem = ref(null)
let backsLoading = null

function loadFace() {
  error.value = null
  loading = loadDeck(faceId.value)
    .then((m) => {
      manifest.value = m
    })
    .catch((err) => {
      console.error('[deck] 牌面加载失败', err)
      error.value = err
      loading = null // 允许重试
    })
}

function loadBack() {
  if (backsLoading) return
  if (backItem.value && backItem.value.id === backId.value) return
  backItem.value = null
  backsLoading = listBacks()
    .then((list) => {
      backItem.value = list.find((b) => b.id === backId.value) || list[0] || null
    })
    .catch(() => {
      backItem.value = null
    })
    .finally(() => {
      backsLoading = null
    })
}

export function useDeck() {
  if (!loading && !manifest.value) loadFace()
  loadBack()
  return {
    faceId,
    manifest,
    backId,
    backItem,
    error,
    retry: () => {
      if (!manifest.value && !loading) loadFace()
    },
    // 换牌面（牌背保持独立）
    switchFace: (id) => {
      if (id === faceId.value && manifest.value) return
      faceId.value = id
      manifest.value = null
      error.value = null
      loading = null
      saveSettings({ deckId: id })
      loadFace()
    },
    // 换牌背（牌面保持独立）
    switchBack: (id) => {
      if (id === backId.value && backItem.value?.id === id) return
      backId.value = id
      saveSettings({ backId: id })
      loadBack()
    },
    cardUrl: (cardId) => {
      if (!manifest.value) return ''
      try {
        return cardImageUrl(manifest.value, cardId)
      } catch {
        return '' // 皮肤缺牌不在渲染期抛崩整页
      }
    },
    backUrl: () => (backItem.value ? standaloneBackUrl(backItem.value) : '')
  }
}
