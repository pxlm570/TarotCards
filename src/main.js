import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App.vue'
import { createAppRouter } from './router/index.js'
import { initTheme } from './lib/theme.js'

// index.html 头部内联脚本已定首帧主题（防白闪）；这里接管运行期切换与系统偏好联动
initTheme()

// M4 配置分享链接契约：#import=<base64> 必须在挂载 hash 路由之前解析，
// 否则会被路由当作非法路径。M1 仅拦截清除，M4 实装"解析并写入 settings"。
if (location.hash.startsWith('#import=')) {
  history.replaceState(null, '', location.pathname + location.search)
}

// SW autoUpdate 清旧缓存后，预加载旧 hash chunk 失败：刷新自愈（Vite 内建事件）
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  location.reload()
})

const app = createApp(App)
app.use(createPinia())
app.use(createAppRouter())
app.mount('#app')
