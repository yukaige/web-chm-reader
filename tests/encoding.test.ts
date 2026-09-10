import { describe, expect, it } from 'vitest'
import { decodeText, detectEncoding } from '../src/core/encoding'

describe('legacy CHM text decoding', () => {
  it('detects UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69])
    expect(detectEncoding(bytes)).toBe('utf-8')
    expect(decodeText(bytes)).toBe('hi')
  })

  it('honors GB2312 declarations through the GB18030 decoder', () => {
    const prefix = new TextEncoder().encode('<meta charset="gb2312"><p>')
    const suffix = new TextEncoder().encode('</p>')
    const bytes = new Uint8Array(prefix.length + 4 + suffix.length)
    bytes.set(prefix)
    bytes.set([0xd6, 0xd0, 0xce, 0xc4], prefix.length)
    bytes.set(suffix, prefix.length + 4)
    expect(detectEncoding(bytes)).toBe('gb18030')
    expect(decodeText(bytes)).toContain('中文')
  })

  it('prefers valid UTF-8 when no charset exists', () => {
    const bytes = new TextEncoder().encode('<p>简体中文</p>')
    expect(detectEncoding(bytes)).toBe('utf-8')
    expect(decodeText(bytes)).toContain('简体中文')
  })
})
