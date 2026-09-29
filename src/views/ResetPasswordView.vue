<script setup>
// 密码重置落地页（2026-09-29 SMTP 根治配套）：用户点重置邮件链接后，Supabase 消费
// 链接换得登录态并派发 PASSWORD_RECOVERY，守卫把用户带到本页设置新密码。
// 无有效会话时（链接过期/直接打开）如实提示失效，引导回登录页重新发起。
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PasswordField from '../components/PasswordField.vue'
import { useAuthStore } from '../stores/auth.js'
import { toast } from '../lib/feedback.js'

const router = useRouter()
const auth = useAuthStore()
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

onMounted(() => {
  // 没有恢复会话也没在恢复流程里 → 链接无效或已过期
  if (auth.state === 'signed-out' && !auth.recovering) {
    error.value = '重置链接无效或已过期，请回登录页重新发起「忘记密码」。'
  }
})

async function submit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = '新密码至少 8 位。'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致。'
    return
  }
  busy.value = true
  try {
    await auth.updatePassword(password.value)
    auth.recovering = false
    toast('密码已更新', 'success')
    router.replace('/access')
  } catch (e) {
    error.value = !auth.session
      ? '重置链接无效或已过期，请回登录页重新发起「忘记密码」。'
      : e?.message || '更新失败，请稍后再试。'
  } finally {
    busy.value = false
  }
}

function backToAccess() {
  auth.recovering = false
  router.replace('/access')
}
</script>

<template>
  <main class="reset-shell">
    <section class="reset-card card">
      <div class="brand-mark" aria-hidden="true">✦</div>
      <p class="eyebrow">星语塔罗 · 找回密码</p>
      <h1>设置新密码</h1>

      <div v-if="error" class="message error" role="alert">{{ error }}</div>

      <form class="form" @submit.prevent="submit">
        <label class="field-label" for="new-password">新密码</label>
        <PasswordField id="new-password" v-model="password" autocomplete="new-password" minlength="8" required placeholder="至少 8 位" />
        <label class="field-label" for="confirm-password">再输入一次</label>
        <PasswordField id="confirm-password" v-model="confirm" autocomplete="new-password" minlength="8" required placeholder="再输入一次" />
        <button class="btn-solid btn-block" :disabled="busy">{{ busy ? '正在保存…' : '保存新密码' }}</button>
      </form>
      <button class="text-button" @click="backToAccess">返回登录</button>
    </section>
  </main>
</template>

<style scoped>
.reset-shell { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--bg); }
.reset-card { width: min(100%, 420px); padding: 28px 24px; text-align: center; }
.brand-mark { margin: 0 auto 10px; color: var(--gold-deep); font-size: 2rem; }
.eyebrow { color: var(--dim); font-size: var(--fs-note); letter-spacing: .08em; }
h1 { margin: 8px 0 20px; font-size: var(--fs-title); }
.form { display: grid; gap: 8px; text-align: left; }
.field-label { margin-top: 5px; color: var(--dim); font-size: var(--fs-note); }
.form .btn-solid { margin-top: 8px; }
.message { margin: 0 0 8px; color: var(--dim); line-height: 1.55; }
.message.error { color: var(--coral); }
.text-button { margin-top: 14px; border: 0; color: var(--gold-deep); background: none; }
</style>
