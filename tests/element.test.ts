// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ChmReaderElement, defineChmReader } from '../src/element'

describe('ChmReaderElement', () => {
  it('registers and renders without a framework', () => {
    defineChmReader()
    const reader = document.createElement('chm-reader') as ChmReaderElement
    document.body.append(reader)
    expect(reader.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('.chm')
    expect(reader.textContent).toContain('打开 CHM 文档')
    reader.remove()
  })
})
