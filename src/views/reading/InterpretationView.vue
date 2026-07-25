<script setup>
// 解读页：牌阵缩略全景导航 + 每位置折叠卡（一句话解读→展开全文）+ 领域短句兜底隐藏
//        + 练习模式（静态，先写自己的理解再对比官方）+ 感想（M1 仅内存）+ 详情弹层。
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import cardsData from '../../data/cards.json'
import { useReadingStore } from '../../stores/reading.js'
import { useDeck } from '../../lib/use-deck.js'
import SpreadCanvas from '../../components/SpreadCanvas.vue'

const DOMAIN_LABEL = { love: '感情', career: '事业', wealth: '财运', study: '学业' }

const router = useRouter()
const store = useReadingStore()
const { cardUrl } = useDeck()

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
  noteSaved.value = true // M1 仅内存留存；M3 落日记库
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

    <div class="overview">
      <SpreadCanvas
        v-if="store.spread"
        :spread="store.spread"
        :cards="store.drawn"
        :revealed="null"
        readonly
        :portrait="store.cardCount > 5"
        :card-width-pct="store.cardCount > 5 ? 12 : 14"
        @inspect="jumpTo"
      />
      <p class="overview-hint">点牌面跳到对应解读</p>
    </div>

    <div class="practice-bar">
      <button v-if="!practiceMode" class="practice-btn" @click="startPractice">
        ✍️ 练习模式：先写下我的理解
      </button>
    </div>

    <section v-if="practiceMode" class="practice">
      <p class="practice-tip">先凭直觉写下你对这组牌的理解，再展开官方解读对比：</p>
      <textarea v-model="practiceText" rows="4" class="practice-input" placeholder="我看到的画面是……我的直觉是……" />
      <button v-if="!practiceRevealed" class="practice-reveal" @click="practiceRevealed = true">
        写好了，展开官方解读
      </button>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="cards">
      <article v-for="item in items" :id="`pos-${item.positionKey}`" :key="item.positionKey" class="pos-card">
        <button class="pos-head" @click="toggle(item.positionKey)">
          <img v-if="cardUrl(item.cardId)" class="thumb" :src="cardUrl(item.cardId)" :class="{ reversed: item.reversed }" alt="" />
          <div v-else class="thumb thumb-fallback" />
          <div class="pos-main">
            <p class="pos-label">{{ item.position.label }} · {{ item.position.meaning }}</p>
            <p class="card-name">
              {{ item.card.name }}
              <span class="orientation" :class="{ rev: item.reversed }">{{ item.reversed ? '逆位' : '正位' }}</span>
            </p>
            <div class="kw">
              <span v-for="k in item.keywords" :key="k" class="kw-chip">{{ k }}</span>
            </div>
            <p class="brief" v-if="!expanded.has(item.positionKey)">{{ item.brief }}</p>
          </div>
          <span class="chevron" :class="{ open: expanded.has(item.positionKey) }">▾</span>
        </button>

        <div v-if="expanded.has(item.positionKey)" class="pos-body">
          <p class="meaning">{{ item.meaning }}</p>
          <p v-if="item.domainText" class="domain">
            <span class="domain-tag">{{ DOMAIN_LABEL[store.domain] }}</span>{{ item.domainText }}
          </p>
          <button class="more" @click="detail = item">查看这张牌的完整资料</button>
        </div>
      </article>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="synthesis">
      <h2 class="syn-title">🕯️ 整体串联</h2>
      <p class="syn-body">
        先看每个位置的含义，再找牌与牌之间的呼应：同花色多，说明能量集中在一个领域；大牌多，说明这件事对你意义重大；
        正逆位的分布，暗示顺流与阻力的位置。试着把它们串成一个故事——这正是塔罗解读的核心练习。
      </p>
      <p class="syn-hint">AI 深度解读将在里程碑 M4 加入，把这些牌为你串成完整叙事。</p>
    </section>

    <section v-show="!practiceMode || practiceRevealed" class="note-area">
      <h2 class="note-title">📝 此刻的感想</h2>
      <textarea v-model="note" rows="3" class="note-input" placeholder="记录此刻的直觉与情绪（日记功能将在 M3 保存它们）" @input="noteSaved = false" />
      <div class="note-actions">
        <button class="note-save" :disabled="!note.trim() || noteSaved" @click="saveNote">
          {{ noteSaved ? '已记下' : '记下' }}
        </button>
        <button class="again" @click="again">再来一次</button>
      </div>
    </section>

    <div v-if="detail" class="modal" @click.self="detail = null">
      <div class="modal-card">
        <img v-if="cardUrl(detail.cardId)" class="modal-img" :src="cardUrl(detail.cardId)" :class="{ reversed: detail.reversed }" alt="" />
        <h3 class="modal-name">{{ detail.card.name }} {{ detail.card.nameEn }}</h3>
        <p class="modal-meta">
          {{ detail.card.arcana === 'major' ? '大阿尔克那' : '小阿尔克那' }}
          <template v-if="detail.card.element"> · {{ detail.card.element }}</template>
          <template v-if="detail.card.astro"> · {{ detail.card.astro }}</template>
        </p>
        <div class="modal-sec">
          <h4>正位</h4>
          <p>{{ detail.card.meaning.upright }}</p>
        </div>
        <div class="modal-sec">
          <h4>逆位</h4>
          <p>{{ detail.card.meaning.reversed }}</p>
        </div>
        <div v-if="detail.card.symbols" class="modal-sec">
          <h4>牌面符号</h4>
          <p>{{ detail.card.symbols }}</p>
        </div>
        <button class="modal-close" @click="detail = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interp {
  padding: 32px 18px calc(40px + env(safe-area-inset-bottom, 0px));
}

.head {
  text-align: center;
  margin-bottom: 18px;
}

.title {
  font-size: 1.25rem;
}

.question {
  margin-top: 8px;
  color: var(--moon-dim);
  font-size: 0.875rem;
}

.overview {
  background: var(--bg-inset);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 18px;
}

.overview-hint {
  text-align: center;
  font-size: 0.75rem;
  color: var(--moon-dim);
  margin-top: 6px;
}

.practice-bar {
  margin-bottom: 18px;
}

.practice-btn {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-card);
  border: 1px dashed var(--violet);
  background: none;
  color: var(--violet);
  font-family: var(--sans);
  font-size: 0.9375rem;
  cursor: pointer;
}

.practice {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 18px;
}

.practice-tip {
  font-size: 0.875rem;
  color: var(--moon-dim);
  margin-bottom: 10px;
  line-height: 1.8;
}

.practice-input {
  width: 100%;
  background: var(--bg-inset);
  border: none;
  border-radius: 8px;
  padding: 12px;
  color: var(--moon);
  font-family: var(--sans);
  font-size: 1rem; /* ≥16px 防 iOS 聚焦自动放大 */
  line-height: 1.7;
  resize: none;
}

.practice-reveal {
  margin-top: 12px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: var(--violet);
  color: var(--bg-deep); /* 暗色 #14162E/#7F77DD ≈4.8:1，浅色 #F5F3EC/#5A51B8 ≈5.2:1 */
  font-family: var(--sans);
  cursor: pointer;
}

.pos-card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
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
  color: var(--moon);
  font-family: var(--sans);
}

.thumb {
  width: 52px;
  border-radius: 4px;
  align-self: flex-start;
  flex-shrink: 0;
}

.thumb.reversed,
.modal-img.reversed {
  transform: rotate(180deg);
}

.thumb-fallback {
  aspect-ratio: 300 / 527;
  border-radius: 4px;
  background: linear-gradient(135deg, var(--bg-inset), var(--bg-deep));
}

.pos-main {
  flex: 1;
  min-width: 0;
}

.pos-label {
  font-size: 0.75rem;
  color: var(--moon-dim);
  margin-bottom: 4px;
}

.card-name {
  font-size: 1.0625rem;
  margin-bottom: 6px;
}

.orientation {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(184, 145, 47, 0.16);
  color: var(--gold-bright);
  vertical-align: 2px;
  margin-left: 6px;
}

.orientation.rev {
  background: rgba(127, 119, 221, 0.18);
  color: var(--violet);
}

.kw {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.kw-chip {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-inset);
  color: var(--moon-dim);
}

.brief {
  font-size: 0.875rem;
  color: var(--moon-dim);
  line-height: 1.7;
}

.chevron {
  color: var(--moon-dim);
  transition: transform 0.25s;
  align-self: center;
}

.chevron.open {
  transform: rotate(180deg);
}

.pos-body {
  padding: 0 14px 16px 78px;
}

.meaning {
  font-size: 0.9375rem;
  line-height: 1.9;
  margin-bottom: 10px;
}

.domain {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--moon-dim);
  margin-bottom: 10px;
}

.domain-tag {
  display: inline-block;
  font-size: 0.6875rem;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--gold);
  color: var(--gold-bright);
  margin-right: 6px;
}

.more {
  background: none;
  border: none;
  color: var(--violet);
  font-size: 0.8125rem;
  font-family: var(--sans);
  cursor: pointer;
  padding: 12px 0; /* 触控目标：唯一的详情弹层入口 */
}

.synthesis {
  background: var(--bg-inset);
  border-radius: var(--radius-card);
  padding: 16px;
  margin: 20px 0;
}

.syn-title {
  font-size: 1rem;
  margin-bottom: 10px;
}

.syn-body {
  font-size: 0.9375rem;
  line-height: 1.9;
  margin-bottom: 10px;
}

.syn-hint {
  font-size: 0.75rem;
  color: var(--moon-dim);
}

.note-area {
  margin-top: 8px;
}

.note-title {
  font-size: 1rem;
  margin-bottom: 10px;
}

.note-input {
  width: 100%;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-card);
  padding: 12px;
  color: var(--moon);
  font-family: var(--sans);
  font-size: 1rem; /* ≥16px 防 iOS 聚焦自动放大 */
  line-height: 1.7;
  resize: none;
}

.note-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.note-save {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--gold);
  border-radius: var(--radius-card);
  background: none;
  color: var(--gold-bright);
  font-family: var(--sans);
  cursor: pointer;
}

.note-save:disabled {
  opacity: 0.45;
  cursor: default;
}

.again {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: var(--radius-card);
  background: var(--gold);
  color: var(--on-gold);
  font-family: var(--sans);
  cursor: pointer;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(10, 11, 26, 0.78);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 30;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--bg-card);
  border-radius: 16px 16px 0 0;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  text-align: center;
}

.modal-img {
  width: 110px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.modal-name {
  font-size: 1.125rem;
  margin-bottom: 4px;
}

.modal-meta {
  font-size: 0.8125rem;
  color: var(--moon-dim);
  margin-bottom: 16px;
}

.modal-sec {
  text-align: left;
  margin-bottom: 14px;
}

.modal-sec h4 {
  font-size: 0.875rem;
  color: var(--gold-bright);
  margin-bottom: 6px;
}

.modal-sec p {
  font-size: 0.9375rem;
  line-height: 1.9;
}

.modal-close {
  margin-top: 8px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--radius-card);
  background: var(--bg-inset);
  color: var(--moon);
  font-family: var(--sans);
  cursor: pointer;
}
</style>
