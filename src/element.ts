import { ChmArchive } from './core/chm-archive'
import { splitReference } from './core/path'
import type { ChmSearchResult, ChmSource, ChmTocItem } from './core/types'
import './vue/reader.css'

const HTMLElementBase: typeof HTMLElement = typeof HTMLElement === 'undefined'
  ? class {} as typeof HTMLElement
  : HTMLElement

export class ChmReaderElement extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ['height', 'theme', 'encoding', 'initial-path', 'show-search']
  }

  private archiveValue: ChmArchive | null = null
  private sourceValue: ChmSource | null = null
  private iframe: HTMLIFrameElement | null = null
  private root: HTMLElement | null = null
  private history: string[] = []
  private historyIndex = -1
  private loadVersion = 0
  private searchController: AbortController | null = null

  get archive(): ChmArchive | null { return this.archiveValue }
  get source(): ChmSource | null { return this.sourceValue }

  set source(value: ChmSource | null) {
    this.sourceValue = value
    if (this.isConnected) void this.open(value)
  }

  connectedCallback(): void {
    if (!this.root) this.createUi()
    this.syncAttributes()
    if (this.sourceValue) void this.open(this.sourceValue)
  }

  disconnectedCallback(): void {
    this.loadVersion += 1
    this.searchController?.abort()
    this.archiveValue?.close()
    this.archiveValue = null
  }

  attributeChangedCallback(): void {
    if (this.root) this.syncAttributes()
  }

  async navigate(reference: string, addHistory = true): Promise<void> {
    if (!this.archiveValue || !this.root) return
    const { path, suffix } = splitReference(reference)
    this.setLoading(true)
    try {
      const page = await this.archiveValue.render(path)
      if (this.iframe) {
        this.iframe.title = page.title
        this.iframe.srcdoc = injectReaderStyles(page.html, this.getAttribute('theme') ?? 'auto')
      }
      this.setText('[data-document-title]', page.title)
      this.root.querySelectorAll('.vcr-tree-row.is-active').forEach((node) => node.classList.remove('is-active'))
      this.root.querySelector(`[data-path="${cssEscape(page.path)}"]`)?.closest('.vcr-tree-row')?.classList.add('is-active')
      if (addHistory) {
        this.history = [...this.history.slice(0, this.historyIndex + 1), page.path]
        this.historyIndex = this.history.length - 1
      }
      this.updateHistoryButtons()
      this.dispatchEvent(new CustomEvent('navigate', { detail: { path: page.path } }))
      if (suffix.startsWith('#')) {
        this.iframe?.addEventListener('load', () => {
          const id = decodeURIComponent(suffix.slice(1))
          this.iframe?.contentDocument?.getElementById(id)?.scrollIntoView()
        }, { once: true })
      }
    } catch (cause) {
      this.reportError(cause)
    } finally {
      this.setLoading(false)
    }
  }

  async search(query: string): Promise<ChmSearchResult[]> {
    if (!this.archiveValue || !this.root || !query.trim()) return []
    this.searchController?.abort()
    const controller = new AbortController()
    this.searchController = controller
    const results = this.root.querySelector<HTMLElement>('[data-search-results]')
    const progress = this.root.querySelector<HTMLElement>('[data-search-progress]')
    if (results) results.replaceChildren()
    try {
      const matches = await this.archiveValue.search(query, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (progress) progress.style.width = `${total ? completed / total * 100 : 0}%`
        },
      })
      if (results) {
        for (const match of matches) {
          const button = document.createElement('button')
          button.type = 'button'
          button.dataset.path = match.path
          const title = document.createElement('strong')
          title.textContent = match.title
          const excerpt = document.createElement('span')
          excerpt.textContent = match.excerpt
          button.append(title, excerpt)
          results.append(button)
        }
        if (matches.length === 0) {
          const empty = document.createElement('p')
          empty.className = 'vcr-empty-result'
          empty.textContent = '没有找到匹配内容'
          results.append(empty)
        }
      }
      return matches
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) this.reportError(cause)
      return []
    }
  }

  private async open(source: ChmSource | null): Promise<void> {
    const version = ++this.loadVersion
    this.archiveValue?.close()
    this.archiveValue = null
    this.history = []
    this.historyIndex = -1
    if (!source || !this.root) {
      this.showEmpty(true)
      return
    }
    this.setLoading(true)
    try {
      const archive = await ChmArchive.open(source, { encoding: this.getAttribute('encoding') ?? 'gb18030' })
      if (version !== this.loadVersion) {
        archive.close()
        return
      }
      this.archiveValue = archive
      this.showEmpty(false)
      this.setText('[data-book-title]', archive.metadata.title || 'CHM 文档')
      this.setText('[data-entry-count]', `${archive.entries.length} 个文件`)
      this.renderToc(archive.toc)
      this.dispatchEvent(new CustomEvent('ready', { detail: { archive } }))
      const initialPath = this.getAttribute('initial-path') || archive.metadata.defaultTopic
      if (initialPath) await this.navigate(initialPath)
    } catch (cause) {
      this.showEmpty(true)
      this.reportError(cause)
    } finally {
      this.setLoading(false)
    }
  }

  private createUi(): void {
    this.innerHTML = `
      <section class="vcr-reader is-auto">
        <div data-reader-shell hidden>
          <header class="vcr-toolbar">
            <div class="vcr-toolbar-group"><button class="vcr-icon-button" type="button" data-action="back" aria-label="后退">←</button><button class="vcr-icon-button" type="button" data-action="forward" aria-label="前进">→</button></div>
            <div class="vcr-document-title"><span class="vcr-title-kicker" data-book-title>CHM 文档</span><strong data-document-title>正在打开…</strong></div>
            <div class="vcr-toolbar-group vcr-toolbar-end"><button class="vcr-icon-button" type="button" data-action="search" aria-label="搜索">⌕</button></div>
          </header>
          <div class="vcr-workspace">
            <aside class="vcr-sidebar"><div class="vcr-sidebar-heading"><span>目录</span><small data-entry-count></small></div><nav aria-label="CHM 目录"><ul class="vcr-tree-list vcr-tree-root" data-toc></ul></nav></aside>
            <main class="vcr-content">
              <div class="vcr-search-panel" data-search-panel hidden><form class="vcr-search-form" data-search-form><span aria-hidden="true">⌕</span><input type="search" placeholder="搜索整本 CHM…"><button type="submit">搜索</button></form><div class="vcr-search-progress"><i data-search-progress></i></div><div class="vcr-search-results" data-search-results></div></div>
              <iframe class="vcr-page-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="CHM 页面"></iframe>
              <div class="vcr-loading" data-loading hidden role="status"><i></i><span>正在读取文档</span></div><div class="vcr-error" data-error hidden role="alert"><strong>无法打开</strong><span></span></div>
            </main>
          </div>
        </div>
        <label class="vcr-dropzone" data-dropzone><input type="file" accept=".chm,application/vnd.ms-htmlhelp"><span class="vcr-file-icon" aria-hidden="true">CHM</span><strong>打开 CHM 文档</strong><span>拖入文件，或点击选择</span><small data-empty-error></small></label>
      </section>`
    this.root = this.querySelector('.vcr-reader')
    this.iframe = this.querySelector('.vcr-page-frame')
    this.addEventListener('click', (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-action],[data-path]')
      const action = target?.dataset.action
      if (target?.dataset.path) void this.navigate(target.dataset.path)
      else if (action === 'back') this.moveHistory(-1)
      else if (action === 'forward') this.moveHistory(1)
      else if (action === 'search') this.toggleSearch()
    })
    this.querySelector<HTMLInputElement>('input[type="file"]')?.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) this.source = file
    })
    this.addEventListener('dragover', (event) => event.preventDefault())
    this.addEventListener('drop', (event) => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (file) this.source = file
    })
    this.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
      event.preventDefault()
      const query = this.querySelector<HTMLInputElement>('[data-search-form] input')?.value ?? ''
      void this.search(query)
    })
    this.iframe?.addEventListener('load', () => {
      this.iframe?.contentDocument?.addEventListener('click', (event) => {
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-chm-path]')
        if (!link?.dataset.chmPath) return
        event.preventDefault()
        void this.navigate(link.dataset.chmPath)
      })
    })
  }

  private renderToc(items: readonly ChmTocItem[]): void {
    const root = this.root?.querySelector('[data-toc]')
    if (!root) return
    const createItems = (nodes: readonly ChmTocItem[], depth: number): HTMLUListElement => {
      const list = document.createElement('ul')
      list.className = 'vcr-tree-list'
      for (const item of nodes) {
        const li = document.createElement('li')
        const row = document.createElement('div')
        row.className = 'vcr-tree-row'
        row.style.setProperty('--vcr-depth', String(depth))
        const spacer = document.createElement('span')
        spacer.className = 'vcr-tree-spacer'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'vcr-tree-label'
        button.textContent = item.label
        button.title = item.label
        button.disabled = !item.path
        if (item.path) button.dataset.path = item.path
        row.append(spacer, button)
        li.append(row)
        if (item.children.length) li.append(createItems(item.children, depth + 1))
        list.append(li)
      }
      return list
    }
    root.replaceChildren(...createItems(items, 0).childNodes)
  }

  private moveHistory(delta: number): void {
    const next = this.historyIndex + delta
    const path = this.history[next]
    if (!path) return
    this.historyIndex = next
    void this.navigate(path, false)
  }

  private updateHistoryButtons(): void {
    const back = this.root?.querySelector<HTMLButtonElement>('[data-action="back"]')
    const forward = this.root?.querySelector<HTMLButtonElement>('[data-action="forward"]')
    if (back) back.disabled = this.historyIndex <= 0
    if (forward) forward.disabled = this.historyIndex < 0 || this.historyIndex >= this.history.length - 1
  }

  private toggleSearch(): void {
    const panel = this.root?.querySelector<HTMLElement>('[data-search-panel]')
    if (!panel) return
    panel.hidden = !panel.hidden
    if (!panel.hidden) panel.querySelector<HTMLInputElement>('input')?.focus()
  }

  private syncAttributes(): void {
    if (!this.root) return
    this.root.style.height = this.getAttribute('height') ?? '720px'
    this.root.classList.remove('is-light', 'is-dark', 'is-auto')
    this.root.classList.add(`is-${this.getAttribute('theme') ?? 'auto'}`)
    const search = this.root.querySelector<HTMLElement>('[data-action="search"]')
    if (search) search.hidden = this.getAttribute('show-search') === 'false'
  }

  private showEmpty(empty: boolean): void {
    const shell = this.root?.querySelector<HTMLElement>('[data-reader-shell]')
    const dropzone = this.root?.querySelector<HTMLElement>('[data-dropzone]')
    if (shell) shell.hidden = empty
    if (dropzone) dropzone.hidden = !empty
  }

  private setLoading(value: boolean): void {
    const loading = this.root?.querySelector<HTMLElement>('[data-loading]')
    if (loading) loading.hidden = !value
  }

  private reportError(cause: unknown): void {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    const panel = this.root?.querySelector<HTMLElement>('[data-error]')
    const message = panel?.querySelector('span')
    if (message) message.textContent = error.message
    if (panel) panel.hidden = false
    this.setText('[data-empty-error]', error.message)
    this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
  }

  private setText(selector: string, value: string): void {
    const element = this.root?.querySelector(selector)
    if (element) element.textContent = value
  }
}

export function defineChmReader(tagName = 'chm-reader'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) customElements.define(tagName, ChmReaderElement)
}

defineChmReader()

function injectReaderStyles(html: string, theme: string): string {
  const style = '<style data-vcr-reader>body{max-width:980px;margin:0 auto;padding:32px 40px 80px;box-sizing:border-box;line-height:1.72;color:#252b32;background:#fff;overflow-wrap:anywhere}img,video,svg{max-width:100%;height:auto}pre{max-width:100%;overflow:auto}table{max-width:100%;border-collapse:collapse}a{color:#356859}@media(prefers-color-scheme:dark){html[data-vcr-theme=auto] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=auto] a{color:#8fc5b2}}html[data-vcr-theme=dark] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=dark] a{color:#8fc5b2}</style>'
  return html.replace('<html', `<html data-vcr-theme="${theme}"`).replace('</head>', `${style}</head>`)
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}
