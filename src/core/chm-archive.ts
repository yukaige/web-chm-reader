import DOMPurify from 'dompurify'
import { ChmEnumerateFlags, ChmFile, ChmSpace, parseToc, type ChmReader, type ChmUnitInfo } from 'chmlib-ts'
import { decodeText } from './encoding'
import { isTextMediaType, mediaTypeForPath } from './media'
import { isExternalReference, isHtmlPath, normalizeChmPath, splitReference } from './path'
import type {
  ChmEntry,
  ChmMetadata,
  ChmOpenOptions,
  ChmRenderedPage,
  ChmSearchOptions,
  ChmSearchResult,
  ChmSource,
  ChmTocItem,
} from './types'

const DEFAULT_OPTIONS: Required<ChmOpenOptions> = {
  encoding: 'gb18030',
  sanitize: true,
  cacheSize: 8,
}

export class ChmArchive {
  readonly metadata: ChmMetadata
  readonly entries: readonly ChmEntry[]
  readonly toc: readonly ChmTocItem[]

  private readonly chm: ChmFile
  private readonly units = new Map<string, ChmUnitInfo>()
  private readonly canonicalPaths = new Map<string, string>()
  private readonly options: Required<ChmOpenOptions>
  private readonly objectUrls = new Map<string, string>()
  private closed = false

  private constructor(
    chm: ChmFile,
    units: Map<string, ChmUnitInfo>,
    metadata: ChmMetadata,
    toc: ChmTocItem[],
    options: Required<ChmOpenOptions>,
  ) {
    this.chm = chm
    this.units = units
    this.metadata = metadata
    this.toc = toc
    this.options = options
    this.entries = [...units.values()].map((unit) => ({
      path: unit.path,
      length: unit.length,
      compressed: unit.space === ChmSpace.Compressed,
      mediaType: mediaTypeForPath(unit.path),
    }))
    for (const path of units.keys()) this.canonicalPaths.set(path.toLowerCase(), path)
  }

  static async open(source: ChmSource, options: ChmOpenOptions = {}): Promise<ChmArchive> {
    const resolvedOptions = { ...DEFAULT_OPTIONS, ...options }
    const chm = await ChmFile.open(createReader(source))
    chm.setCacheSize(resolvedOptions.cacheSize)
    const units = new Map<string, ChmUnitInfo>()

    for await (const unit of chm.enumerate(ChmEnumerateFlags.Normal | ChmEnumerateFlags.Files)) {
      units.set(normalizeChmPath(unit.path), { ...unit, path: normalizeChmPath(unit.path) })
    }

    const rawSystem = await chm.getSystemRaw()
    const metadata = rawSystem ? parseSystemMetadata(rawSystem, resolvedOptions.encoding) : {}
    const tocPath = resolveExistingPath(units, metadata.tocFile)
      ?? [...units.keys()].find((path) => path.toLowerCase().endsWith('.hhc'))
    const toc = tocPath
      ? await readToc(chm, units.get(tocPath)!, tocPath, resolvedOptions.encoding)
      : createFallbackToc(units)

    if (tocPath) metadata.tocFile = tocPath
    metadata.defaultTopic = resolveExistingPath(units, metadata.defaultTopic)
      ?? firstNavigablePath(toc)
      ?? [...units.keys()].find(isHtmlPath)

    return new ChmArchive(chm, units, metadata, toc, resolvedOptions)
  }

  has(path: string): boolean {
    return this.resolveCanonicalPath(path) !== undefined
  }

  async readBinary(path: string): Promise<Uint8Array> {
    this.assertOpen()
    const canonical = this.resolveCanonicalPath(path)
    const unit = canonical ? this.units.get(canonical) : undefined
    if (!unit) throw new Error(`CHM entry not found: ${path}`)
    return this.chm.retrieve(unit)
  }

  async readText(path: string, encoding = this.options.encoding): Promise<string> {
    return decodeText(await this.readBinary(path), encoding)
  }

  async render(path: string): Promise<ChmRenderedPage> {
    this.assertOpen()
    if (typeof DOMParser === 'undefined') {
      throw new Error('render() requires a browser DOM. Use readText() in Node.js.')
    }

    const canonical = this.resolveCanonicalPath(path)
    if (!canonical) throw new Error(`CHM page not found: ${path}`)
    const source = await this.readText(canonical)
    const safeSource = this.options.sanitize
      ? DOMPurify.sanitize(source, {
          WHOLE_DOCUMENT: true,
          FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form'],
          FORBID_ATTR: ['srcdoc'],
          ADD_TAGS: ['link'],
          ADD_ATTR: ['data-chm-path', 'href', 'rel', 'type'],
        })
      : source
    const document = new DOMParser().parseFromString(safeSource, 'text/html')
    document.querySelectorAll('base').forEach((node) => node.remove())
    document.querySelectorAll<HTMLLinkElement>('link').forEach((node) => {
      if (!node.relList.contains('stylesheet')) node.remove()
    })

    await this.rewriteDocumentResources(document, canonical)
    this.rewriteLinks(document, canonical)
    document.documentElement.dataset.chmDocument = ''

    const title = document.title.trim() || labelFromPath(canonical)
    return {
      path: canonical,
      title,
      html: `<!doctype html>\n${document.documentElement.outerHTML}`,
    }
  }

  async search(query: string, options: ChmSearchOptions = {}): Promise<ChmSearchResult[]> {
    this.assertOpen()
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return []
    const candidates = this.entries.filter((entry) => isHtmlPath(entry.path))
    const results: ChmSearchResult[] = []
    const limit = options.limit ?? 50

    for (let index = 0; index < candidates.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException('Search aborted', 'AbortError')
      const entry = candidates[index]
      const html = await this.readText(entry.path)
      const title = extractTitle(html) || labelFromPath(entry.path)
      const text = htmlToText(html)
      const position = text.toLocaleLowerCase().indexOf(needle)
      const titlePosition = title.toLocaleLowerCase().indexOf(needle)
      if (position >= 0 || titlePosition >= 0) {
        results.push({
          path: entry.path,
          title,
          excerpt: createExcerpt(text, Math.max(position, 0), needle.length),
          score: (titlePosition >= 0 ? 1000 : 0) + occurrenceCount(text.toLocaleLowerCase(), needle),
        })
      }
      options.onProgress?.(index + 1, candidates.length)
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.chm.close()
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url)
    this.objectUrls.clear()
  }

  private resolveCanonicalPath(path: string): string | undefined {
    const normalized = normalizeChmPath(path)
    return this.units.has(normalized) ? normalized : this.canonicalPaths.get(normalized.toLowerCase())
  }

  private async rewriteDocumentResources(document: Document, pagePath: string): Promise<void> {
    const attributes: Array<[string, string]> = [
      ['img', 'src'], ['input[type="image"]', 'src'], ['source', 'src'],
      ['audio', 'src'], ['video', 'src'], ['video', 'poster'], ['link[rel~="stylesheet"]', 'href'],
    ]

    for (const [selector, attribute] of attributes) {
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const value = element.getAttribute(attribute)
        if (!value || value.startsWith('data:') || value.startsWith('blob:')) continue
        if (isExternalReference(value)) {
          element.removeAttribute(attribute)
          continue
        }
        const resourcePath = this.resolveCanonicalPath(normalizeChmPath(value, pagePath))
        if (!resourcePath) continue
        element.setAttribute(attribute, await this.getObjectUrl(resourcePath))
      }
    }

    for (const element of document.querySelectorAll<HTMLElement>('[style]')) {
      element.setAttribute('style', await this.rewriteCssUrls(element.getAttribute('style') ?? '', pagePath))
    }
    for (const style of document.querySelectorAll('style')) {
      style.textContent = await this.rewriteCssUrls(style.textContent ?? '', pagePath)
    }
  }

  private rewriteLinks(document: Document, pagePath: string): void {
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href') ?? ''
      if (!href || href.startsWith('#')) continue
      if (isExternalReference(href)) {
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        continue
      }
      const { suffix } = splitReference(href)
      const targetPath = this.resolveCanonicalPath(normalizeChmPath(href, pagePath))
      if (!targetPath || !isHtmlPath(targetPath)) continue
      link.dataset.chmPath = `${targetPath}${suffix}`
      link.href = suffix.startsWith('#') && targetPath === pagePath ? suffix : '#'
    }
  }

  private async getObjectUrl(path: string): Promise<string> {
    const existing = this.objectUrls.get(path)
    if (existing) return existing
    const mediaType = mediaTypeForPath(path)
    let bytes: Uint8Array | string = await this.readBinary(path)
    if (mediaType === 'text/css') bytes = await this.rewriteCssUrls(decodeText(bytes, this.options.encoding), path)
    else if (isTextMediaType(mediaType)) bytes = decodeText(bytes, this.options.encoding)
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaType }))
    this.objectUrls.set(path, url)
    return url
  }

  private async rewriteCssUrls(css: string, stylesheetPath: string): Promise<string> {
    const matches = [...css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)]
    let output = css
    for (const match of matches) {
      const reference = match[2].trim()
      if (reference.startsWith('data:') || reference.startsWith('blob:') || reference.startsWith('#')) continue
      if (isExternalReference(reference)) {
        output = output.replace(match[0], 'url("")')
        continue
      }
      const path = this.resolveCanonicalPath(normalizeChmPath(reference, stylesheetPath))
      if (!path) continue
      output = output.replace(match[0], `url("${await this.getObjectUrl(path)}")`)
    }
    return output
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('This CHM archive has been closed.')
  }
}

function createReader(source: ChmSource): ChmReader {
  if (source instanceof Uint8Array) {
    return {
      read(offset, length) {
        const start = Number(offset)
        return Promise.resolve(source.slice(start, Math.min(start + length, source.length)))
      },
    }
  }
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return {
      async read(offset, length) {
        return new Uint8Array(await source.slice(Number(offset), Number(offset) + length).arrayBuffer())
      },
    }
  }
  const bytes = new Uint8Array(source as ArrayBuffer)
  return {
    read(offset, length) {
      const start = Number(offset)
      return Promise.resolve(bytes.slice(start, Math.min(start + length, bytes.length)))
    },
  }
}

function parseSystemMetadata(data: Uint8Array, encoding: string): ChmMetadata {
  const metadata: ChmMetadata = {}
  if (data.byteLength < 4) return metadata
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 4
  const fields: Record<number, keyof ChmMetadata> = {
    0: 'tocFile', 1: 'indexFile', 2: 'defaultTopic', 3: 'title', 5: 'compiledFile',
  }
  while (offset + 4 <= data.byteLength) {
    const code = view.getUint16(offset, true)
    const length = view.getUint16(offset + 2, true)
    offset += 4
    if (offset + length > data.byteLength) break
    const field = fields[code]
    if (field) {
      let end = offset + length
      while (end > offset && data[end - 1] === 0) end -= 1
      metadata[field] = decodeText(data.subarray(offset, end), encoding)
    }
    offset += length
  }
  return metadata
}

async function readToc(
  chm: ChmFile,
  unit: ChmUnitInfo,
  tocPath: string,
  encoding: string,
): Promise<ChmTocItem[]> {
  const html = decodeText(await chm.retrieve(unit), encoding)
  const parsed = parseToc(html)
  let id = 0
  const convert = (items: typeof parsed.entries): ChmTocItem[] => items
    .filter((item) => item.name || item.local || item.children.length)
    .map((item) => ({
      id: `toc-${id += 1}`,
      label: decodeHtmlEntities(item.name || labelFromPath(item.local ?? 'Untitled')),
      path: item.local ? normalizeChmPath(decodeHtmlEntities(item.local), tocPath) : undefined,
      children: convert(item.children),
    }))
  return convert(parsed.entries)
}

function createFallbackToc(units: Map<string, ChmUnitInfo>): ChmTocItem[] {
  return [...units.keys()].filter(isHtmlPath).map((path, index) => ({
    id: `file-${index + 1}`,
    label: labelFromPath(path),
    path,
    children: [],
  }))
}

function firstNavigablePath(items: readonly ChmTocItem[]): string | undefined {
  for (const item of items) {
    if (item.path) return item.path
    const child = firstNavigablePath(item.children)
    if (child) return child
  }
  return undefined
}

function resolveExistingPath(units: Map<string, ChmUnitInfo>, path?: string): string | undefined {
  if (!path) return undefined
  const normalized = normalizeChmPath(path)
  if (units.has(normalized)) return normalized
  const lower = normalized.toLowerCase()
  return [...units.keys()].find((candidate) => candidate.toLowerCase() === lower)
}

function labelFromPath(path: string): string {
  const file = path.split('/').pop() || path
  try { return decodeURIComponent(file.replace(/\.[^.]+$/, '')).replace(/[_-]+/g, ' ') }
  catch { return file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined') return value
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim()) : ''
}

function htmlToText(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  }
  return decodeHtmlEntities(html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim()
}

function createExcerpt(text: string, position: number, queryLength: number): string {
  const start = Math.max(0, position - 55)
  const end = Math.min(text.length, position + queryLength + 90)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

function occurrenceCount(text: string, needle: string): number {
  let count = 0
  let from = 0
  while ((from = text.indexOf(needle, from)) >= 0) {
    count += 1
    from += needle.length
  }
  return count
}
