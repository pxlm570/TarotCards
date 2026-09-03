import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App.vue'
import { createAppRouter } from './router/index.js'
import { initTheme } from './lib/theme.js'
import { applyMotionPreference } from './lib/feedback.js'
import { setupUpdateReload } from './lib/sw-refresh.js'
import { loadSettings } from './lib/storage.js'
import { parseImportHash, stashPendingImport } from './lib/config-import.js'

// index.html 头部内联脚本已定首帧主题（防白闪）；这里接管运行期切换与系统偏好联动
initTheme()
// 把「系统偏好 + settings.reducedMotion」的判定写到 <html data-motion>，供全局 CSS 降级
applyMotionPreference()
// M5 睡前大字档：设置根字号
if (loadSettings().fontSize === 'large') document.documentElement.setAttribute('data-fontsize', 'large')

// M4 配置分享链接契约：#import=<base64> 必须在挂载 hash 路由之前处理，
// 否则会被路由当作非法路径。两段式（评审 2026-09-03）：解析暂存后带 ?import=1
// 跳设置页出「应用/放弃」确认条——不再静默写入，防伪造链接静默替换 AI 端点。
if (location.hash.startsWith('#import=')) {
  const cfg = parseImportHash(location.hash)
  if (cfg) {
    stashPendingImport(cfg)
    history.replaceState(null, '', location.pathname + location.search + '#/profile/ai?import=1')
  } else {
    history.replaceState(null, '', location.pathname + location.search)
  }
}

// SW autoUpdate 清旧缓存后，预加载旧 hash chunk 失败：刷新自愈（Vite 内建事件）
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  location.reload()
})

// 部署新版后「首次打开仍是旧界面」的根治：新 SW 接管时自动刷一次（细节见 sw-refresh.js）
setupUpdateReload()

const app = createApp(App)
app.use(createPinia())
app.use(createAppRouter())
app.mount('#app')
