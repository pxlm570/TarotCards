import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.hoisted(() => vi.resetModules())
import { saveSettings, loadSettings } from '../src/lib/storage.js'
import { applyImport } from '../src/lib/backup.js'
import { useLearningStore } from '../src/stores/learning.js'
import { listCustomSpreads } from '../src/lib/custom-spreads.js'
import { useReadingStore } from '../src/stores/reading.js'
import { articleSteps, chapters } from '../src/lib/learning-path.js'

beforeEach(() => {localStorage.clear();sessionStorage.clear();setActivePinia(createPinia())})
describe('评审：数据与会话边界', () => {
 it('更换端点清除旧密钥，同端点格式变化或修改模型保留密钥', () => {
  saveSettings({baseUrl:'https://a.test/v1',apiKey:'old',model:'m'})
  saveSettings({baseUrl:'https://a.test/v1/'})
  expect(loadSettings().apiKey).toBe('old')
  saveSettings({baseUrl:'https://b.test/v1'})
  expect(loadSettings().apiKey).toBe('')
  saveSettings({baseUrl:'https://c.test/v1',apiKey:'new'})
  expect(loadSettings().apiKey).toBe('new')
 })
 it('坏备份嵌套条目不会使学习和牌阵读取崩溃', () => {
  applyImport({data:{'tarot.learning.v1':{unlocked:['ch-01','unknown'],progress:{'ch-01':null},sr:{unknown:null}},'tarot.custom-spreads.v1':[null,{id:'custom-x',name:'坏阵'}]}})
  expect(useLearningStore().totalDoneCount).toBe(0)
  expect(useLearningStore().dueFlashcards()).toEqual([])
  expect(listCustomSpreads()).toEqual([])
 })
 it('本地读取也校验嵌套数据，不仅依赖导入入口', () => {
  localStorage.setItem('tarot.learning.v1',JSON.stringify({unlocked:['ch-01'],progress:{'ch-01':null}}))
  localStorage.setItem('tarot.custom-spreads.v1','[null]')
  expect(useLearningStore().totalDoneCount).toBe(0)
  expect(listCustomSpreads()).toEqual([])
 })
 it('导入记录过滤未知牌，文本坏值归一，坏生日不进入本命牌计算', () => {
  applyImport({ data: {
   'tarot.journal.v1': { readings: [{ id:'r',ts:1,cards:[{cardId:'unknown'}],question:42,note:[] }],dailyDraws:{} },
   'tarot.profile.v1': { xp:1,birthday:'not-a-date' }
  }})
  const record=JSON.parse(localStorage.getItem('tarot.journal.v1')).readings[0]
  expect(record.cards).toEqual([])
  expect(record.question).toBe('')
  expect(record.note).toBe('')
  expect(JSON.parse(localStorage.getItem('tarot.profile.v1')).birthday).toBe('')
 })
 it('实战任务属于当前 flow，刷新恢复保留，作废后不带到新局', () => {
  const reading=useReadingStore()
  reading.startPractice('ch-01','ch-01-l5','single')
  setActivePinia(createPinia())
  const restored=useReadingStore()
  expect(restored.tryRestore()).toBe(true)
  expect(restored.practiceTask).toEqual({chapterId:'ch-01',lessonId:'ch-01-l5',spreadId:'single'})
  expect(restored.consumePractice()).toBeNull()
  restored.reset()
  expect(restored.practiceTask).toBeNull()
 })
 it('只有完成对应实战局才消费任务，且只能消费一次', () => {
  const reading=useReadingStore()
  reading.startPractice('ch-01','ch-01-l5','single')
  reading.submitQuestion('今天关注什么',null)
  reading.finishShuffle();reading.pickAll();reading.revealAll();reading.goInterpret()
  expect(reading.consumePractice()?.lessonId).toBe('ch-01-l5')
  expect(reading.consumePractice()).toBeNull()
 })
 it('愚人段落绑定愚人插图，不轮换为世界', () => {
  const steps=articleSteps(chapters[1].lessons[0].blocks)
  const step=steps.find(s=>s.block.text?.startsWith('愚人代表'))
  expect(step.cards.map(c=>c.cardId)).toContain('major-00')
 })
})
