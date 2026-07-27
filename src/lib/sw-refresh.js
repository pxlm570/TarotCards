// 部署新版后「首次打开仍是旧界面」的根治（2026-07-27）。
//
// 现象：Service Worker 是离线优先——本次打开的页面由**旧 SW** 从预缓存直接给出。
// 新 SW 虽然 skipWaiting + clientsClaim 立刻接管，却不会刷新已经渲染好的页面，
// 用户得再开一次才看到新版（部署后第一次访问永远看到旧界面）。
//
// 做法：监听「接管者换人」（controllerchange），自动刷一次。
export function setupUpdateReload({
  container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  reload = () => location.reload(),
  // 正在打字就别刷：问题/感想输入框的内容还没落盘，刷了就没了。
  // 跳过也不亏——新 SW 已经接管，下次打开自然是新版。
  isTyping = () => {
    const tag = typeof document !== 'undefined' ? document.activeElement?.tagName : null
    return tag === 'TEXTAREA' || tag === 'INPUT'
  }
} = {}) {
  if (!container || typeof container.addEventListener !== 'function') return false

  // 首次安装时 controller 为 null，claim 也会触发 controllerchange——那次不该刷
  const hadController = Boolean(container.controller)
  let reloaded = false

  container.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    if (isTyping()) return
    reloaded = true // 只刷一次，杜绝循环
    reload()
  })
  return true
}
