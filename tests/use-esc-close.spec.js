// useEscClose：弹层统一 Esc 关闭——挂载监听、其他按键不触发、卸载后移除监听
//（卸载后触发 Esc 不得再调用已销毁组件的回调）。
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useEscClose } from '../src/composables/use-esc-close.js'

const Host = defineComponent({
  props: { onClose: { type: Function, required: true } },
  setup(props) {
    useEscClose(props.onClose)
    return () => h('div')
  }
})

function pressKey(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

describe('useEscClose', () => {
  it('挂载后按 Esc 触发关闭回调', () => {
    const onClose = vi.fn()
    const wrapper = mount(Host, { props: { onClose } })
    pressKey('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('其他按键不触发（Enter/普通字母/Esc 大小写变体 key 值）', () => {
    const onClose = vi.fn()
    const wrapper = mount(Host, { props: { onClose } })
    pressKey('Enter')
    pressKey('a')
    pressKey('Esc') // KeyboardEvent.key 规范值是 'Escape'，其余值不应命中
    expect(onClose).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('卸载后移除监听，Esc 不再触发回调', () => {
    const onClose = vi.fn()
    const wrapper = mount(Host, { props: { onClose } })
    wrapper.unmount()
    pressKey('Escape')
    expect(onClose).not.toHaveBeenCalled()
  })
})
