// 统一返回语义（2026-08-31 页面规划管理）：点退出/返回回到来源页——从哪里点进来的，就退回哪里。
// 站内 push 进入：history.state.back 存在 → router.back() 自然回退（不堆历史、来源页还原）；
// 直链/书签进入：back 无处可退 → replace 回兜底页，不产生死胡同。
// 注意：占卜动线内不能用这套（动线前进是 replace、返回手势会消费入口条目，back() 回不到入口），
// 动线退出走 reading store 的 entryPath（见 FlowExit 的 to 参数）。
import { useRouter } from 'vue-router'
import { tap } from '../lib/feedback.js'

export function useBack() {
  const router = useRouter()
  return (fallback = '/') => {
    tap()
    if (window.history.state?.back) router.back()
    else router.replace(fallback)
  }
}
