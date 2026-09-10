const SCHEME_RE = /^(?:mk:@msitstore:|ms-its:|its:)/i

export function splitReference(reference: string): { path: string; suffix: string } {
  const cleaned = reference.trim().replace(SCHEME_RE, '')
  const archiveSeparator = cleaned.indexOf('::')
  const local = archiveSeparator >= 0 ? cleaned.slice(archiveSeparator + 2) : cleaned
  const suffixAt = local.search(/[?#]/)
  return suffixAt < 0
    ? { path: local, suffix: '' }
    : { path: local.slice(0, suffixAt), suffix: local.slice(suffixAt) }
}

export function normalizeChmPath(reference: string, basePath = '/'): string {
  const { path } = splitReference(reference)
  const slashPath = path.replace(/\\/g, '/')
  const absolute = slashPath.startsWith('/')
    ? slashPath
    : `${basePath.slice(0, basePath.lastIndexOf('/') + 1)}${slashPath}`
  const parts: string[] = []

  for (const part of absolute.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return `/${parts.join('/')}`
}

export function isExternalReference(reference: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference) && !SCHEME_RE.test(reference)
}

export function isHtmlPath(path: string): boolean {
  return /\.(?:html?|xhtml)$/i.test(path)
}
