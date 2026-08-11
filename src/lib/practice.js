// 实战课（PracticeLesson）与占卜动线的衔接：进入动线前记一个「待完成」标记，
// 解读页（InterpretationView）挂载时消费它 → 完成对应 lesson。存 sessionStorage（关标签页清空）。
const KEY = 'tarot.practice-pending.v1'

export function setPracticePending(chapterId, lessonId) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ chapterId, lessonId }))
    return true
  } catch {
    return false
  }
}

export function consumePracticePending() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const p = JSON.parse(raw)
    return p && p.chapterId && p.lessonId ? p : null
  } catch {
    return null
  }
}
