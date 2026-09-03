<script setup>
// 自定义牌阵编辑器（v1.5 Task 5）：画布点按放牌位、拖动微调位置、就地命名；
// 保存进 custom-spreads 库。路由刻意放 /spread-editor 而非 /reading/*（动线守卫会弹回）。
// ?id=custom-x 进编辑模式；保存/退出回 /spreads。中途退出带脏检查（FlowExit beforeExit）。
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowExit from '../components/FlowExit.vue'
import { saveCustomSpread, getCustomSpread } from '../lib/custom-spreads.js'
import { tap, toast } from '../lib/feedback.js'

const route = useRoute()
const router = useRouter()

const MAX_POS = 10
const CLAMP = { min: 5, max: 95 }

const name = ref('')
// 行带稳定 key（评审 2026-09-03）：编辑删位后幸存行 key 不变，历史记录的 positionKey 不漂移；
// 新加的行分配当前最大编号 +1。key 对编辑器不透明，保存时随行交给数据层校验。
const positions = ref([]) // {key, label, meaning, x, y}
const selected = ref(-1)
const editId = ref(null)
const initialSnapshot = ref('')

onMounted(() => {
  const id = route.query.id
  if (id) {
    const found = getCustomSpread(id)
    if (found) {
      editId.value = found.id
      name.value = found.name
      positions.value = found.positions.map((p) => ({ key: p.key, label: p.label, meaning: p.meaning, x: p.x, y: p.y }))
    } else {
      toast('要编辑的牌阵不存在', 'warn')
    }
  }
  initialSnapshot.value = snapshot()
})

function snapshot() {
  return JSON.stringify({ name: name.value.trim(), positions: positions.value })
}
const dirty = computed(() => snapshot() !== initialSnapshot.value)
const canSave = computed(() => positions.value.length > 0 && name.value.trim().length > 0)

// ---- 画布交互：空白处点按=加牌位；牌位拖动=挪位；牌位原地点按=选中编辑 ----
const canvasEl = ref(null)
let dragIndex = -1
let dragMoved = false

function canvasPoint(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  const clamp = (v) => Math.min(CLAMP.max, Math.max(CLAMP.min, v))
  return {
    x: clamp(((e.clientX - rect.left) / rect.width) * 100),
    y: clamp(((e.clientY - rect.top) / rect.height) * 100)
  }
}

function nextKey() {
  let max = 0
  for (const p of positions.value) {
    const m = /^p(\d+)$/.exec(p.key ?? '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `p${max + 1}`
}

function onCanvasDown(e) {
  if (e.target !== canvasEl.value) return
  if (positions.value.length >= MAX_POS) {
    toast(`最多 ${MAX_POS} 个牌位`, 'warn')
    return
  }
  const pt = canvasPoint(e)
  positions.value.push({ key: nextKey(), label: `牌位 ${positions.value.length + 1}`, meaning: '', x: pt.x, y: pt.y })
  selected.value = positions.value.length - 1
  tap()
}

function onPosDown(i, e) {
  if (dragIndex >= 0) return // 已有指针在拖：忽略第二指，防跨牌位状态串扰（评审 2026-09-03）
  dragIndex = i
  dragMoved = false
  e.currentTarget.setPointerCapture?.(e.pointerId)
  e.stopPropagation()
}
function onPosMove(e) {
  if (dragIndex < 0) return
  const pt = canvasPoint(e)
  const pos = positions.value[dragIndex]
  if (Math.abs(pt.x - pos.x) > 0.3 || Math.abs(pt.y - pos.y) > 0.3) dragMoved = true
  pos.x = pt.x
  pos.y = pt.y
}
function onPosUp() {
  if (dragIndex >= 0 && !dragMoved) selected.value = dragIndex
  dragIndex = -1
}

function removeSelected() {
  if (selected.value < 0) return
  positions.value.splice(selected.value, 1)
  selected.value = -1
  tap()
}

function save() {
  try {
    const saved = saveCustomSpread({
      id: editId.value ?? undefined,
      name: name.value,
      positions: positions.value
    })
    toast(editId.value ? '牌阵已更新' : `已保存「${saved.name}」`, 'success')
    tap()
    router.replace('/spreads')
  } catch (err) {
    toast(String(err.message ?? err).replace('[custom-spread] ', ''), 'warn')
  }
}
</script>

<template>
  <div class="editor-page">
    <!-- 智能返回：编辑器只从选牌阵页进入，返回即回选牌阵；reset=false：编辑牌阵不作废进行中的一局 -->
    <FlowExit :confirm="false" :reset="false" :before-exit="() => dirty" label="退出编辑" fallback="/spreads" />

    <header class="head">
      <h1 class="title">{{ editId ? '编辑牌阵' : '新建牌阵' }}</h1>
      <p class="subtitle">点画布放牌位，拖动调整位置；牌位可点选命名</p>
    </header>

    <label class="field">
      <span class="field-label">牌阵名称</span>
      <input
        v-model="name"
        class="name-input"
        type="text"
        maxlength="12"
        placeholder="比如：三张速览"
      />
    </label>

    <div
      ref="canvasEl"
      class="canvas"
      @pointerdown="onCanvasDown"
    >
      <button
        v-for="(pos, i) in positions"
        :key="i"
        class="pos-chip"
        :class="{ selected: i === selected }"
        :style="{ left: pos.x + '%', top: pos.y + '%' }"
        @pointerdown="onPosDown(i, $event)"
        @pointermove="onPosMove"
        @pointerup="onPosUp"
        @pointercancel="onPosUp"
      >
        <span class="pos-index">{{ i + 1 }}</span>{{ pos.label }}
      </button>
      <p v-if="!positions.length" class="canvas-hint">点这里放下第一个牌位</p>
    </div>

    <section v-if="selected >= 0 && positions[selected]" class="pos-panel card">
      <div class="pos-title">牌位 {{ selected + 1 }}</div>
      <label class="field row">
        <span class="field-label">名称</span>
        <input v-model="positions[selected].label" type="text" maxlength="6" placeholder="如：阻碍" />
      </label>
      <label class="field row">
        <span class="field-label">含义</span>
        <input
          v-model="positions[selected].meaning"
          type="text"
          maxlength="50"
          placeholder="这个位置看什么（可留空）"
        />
      </label>
      <button class="btn-ghost danger" @click="removeSelected">删除此牌位</button>
    </section>

    <div class="save-bar">
      <span class="count">{{ positions.length }}/{{ MAX_POS }} 个牌位</span>
      <button class="btn-solid save-btn" :disabled="!canSave" @click="save">
        {{ editId ? '保存修改' : '保存牌阵' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px calc(20px + env(safe-area-inset-bottom));
}

.head {
  padding: 0 44px; /* 让出 FlowExit 图标位 */
}
.title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
}
.subtitle {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--dim);
}

.field-label {
  font-size: 0.8rem;
  color: var(--dim);
}
.name-input,
.pos-panel input {
  width: 100%;
  margin-top: 4px;
  padding: 10px 12px;
  font-size: 16px; /* iOS 聚焦不自动放大 */
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.name-input:focus,
.pos-panel input:focus {
  outline: none;
  border-color: var(--gold);
}

.canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  touch-action: none; /* 拖动牌位时不触发页面滚动 */
  background:
    radial-gradient(rgba(127, 127, 127, 0.18) 1px, transparent 1px) 0 0 / 22px 22px,
    var(--paper);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
}
.canvas-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--dim);
  pointer-events: none;
}

.pos-chip {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  font-size: 0.8rem;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  touch-action: none;
}
.pos-chip.selected {
  border-color: var(--gold);
  color: var(--gold-text);
}
.pos-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  font-size: 0.68rem;
  color: var(--paper);
  background: var(--dim);
  border-radius: 999px;
}
.pos-chip.selected .pos-index {
  background: var(--gold);
}

.pos-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
.pos-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
}
.pos-panel .row .field-label {
  display: block;
}
.danger {
  color: #b3554d;
}

.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
}
.count {
  font-size: 0.8rem;
  color: var(--dim);
}
.save-btn {
  min-width: 132px;
}
.save-btn:disabled {
  opacity: 0.45;
}
</style>
