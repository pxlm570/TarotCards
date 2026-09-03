// 流式 AI 调用的统一生命周期（评审 2026-09-03 根因收口）：挂载即流（immediate）/手动 start、
// 卸载即中止、错误统一分类（空闲超时 408 给专属文案走重试，用户中止静默保留半截文本）。
// 此前 ChatStream/ClarifyDialog/HomeView/MirrorPanel 各自手搓这套生命周期，
// b2ac4a4 修了两处、同周同类代码又漏了两处——新增流式调用点一律走这里，不再手写。
import { ref, onMounted, onUnmounted } from 'vue'
import { streamChat, AI_NOT_CONFIGURED, AIError, AI_TIMEOUT_STATUS } from '../lib/ai-client.js'

export function useStream(getMessages, { immediate = false, onDone = null } = {}) {
  const text = ref('')
  const error = ref('')
  const streaming = ref(false)
  let controller = null
  let disposed = false // 卸载后不再写状态/回调

  async function start() {
    if (disposed || streaming.value) return
    text.value = ''
    error.value = ''
    streaming.value = true
    controller = new AbortController()
    try {
      for await (const delta of streamChat({ messages: getMessages(), signal: controller.signal })) {
        text.value += delta
      }
      onDone?.(text.value)
    } catch (e) {
      if (e?.name === 'AbortError') {
        // 用户主动中止不是错误：保留已生成内容
      } else if (e.message === AI_NOT_CONFIGURED) {
        error.value = '尚未配置 AI，请到「我的」页填写 key。'
      } else if (e instanceof AIError && e.status === AI_TIMEOUT_STATUS) {
        error.value = 'AI 长时间没有响应，连接已断开，可重试。'
      } else if (e instanceof AIError) {
        error.value = e.status === 401 ? '密钥无效' : e.status === 429 ? '请求过于频繁' : `请求失败（${e.status || '网络'}）`
      } else {
        error.value = '网络错误，请检查 baseUrl 或网络。'
      }
    } finally {
      streaming.value = false
      controller = null
    }
  }

  function stop() {
    controller?.abort()
  }

  if (immediate) onMounted(start)
  onUnmounted(() => {
    disposed = true
    controller?.abort()
  })

  return { text, error, streaming, start, stop }
}
