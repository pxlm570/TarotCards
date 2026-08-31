<script setup>
// 数据详情页：导出/导入/清空（v1.5「我的」页收缩重构，从主页面迁入）。
import { ref } from 'vue'
import { collectBackup, parseImport, applyImport } from '../../lib/backup.js'
import { safeKeys, safeRemoveItem } from '../../lib/storage.js'
import PageHead from '../../components/PageHead.vue'
import AppIcon from '../../components/AppIcon.vue'
import { toast } from '../../lib/feedback.js'

const fileRef = ref(null)
const pendingImport = ref(null)

function doExport() {
  const b = collectBackup()
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `星语塔罗-backup-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast('已导出备份')
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      pendingImport.value = parseImport(String(reader.result))
      toast('已读取备份文件，请选择导入方式', 'info')
    } catch {
      pendingImport.value = null
      toast('文件无效，无法导入', 'info')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function doImport(mode) {
  if (!pendingImport.value) return
  const label = mode === 'merge' ? '合并' : '全量覆盖'
  if (!window.confirm(`确定${label}导入吗？${mode === 'overwrite' ? '现有数据将被替换。' : '新记录将并入，重复记录跳过。'}`)) return
  applyImport(pendingImport.value, mode)
  pendingImport.value = null
  toast('导入成功', 'success')
  setTimeout(() => location.reload(), 600)
}

// 清空所有本地数据（危险，二次确认）
function clearAll() {
  if (!window.confirm('确定清空所有数据吗？记录、进度、设置、成就都将被删除，且不可恢复。建议先导出备份。')) return
  if (!window.confirm('再次确认：真的要清空全部数据吗？')) return
  for (const k of safeKeys()) {
    if (k.startsWith('tarot.')) safeRemoveItem(k) // 裸 localStorage 在 iOS「阻止所有 Cookie」下会抛 SecurityError
  }
  toast('已清空')
  setTimeout(() => location.reload(), 600)
}
</script>

<template>
  <div class="page data-view">
    <PageHead title="数据" back-to="/profile" back-label="我的" sub="记录、进度与设置都存在本机浏览器。换设备可导出备份再导入。" />

    <section class="card block">
      <button class="btn-ghost btn-block" @click="doExport">导出备份</button>
      <button class="btn-ghost btn-block" style="margin-top: 8px" @click="fileRef.click()">导入备份</button>
      <input ref="fileRef" type="file" accept="application/json,.json" style="display: none" @change="onFileChange" />
      <div v-if="pendingImport" class="import-actions">
        <button class="btn-solid" style="flex:1" @click="doImport('merge')">合并</button>
        <button class="btn-ghost" style="flex:1" @click="doImport('overwrite')">全量覆盖</button>
      </div>
      <button class="clear-data btn-text" @click="clearAll">
        <AppIcon name="journal" :size="14" />
        清空所有数据（危险）
      </button>
    </section>
  </div>
</template>

<style scoped>
.data-view {
  padding: var(--sp-3) 20px var(--sp-4);
}

.block {
  padding: var(--sp-2);
}

.import-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.clear-data {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px auto 0;
  color: var(--dim);
  font-size: 0.75rem;
  padding: 8px;
}
</style>
