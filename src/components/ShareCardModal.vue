<script setup>
// 分享卡片弹层（M5 Task 2）：生成预览 + 下载 / 系统分享。
import { ref, onUnmounted } from 'vue'
import { generateShareCard } from '../lib/share-card.js'
import { useEscClose } from '../composables/use-esc-close.js'
import AppIcon from './AppIcon.vue'
import { toast, success } from '../lib/feedback.js'

const props = defineProps({
  reading: { type: Object, required: true },
  spread: { type: Object, required: true }
})

const emit = defineEmits(['close'])
useEscClose(() => emit('close')) // Esc 关闭

const includeQuestion = ref(false)
const previewUrl = ref('')
const generating = ref(false)

async function generate() {
  generating.value = true
  try {
    const blob = await generateShareCard(props.reading, props.spread, { includeQuestion: includeQuestion.value })
    if (!blob) throw new Error('empty blob')
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(blob)
    return true
  } catch {
    toast('生成失败')
    return false
  } finally {
    generating.value = false
  }
}

async function download() {
  if (!previewUrl.value && !(await generate())) return // 生成失败不继续，避免「失败又成功」双提示
  const a = document.createElement('a')
  a.href = previewUrl.value
  a.download = '星语塔罗-分享卡.png'
  a.click()
  success()
  toast('已保存分享卡', 'success')
}

async function share() {
  if (!previewUrl.value && !(await generate())) return
  const blob = await (await fetch(previewUrl.value)).blob()
  const file = new File([blob], '星语塔罗-分享卡.png', { type: 'image/png' })
  try {
    if (navigator.share) await navigator.share({ files: [file], title: '星语塔罗' })
    else download()
  } catch {
    /* 用户取消 */
  }
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) // 关弹层必回收 blob URL
})
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div class="sheet card">
      <h3 class="title">分享卡片</h3>
      <img v-if="previewUrl" class="preview" :src="previewUrl" alt="分享卡片预览" />
      <div v-else class="preview placeholder" @click="generate">
        <AppIcon name="sparkle" :size="28" />
        <span>{{ generating ? '生成中…' : '生成分享卡片' }}</span>
      </div>
      <label class="opt">
        <span>包含我的问题</span>
        <input type="checkbox" :checked="includeQuestion" @change="includeQuestion = !includeQuestion; previewUrl = ''" />
      </label>
      <div class="actions">
        <button class="btn-ghost" @click="share"><AppIcon name="arrow" :size="15" /> 分享</button>
        <button class="btn-solid" @click="download">下载</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 24px;
}

.sheet {
  width: 100%;
  max-width: 380px;
  padding: var(--sp-3);
}

.title {
  font-size: var(--fs-head);
  margin-bottom: 12px;
  text-align: center;
}

.preview {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 2px solid var(--line);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--sunk);
  color: var(--dim);
  cursor: pointer;
}

.opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 2px;
  font-size: var(--fs-body);
}

.opt input {
  width: 22px;
  height: 22px;
  accent-color: var(--gold-deep);
}

.actions {
  display: flex;
  gap: 10px;
}

.actions > button {
  flex: 1;
}
</style>
