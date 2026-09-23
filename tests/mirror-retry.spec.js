import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
const state = vi.hoisted(() => { vi.resetModules(); return { stream: null } })
vi.mock('../src/composables/use-stream.js', () => ({ useStream: () => state.stream }))
vi.mock('../src/lib/use-deck.js', () => ({ useDeck: () => ({ cardUrl: () => '' }) }))
import MirrorPanel from '../src/components/MirrorPanel.vue'
import { useSettingsStore } from '../src/stores/settings.js'
import { useJournalStore } from '../src/stores/journal.js'
let wrapper
beforeEach(() => {
  localStorage.clear(); setActivePinia(createPinia())
  useSettingsStore().update({ baseUrl: 'https://example.invalid', apiKey: 'test', model: 'test' })
  state.stream = { text: ref(''), error: ref(''), streaming: ref(false), start: vi.fn() }
})
afterEach(() => wrapper?.unmount())
describe('周期复盘中断恢复', () => {
  it('半截回答失败后允许重试，成功回答才能保存', async () => {
    wrapper = mount(MirrorPanel, { props: { readings: Array.from({length:5},(_,i)=>({id:String(i),ts:Date.now(),cards:[{cardId:'major-00',reversed:false}]})) } })
    await wrapper.findAll('button').find(b=>b.text().includes('复盘')).trigger('click')
    state.stream.text.value='半截回答'; state.stream.error.value='网络中断'
    await nextTick()
    expect(wrapper.text()).not.toContain('保存为日记')
    await wrapper.findAll('button').find(b=>b.text()==='重试').trigger('click')
    expect(state.stream.start).toHaveBeenCalledTimes(2)
    state.stream.error.value='';state.stream.text.value='完整复盘'
    await nextTick()
    await wrapper.findAll('button').find(b=>b.text()==='保存为日记').trigger('click')
    expect(useJournalStore().readings[0].note).toBe('完整复盘')
  })
})
