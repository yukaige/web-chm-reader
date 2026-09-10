// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChmReader from '../src/vue/ChmReader.vue'

describe('ChmReader', () => {
  it('renders a self-contained file picker when no source is supplied', () => {
    const wrapper = mount(ChmReader)
    expect(wrapper.get('input[type="file"]').attributes('accept')).toContain('.chm')
    expect(wrapper.text()).toContain('打开 CHM 文档')
    expect(wrapper.text()).toContain('拖入文件，或点击选择')
  })
})
