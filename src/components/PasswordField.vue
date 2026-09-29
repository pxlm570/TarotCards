<script setup>
// 密码输入 + 自绘可见性切换（2026-09-28）：浏览器的原生「显示密码」键只在聚焦/悬停时
// 出现、失焦即消失且无法由页面控制（门禁页实测输入后不可点），故自绘常驻按钮。
// 其余属性（placeholder/autocomplete/minlength/id 等）原样透传给内部 input。
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

defineOptions({ inheritAttrs: false })

const model = defineModel({ type: String, default: '' })
const visible = ref(false)
</script>

<template>
  <div class="pw-field">
    <input v-bind="$attrs" v-model="model" class="field-input" :type="visible ? 'text' : 'password'" />
    <button
      type="button"
      class="pw-toggle"
      :aria-label="visible ? '隐藏密码' : '显示密码'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <AppIcon :name="visible ? 'eye-off' : 'eye'" :size="18" />
    </button>
  </div>
</template>

<style scoped>
.pw-field { position: relative; }
.pw-field .field-input { width: 100%; padding-right: 46px; }
.pw-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 9px;
  color: var(--dim);
  background: none;
  transform: translateY(-50%);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pw-toggle:active { color: var(--ink); }
.pw-toggle:focus-visible { outline: 2px solid var(--gold-text); outline-offset: 1px; }
</style>
