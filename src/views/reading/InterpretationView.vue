<script setup>
// 解读页：牌阵缩略全景导航 + 每位置折叠卡（一句话解读→展开全文）+ 领域短句兜底隐藏
//        + 练习模式（静态，先写自己的理解再对比官方）+ 感想（M1 仅内存）+ 详情弹层。
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../../data/cards.json'
import { useReadingStore } from '../../stores/reading.js'
import { useLearningStore } from '../../stores/learning.js'
import { useJournalStore } from '../../stores/journal.js'
import { useProfileStore } from '../../stores/profile.js'
import { consumePracticePending } from '../../lib/practice.js'
import { currentDayKey } from '../../lib/day-key.js'
import { useDeck } from '../../lib/use-deck.js'
import SpreadCanvas from '../../components/SpreadCanvas.vue'
import AppIcon from '../../components/AppIcon.vue'
import CardDetailSheet from '../../components/CardDetailSheet.vue'
import { tap, success, toast } from '../../lib/feedback.js'

const DOMAIN_LABEL = { love: '感情', career: '事业', wealth: '财运', study: '学业' }

const router = useRouter()
const store = useReadingStore()
const { cardUrl } = useDeck()
const learning = useLearningStore()
const journal = useJournalStore()
const profile = useProfileStore()

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  }
}

// 翻牌完成即自动落一条记录（一局只存一次，靠 store.journalId 幂等）
function ensureSaved() {
  const build = (id) => ({
    id,
    ts: Date.now(),
    spreadId: store.spreadId,
    question: store.question,
    domain: store.domain,
    cards: store.drawn.map((d) => ({ cardId: d.cardId, positionKey: d.positionKey, reversed: d.reversed })),
    note: note.value,
    isDaily: store.isDaily
  })
  let id = store.journalId
  if (!id) {
    id = newId()
    journal.addReading(build(id))
    store.journalId = id
    store.persistNow()
    profile.addXp(10) // 完成一次占卜
    if (store.isDaily) profile.addXp(5) // 每日一抽
  } else if (!journal.getById(id)) {
    journal.addReading(build(id))
  }
  // 每日一抽：写入当天打卡（凌晨 4 点分界）
  if (store.isDaily) {
    const day = currentDayKey()
    journal.markDaily(day, id)
  }
}

// 实战课（M2）回来自动打勾 + 本局落库（M3）
onMounted(() => {
  ensureSaved()
  const p = consumePracticePending()
  if (p) {
    try {
      learning.completeLesson(p.chapterId, p.lessonId)
      toast('实战完成，本课已打勾', 'success')
    } catch {
      /* 章节未解锁等异常：静默 */
    }
  }
})

const cardById = new Map(cardsData.map((c) => [c.id, c]))

// 首句提取不用 lookbehind 正则：Safari 16.0-16.3 运行时 new RegExp 抛 SyntaxError 会白屏
function firstSentence(text) {
  const i = text.search(/[。！？]/)
  return i === -1 ? text : text.slice(0, i + 1)
}

const items = computed(() =>
  store.drawn.map((d) => {
    const card = cardById.get(d.cardId)
    const position = store.spread.positions.find((p) => p.key === d.positionKey)
    const meaning = d.reversed ? card.meaning.reversed : card.meaning.upright
    return {
      ...d,
      card,
      position,
      keywords: d.reversed ? card.keywords.reversed : card.keywords.upright,
      meaning,
      brief: firstSentence(meaning),
      domainText:
        store.domain && card.domains?.[store.domain]
          ? card.domains[store.domain][d.reversed ? 'reversed' : 'upright']
          : null
    }
  })
)

// 缩略全景同理：单张牌阵放大，否则一张小邮票躺在空卡片里
const overviewPct = computed(() =>
  store.cardCount > 5 ? 12 : store.cardCount === 1 ? 26 : 14
)

const expanded = ref(new Set())
const practiceMode = ref(false)
const practiceText = ref('')
const practiceRevealed = ref(false)
const note = ref('')
const noteSaved = ref(false)
const detail = ref(null) // 详情弹层展示的 item

function toggle(key) {
  const next = new Set(expanded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expanded.value = next
  tap()
}

async function jumpTo(card) {
  // 练习模式折叠官方解读时，先展开再跳，否则 scrollIntoView 对隐藏元素是 no-op
  if (practiceMode.value && !practiceRevealed.value) {
    practiceRevealed.value = true
    await nextTick()
  }
  document.getElementById(`pos-${card.positionKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function startPractice() {
  practiceMode.value = true
  practiceRevealed.value = false
}

function saveNote() {
  // M3 落日记库：补写当前记录的感想
  if (store.journalId) journal.saveNote(store.journalId, note.value)
  if (!noteSaved.value) profile.addXp(5) // 首次写日记感想
  noteSaved.value = true
  success()
  toast('已记下', 'success')
}

function again() {
  const unsaved = (note.value.trim() && !noteSaved.value) || practiceText.value.trim()
  if (unsaved && !window.confirm('你写下的感想/练习理解还没有保存，开始新的占卜将丢失它们。确定吗？')) {
    return
  }
  store.reset()
  router.replace('/')
}
</script>

<template>
  <div class="interp">
    <header class="head">
      <h1 class="title">{{ store.spread?.name }} · 解读</h1>
      <p v-if="store.question" class="question">「{{ store.question }}」</p>
    </header>

    <div class="overview card">
      <SpreadCanvas
        v-if="store.spread"
        :spread="store.spread"
        :cards="store.drawn"
        :revealed="null"
        readonly
        :portrait="store.cardCount > 5"
        :card-width-pct="overviewPct"
        @inspect="jumpTo"
      />
      <p class="overview-hint">点牌面跳到对应解读</p>
    </div>

    <div class="practice-bar">
      <button v-if="!practiceMode" class="practice-btn card-dashed" @click="startPractice">
        <AppIcon name="pen" :size="18" />
        <span>练习模式：先写下我的理解</span>
      </button>
    </div>

    <section v-if="practiceMode" class="practice card">
      <p class="practice-tip">先凭直觉写下你对这组牌的理解，再展开官方解读对比：</p>
      <textarea v-model="practiceText" rows="4" class="practice-input" placeholder="我看到的画面是……我的直觉是……" />
      <button v-if="!practiceRevealed" class="practice-reveal btn-solid btn-block" @click="practiceRevealed = true">
        写好了，展开官方解读
      </button>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="cards">
      <article
        v-for="(item, i) in items"
        :id="`pos-${item.positionKey}`"
        :key="item.positionKey"
        class="pos-card card stagger-item"
        :style="{ '--i': i }"
      >
        <button class="pos-head" @click="toggle(item.positionKey)">
          <img v-if="cardUrl(item.cardId)" class="thumb" :src="cardUrl(item.cardId)" :class="{ reversed: item.reversed }" alt="" />
          <div v-else class="thumb thumb-fallback skeleton" />
          <div class="pos-main">
            <p class="pos-label">{{ item.position.label }} · {{ item.position.meaning }}</p>
            <p class="card-name">
              {{ item.card.name }}
              <span class="orientation badge" :class="{ 'badge-plain': item.reversed }">
                {{ item.reversed ? '逆位' : '正位' }}
              </span>
            </p>
            <div class="kw">
              <span v-for="k in item.keywords" :key="k" class="tag-kw">{{ k }}</span>
            </div>
            <p class="brief" v-if="!expanded.has(item.positionKey)">{{ item.brief }}</p>
          </div>
          <AppIcon
            class="chevron"
            :class="{ open: expanded.has(item.positionKey) }"
            name="chevron"
            :size="18"
          />
        </button>

        <div v-if="expanded.has(item.positionKey)" class="pos-body">
          <p class="meaning">{{ item.meaning }}</p>
          <p v-if="item.domainText" class="domain">
            <span class="domain-tag badge">{{ DOMAIN_LABEL[store.domain] }}</span>{{ item.domainText }}
          </p>
          <button class="more btn-text" @click="detail = item">查看这张牌的完整资料</button>
        </div>
      </article>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="synthesis card">
      <h2 class="syn-title"><AppIcon name="sparkle" :size="19" /> 整体串联</h2>
      <p class="syn-body">
        先看每个位置的含义，再找牌与牌之间的呼应：同花色多，说明能量集中在一个领域；大牌多，说明这件事对你意义重大；
        正逆位的分布，暗示顺流与阻力的位置。试着把它们串成一个故事——这正是塔罗解读的核心练习。
      </p>
      <p class="syn-hint">AI 深度解读将在里程碑 M4 加入，把这些牌为你串成完整叙事。</p>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="note-area">
      <h2 class="note-title"><AppIcon name="note" :size="19" /> 此刻的感想</h2>
      <textarea v-model="note" rows="3" class="note-input" placeholder="记录此刻的直觉与情绪（日记功能将在 M3 保存它们）" @input="noteSaved = false" />
      <div class="note-actions">
        <button
          class="note-save btn-ghost"
          :class="{ pop: noteSaved }"
          :disabled="!note.trim() || noteSaved"
          @click="saveNote"
        >
          {{ noteSaved ? '已记下' : '记下' }}
        </button>
        <button class="again btn-solid" @click="again">再来一次</button>
      </div>
    </section>

    <CardDetailSheet v-if="detail" :card="detail.card" :reversed="detail.reversed" @close="detail = null" />
  </div>
</template>

<style scoped>
.interp {
  padding: var(--sp-4) 18px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  text-align: center;
  margin-bottom: 18px;
}

.title {
  font-size: 1.1875rem;
}

.question {
  margin-top: var(--sp-1);
  color: var(--dim);
  font-size: var(--fs-note);
}

.overview {
  padding: 12px;
  margin-bottom: 18px;
}

.overview-hint {
  text-align: center;
  font-size: 0.75rem;
  color: var(--dim);
  margin-top: 6px;
}

.practice-bar {
  margin-bottom: 18px;
}

.practice-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  padding: 13px;
  font-family: var(--sans);
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--t-press) var(--ease-out), border-color var(--t-press);
}

.practice-btn:active {
  transform: scale(0.98);
  border-color: var(--gold-deep);
}

.practice {
  padding: var(--sp-2);
  margin-bottom: 18px;
}

.practice-tip {
  font-size: var(--fs-note);
  color: var(--dim);
  margin-bottom: 10px;
  line-height: 1.8;
}

.practice-input {
  width: 100%;
  background: var(--sunk);
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem; /* ≥16px 防 iOS 聚焦自动放大 */
  line-height: 1.8;
  resize: none;
  transition: border-color var(--t-fast);
}

.practice-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.practice-reveal {
  margin-top: 12px;
}

.pos-card {
  margin-bottom: 14px;
  overflow: hidden;
}

.pos-head {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--ink);
  -webkit-tap-highlight-color: transparent;
  transition: background var(--t-press);
}

.pos-head:active {
  background: var(--sunk);
}

/* 签名元素：缩略牌像实体牌摊在桌上——微旋 + 落影 */
.thumb {
  width: 54px;
  border-radius: var(--radius-img);
  align-self: flex-start;
  flex-shrink: 0;
  transform: rotate(-2.5deg);
  box-shadow: var(--shadow-card);
}

.thumb.reversed,
.modal-img.reversed {
  transform: rotate(180deg);
}

.thumb-fallback {
  aspect-ratio: 300 / 527;
}

.pos-main {
  flex: 1;
  min-width: 0;
}

.pos-label {
  font-size: 0.75rem;
  font-weight: var(--w-medium);
  color: var(--dim);
  margin-bottom: 4px;
}

.card-name {
  font-size: var(--fs-head);
  font-weight: var(--w-title);
  margin-bottom: 6px;
}

/* 正位 = 金（荣誉/当前项）；逆位 = 中性（紫色已废除） */
.orientation {
  font-size: 0.6875rem;
  padding: 2px 9px;
  vertical-align: 2px;
  margin-left: 6px;
}

.kw {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--sp-1);
}

.brief {
  font-size: var(--fs-note);
  color: var(--dim);
  line-height: 1.7;
}

.chevron {
  color: var(--dim);
  transition: transform var(--t-fast) var(--ease-out);
  align-self: center;
}

.chevron.open {
  transform: rotate(180deg);
}

.pos-body {
  padding: 0 14px 16px 80px;
}

.meaning {
  font-size: var(--fs-body);
  line-height: 1.9;
  margin-bottom: 10px;
}

.domain {
  font-size: var(--fs-note);
  line-height: 1.8;
  color: var(--dim);
  margin-bottom: 6px;
}

.domain-tag {
  font-size: 0.6875rem;
  padding: 1px 9px;
  margin-right: 6px;
}

.more {
  color: var(--gold-text);
  padding: 12px 0; /* 触控目标：唯一的详情弹层入口 */
}

.more:active {
  color: var(--gold-deep);
}

.synthesis {
  padding: var(--sp-2);
  margin: 20px 0;
}

/* 区块标记图标是装饰，按金色纪律用中性色 */
.syn-title,
.note-title {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-head);
  margin-bottom: 10px;
}

.syn-title :deep(.app-icon),
.note-title :deep(.app-icon) {
  color: var(--dim);
}

.syn-body {
  font-size: var(--fs-body);
  line-height: 1.9;
  margin-bottom: 10px;
}

.syn-hint {
  font-size: 0.75rem;
  color: var(--dim);
}

.note-area {
  margin-top: var(--sp-1);
}

.note-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius-btn);
  padding: 12px;
  color: var(--ink);
  font-size: 1rem; /* ≥16px 防 iOS 聚焦自动放大 */
  line-height: 1.8;
  resize: none;
  transition: border-color var(--t-fast);
}

.note-input:focus {
  outline: none;
  border-color: var(--gold-deep);
}

.note-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.note-save,
.again {
  flex: 1;
  padding: 13px;
  font-size: var(--fs-body);
}
</style>
