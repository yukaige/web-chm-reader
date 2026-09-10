// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChmReader } from '../src/react/ChmReader'

describe('React ChmReader', () => {
  it('renders a self-contained file picker without a source', () => {
    const html = renderToStaticMarkup(<ChmReader />)
    expect(html).toContain('accept=".chm,application/vnd.ms-htmlhelp"')
    expect(html).toContain('打开 CHM 文档')
    expect(html).toContain('拖入文件，或点击选择')
  })
})
