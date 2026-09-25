<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { customAIAllowed, isSupabaseConfigured } from '../lib/supabase.js'
import InviteGenerator from '../components/InviteGenerator.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const mode = ref('signup')
const email = ref('')
const password = ref('')
const code = ref('')
const busy = ref(false)
const notice = ref('')
const inviteRequired = computed(() => auth.state === 'invite-needed')

onMounted(async () => {
  await auth.initialize()
  if (auth.state === 'active') router.replace(nextPath())
})

function nextPath() {
  return typeof route.query.next === 'string' && route.query.next.startsWith('/')
    ? route.query.next
    : '/welcome'
}

async function submitAuth() {
  busy.value = true
  notice.value = ''
  try {
    const input = { email: email.value, password: password.value }
    if (mode.value === 'signup') {
      const result = await auth.signUp(input)
      if (!result.session) {
        password.value = ''
        notice.value = '账号已创建。请先通过邮箱确认，再返回此页登录并输入邀请码。'
        return
      }
    } else await auth.signIn(input)
    password.value = ''
    notice.value = auth.state === 'active' ? '登录成功，正在进入星语。' : '账号已就绪，请输入你收到的邀请码。'
    if (auth.state === 'active') await router.replace(nextPath())
  } catch (error) {
    notice.value = error.message || '登录失败，请检查邮箱和密码。'
  } finally {
    busy.value = false
  }
}

async function redeem() {
  busy.value = true
  notice.value = ''
  try {
    await auth.redeem(code.value)
    code.value = ''
    notice.value = '邀请码已兑换，欢迎来到星语塔罗。'
    await router.replace(nextPath())
  } catch (error) {
    notice.value = error.message || '邀请码兑换失败。'
  } finally {
    busy.value = false
  }
}

async function exitAccount() {
  await auth.signOut()
  mode.value = 'signin'
  notice.value = '已退出登录。'
}
</script>

<template>
  <main class="access-shell">
    <section class="access-card card">
      <div class="brand-mark" aria-hidden="true">✦</div>
      <p class="eyebrow">星语塔罗 · 小范围体验</p>
      <h1>{{ inviteRequired ? '输入你的邀请码' : '欢迎来到星语' }}</h1>

      <div v-if="auth.state === 'config-error' || !isSupabaseConfigured" class="message error" role="alert">
        访问服务尚未配置，请联系邀请你的人。
      </div>
      <div v-else-if="auth.state === 'service-error'" class="message error" role="alert">
        暂时无法确认邀请资格，请检查网络后刷新页面。
      </div>

      <template v-else-if="auth.state === 'loading' || auth.state === 'checking'">
        <p class="sub">正在安全检查登录状态…</p>
      </template>

      <template v-else-if="auth.state === 'active'">
        <p class="sub">{{ auth.email }} 已获准访问。</p>
        <button class="btn-solid btn-block" @click="router.replace(nextPath())">进入应用</button>
        <button class="btn-ghost btn-block" @click="exitAccount">退出登录</button>
      </template>

      <template v-else-if="auth.state === 'invite-needed'">
        <p class="sub">此邀请码只能兑换一次，请使用邀请者发给你的个人邀请码。</p>
        <div v-if="auth.owner" class="owner-bootstrap">
          <p class="field-label">站长通道：还没有邀请码？先生成一个</p>
          <InviteGenerator />
        </div>
        <form class="form" @submit.prevent="redeem">
          <label class="field-label" for="invite-code">邀请码</label>
          <input id="invite-code" v-model="code" class="field-input code-input" autocomplete="one-time-code" required maxlength="40" placeholder="例如 AB12-CD34-EF56" />
          <button class="btn-solid btn-block" :disabled="busy">{{ busy ? '正在验证…' : '兑换并进入' }}</button>
        </form>
        <p v-if="notice" class="message" role="status">{{ notice }}</p>
        <button class="text-button" @click="exitAccount">换一个账号</button>
      </template>

      <template v-else>
        <p class="sub">受邀测试者可创建账号或登录，再输入个人邀请码。</p>
        <div class="mode-switch" role="tablist" aria-label="账号操作">
          <button :class="{ on: mode === 'signup' }" @click="mode = 'signup'">创建账号</button>
          <button :class="{ on: mode === 'signin' }" @click="mode = 'signin'">已有账号</button>
        </div>
        <form class="form" @submit.prevent="submitAuth">
          <label class="field-label" for="email">邮箱</label>
          <input id="email" v-model="email" class="field-input" type="email" autocomplete="email" required placeholder="you@example.com" />
          <label class="field-label" for="password">密码</label>
          <input id="password" v-model="password" class="field-input" type="password" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" minlength="8" required placeholder="至少 8 位" />
          <button class="btn-solid btn-block" :disabled="busy">{{ busy ? '请稍候…' : mode === 'signup' ? '创建账号并继续' : '登录并继续' }}</button>
        </form>
        <p v-if="notice" class="message" role="status">{{ notice }}</p>
      </template>

      <p class="privacy">占卜记录和学习进度仍保存在当前浏览器。{{ customAIAllowed ? '使用默认 AI 时，当前问题与牌阵内容会发送到模型服务以生成解读；不会把你的自定义 API Key 上传到网站。' : '使用 AI 解读时，当前问题与牌阵内容会发送到模型服务以生成解读。' }}</p>
    </section>
  </main>
</template>

<style scoped>
.access-shell { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--bg); }
.access-card { width: min(100%, 420px); padding: 28px 24px; text-align: center; }
.brand-mark { margin: 0 auto 10px; color: var(--gold-deep); font-size: 2rem; }
.eyebrow { color: var(--dim); font-size: var(--fs-note); letter-spacing: .08em; }
h1 { margin: 8px 0; font-size: var(--fs-title); }
.sub { margin: 8px 0 20px; color: var(--dim); line-height: 1.6; }
.mode-switch { display: flex; padding: 4px; margin: 18px 0; border-radius: 14px; background: var(--bg); }
.mode-switch button { flex: 1; padding: 9px; border: 0; border-radius: 11px; color: var(--dim); background: transparent; }
.mode-switch button.on { color: var(--ink); background: var(--surface); box-shadow: var(--shadow-sm); }
.form { display: grid; gap: 8px; text-align: left; }
.field-label { margin-top: 5px; color: var(--dim); font-size: var(--fs-note); }
.field-input { width: 100%; padding: 12px; border: 2px solid var(--line); border-radius: var(--radius-sm); color: var(--ink); background: var(--surface); font: inherit; }
.code-input { text-align: center; letter-spacing: .1em; text-transform: uppercase; }
.form .btn-solid { margin-top: 8px; }
.owner-bootstrap { width: 100%; margin-bottom: 18px; padding: 14px; border: 1px dashed var(--line); border-radius: var(--radius-sm); text-align: left; }
.message { margin: 14px 0 0; color: var(--dim); line-height: 1.55; }
.message.error { color: var(--coral); }
.text-button { margin-top: 14px; border: 0; color: var(--gold-deep); background: none; }
.privacy { margin: 22px 0 0; color: var(--dim); font-size: .75rem; line-height: 1.6; }
</style>
