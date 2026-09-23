import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import AiPanel from '../src/components/AiPanel.vue'
import { useSettingsStore } from '../src/stores/settings.js'
import { useReadingStore } from '../src/stores/reading.js'

const Chat = defineComponent({ name: 'ChatStream', props: ['messages'], emits: ['done'], template: '<div />' })
let wrapper
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  useSettingsStore().update({ baseUrl: 'https://example.invalid', apiKey: 'test', model: 'test' })
  const reading = useReadingStore()
  reading.selectSpread('single')
  reading.beginBreathing()
  reading.toQuestion()
  reading.submitQuestion('今天关注什么', null)
  reading.finishShuffle()
  reading.pickAll()
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })

describe('AI 追问上下文', () => {
  it('后续请求包含上一轮助手回答，且不修改当前流收到的消息', async () => {
    wrapper = mount(AiPanel, { global: { stubs: { ChatStream: Chat, RouterLink: true } } })
    await wrapper.get('.ai-start').trigger('click')
    const currentMessages = wrapper.findComponent(Chat).props('messages')
    wrapper.findComponent(Chat).vm.$emit('done', '先把精力放回自己。')
    await wrapper.vm.$nextTick()
    await wrapper.get('input').setValue('能给一个具体行动吗')
    await wrapper.get('.follow button').trigger('click')
    expect(wrapper.findComponent(Chat).props('messages').slice(-2)).toEqual([
      { role: 'assistant', content: '先把精力放回自己。' },
      { role: 'user', content: '能给一个具体行动吗' }
    ])
    expect(currentMessages).toHaveLength(2)
  })
})
