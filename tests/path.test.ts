import { describe, expect, it } from 'vitest'
import { isExternalReference, normalizeChmPath, splitReference } from '../src/core/path'

describe('CHM paths', () => {
  it('resolves relative and Windows paths', () => {
    expect(normalizeChmPath('../images/logo.png', '/guide/start.html')).toBe('/images/logo.png')
    expect(normalizeChmPath('assets\\icon.gif', '/guide/start.html')).toBe('/guide/assets/icon.gif')
  })

  it('unwraps Microsoft CHM URL schemes', () => {
    expect(normalizeChmPath('ms-its:manual.chm::/intro.html')).toBe('/intro.html')
    expect(splitReference('mk:@MSITStore:manual.chm::/intro.html#setup')).toEqual({
      path: '/intro.html',
      suffix: '#setup',
    })
  })

  it('distinguishes web links from archive links', () => {
    expect(isExternalReference('https://example.com')).toBe(true)
    expect(isExternalReference('//example.com/a')).toBe(true)
    expect(isExternalReference('ms-its:book.chm::/a.htm')).toBe(false)
    expect(isExternalReference('../a.htm')).toBe(false)
  })
})
