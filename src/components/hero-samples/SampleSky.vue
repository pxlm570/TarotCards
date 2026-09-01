<script setup>
// 方案三样张「星穹氛围」：全出血渐变穹顶 + 金色月环呼吸 + 衬线大字标，
// 零图片纯 CSS；下半区保留原首页仪表盘（含每日一抽行）。
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import SampleBlocks from './SampleBlocks.vue'
import { useDeck } from '../../lib/use-deck.js'

defineProps({
  drawn: { type: Boolean, default: false },
  greeting: { type: String, default: '' }
})

const { cardUrl } = useDeck()
const faceUrl = computed(() => cardUrl('major-17'))
</script>

<template>
  <div class="page skyp">
    <section class="dome">
      <div class="stars" aria-hidden="true" />
      <AppIcon class="help" name="help" :size="22" />
      <div class="halo" aria-hidden="true"><span class="core" /></div>
      <h1 class="brand-xl">星语<em>塔罗</em></h1>
      <p class="greet-xl">{{ greeting }}</p>
    </section>

    <SampleBlocks :drawn="drawn" :daily-row="true" :face-url="faceUrl" />
  </div>
</template>

<style scoped>
.skyp {
  padding: 0 20px 110px;
}

.dome {
  position: relative;
  margin: 0 -20px var(--sp-3);
  padding: 44px 20px 38px;
  min-height: 46vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  overflow: hidden;
  background: radial-gradient(150% 120% at 50% -20%, var(--gold-soft) 0%, transparent 58%);
}

[data-theme="dark"] .dome {
  background: radial-gradient(150% 120% at 50% -20%, var(--surface) 0%, transparent 62%);
}

.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  animation: twinkle 4s ease-in-out infinite alternate;
  background-image:
    radial-gradient(1.5px 1.5px at 14% 24%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 30% 40%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 52% 16%, var(--gold), transparent 60%),
    radial-gradient(1px 1px at 68% 36%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 84% 22%, var(--gold-text), transparent 60%),
    radial-gradient(1px 1px at 22% 70%, var(--dim), transparent 60%),
    radial-gradient(1px 1px at 78% 66%, var(--dim), transparent 60%),
    radial-gradient(1.5px 1.5px at 44% 54%, var(--gold), transparent 60%);
}

@keyframes twinkle {
  from { opacity: 0.55; }
  to { opacity: 0.95; }
}

.help {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--dim);
}

.halo {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  display: grid;
  place-items: center;
  animation: breathe 3.6s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.07); }
}

.core {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 26px var(--gold-glow);
}

.brand-xl {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.375rem;
  font-weight: var(--w-title);
  letter-spacing: 0.16em;
  text-indent: 0.16em;
  color: var(--ink);
}

.brand-xl em {
  font-style: normal;
  color: var(--gold-text);
}

.greet-xl {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--dim);
}

@media (prefers-reduced-motion: reduce) {
  .halo, .stars { animation: none; }
}

[data-motion="reduced"] .halo { animation: none; }
[data-motion="reduced"] .stars { animation: none; }
</style>
