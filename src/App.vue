<template>
  <main class="app-shell">
    <h1 class="app-title">星语塔罗</h1>
    <p class="app-subtitle">暗夜主题就绪</p>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-deep);
}

.app-title {
  font-size: 2rem;
  letter-spacing: 0.1em;
  color: var(--gold-bright);
}

.app-subtitle {
  font-size: 0.875rem;
  color: var(--moon-dim);
}
</style>
