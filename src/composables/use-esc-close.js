// 桌面键盘操作（Task 12）：统一 Esc 关闭弹层。挂载时监听、卸载时清理。
import { onMounted, onUnmounted } from 'vue'

export function useEscClose(closeFn) {
  const handler = (e) => {
    if (e.key === 'Escape') closeFn()
  }
  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
