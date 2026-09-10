import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { ChmArchive } from '../core/chm-archive'
import { splitReference } from '../core/path'
import type { ChmSearchResult, ChmSource, ChmTocItem } from '../core/types'

export interface ChmReaderProps {
  source?: ChmSource | null
  initialPath?: string
  encoding?: string
  height?: string
  theme?: 'light' | 'dark' | 'auto'
  showSearch?: boolean
  className?: string
  style?: CSSProperties
  onReady?: (archive: ChmArchive) => void
  onNavigate?: (path: string) => void
  onError?: (error: Error) => void
}

export interface ChmReaderHandle {
  readonly archive: ChmArchive | null
  navigate(path: string): Promise<void>
  search(query: string): Promise<ChmSearchResult[]>
}

interface HistoryState {
  items: string[]
  index: number
}

interface TocNodeProps {
  item: ChmTocItem
  activePath: string
  depth?: number
  onNavigate: (path: string) => void
}

const TocNode = memo(function TocNode({ item, activePath, depth = 0, onNavigate }: TocNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  return (
    <li className="vcr-tree-item">
      <div
        className={`vcr-tree-row${item.path === activePath ? ' is-active' : ''}`}
        style={{ '--vcr-depth': depth } as CSSProperties}
      >
        {item.children.length > 0 ? (
          <button
            type="button"
            className="vcr-tree-toggle"
            aria-label={expanded ? '折叠' : '展开'}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 5 4.5-5 4.5" /></svg>
          </button>
        ) : <span className="vcr-tree-spacer" />}
        <button
          type="button"
          className="vcr-tree-label"
          disabled={!item.path}
          title={item.label}
          onClick={() => item.path && onNavigate(item.path)}
        >
          {item.label}
        </button>
      </div>
      {item.children.length > 0 && expanded ? (
        <ul className="vcr-tree-list">
          {item.children.map((child) => (
            <TocNode key={child.id} item={child} activePath={activePath} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      ) : null}
    </li>
  )
})

export const ChmReader = forwardRef<ChmReaderHandle, ChmReaderProps>(function ChmReader({
  source = null,
  initialPath = '',
  encoding = 'gb18030',
  height = '720px',
  theme = 'auto',
  showSearch = true,
  className = '',
  style,
  onReady,
  onNavigate,
  onError,
}, ref) {
  const archiveRef = useRef<ChmArchive | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const searchControllerRef = useRef<AbortController | null>(null)
  const loadVersionRef = useRef(0)
  const [archive, setArchive] = useState<ChmArchive | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rawHtml, setRawHtml] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [activePath, setActivePath] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChmSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchProgress, setSearchProgress] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<HistoryState>({ items: [], index: -1 })

  const pageHtml = useMemo(() => injectReaderStyles(rawHtml, zoom, theme), [rawHtml, theme, zoom])
  const canGoBack = history.index > 0
  const canGoForward = history.index >= 0 && history.index < history.items.length - 1

  const reportError = useCallback((cause: unknown) => {
    const normalized = cause instanceof Error ? cause : new Error(String(cause))
    setError(normalized.message)
    onError?.(normalized)
  }, [onError])

  const renderPath = useCallback(async (targetArchive: ChmArchive, reference: string, addHistory = true) => {
    const { path, suffix } = splitReference(reference)
    setLoading(true)
    setError('')
    try {
      const page = await targetArchive.render(path)
      setActivePath(page.path)
      setPageTitle(page.title)
      setRawHtml(page.html)
      if (addHistory) {
        setHistory((current) => {
          const items = [...current.items.slice(0, current.index + 1), page.path]
          return { items, index: items.length - 1 }
        })
      }
      setSidebarOpen(false)
      setSearchOpen(false)
      onNavigate?.(page.path)
      if (suffix.startsWith('#')) {
        iframeRef.current?.addEventListener('load', () => {
          const id = decodeURIComponent(suffix.slice(1))
          iframeRef.current?.contentDocument?.getElementById(id)?.scrollIntoView()
        }, { once: true })
      }
    } catch (cause) {
      reportError(cause)
    } finally {
      setLoading(false)
    }
  }, [onNavigate, reportError])

  const navigate = useCallback(async (path: string) => {
    const current = archiveRef.current
    if (current) await renderPath(current, path)
  }, [renderPath])

  const search = useCallback(async (query: string) => {
    const current = archiveRef.current
    if (!current || !query.trim()) return []
    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setSearching(true)
    setSearchProgress(0)
    try {
      const results = await current.search(query, {
        signal: controller.signal,
        onProgress: (completed, total) => setSearchProgress(total ? completed / total : 0),
      })
      setSearchResults(results)
      return results
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) reportError(cause)
      return []
    } finally {
      setSearching(false)
    }
  }, [reportError])

  useImperativeHandle(ref, () => ({ archive, navigate, search }), [archive, navigate, search])

  useEffect(() => {
    const version = ++loadVersionRef.current
    searchControllerRef.current?.abort()
    archiveRef.current?.close()
    archiveRef.current = null
    setArchive(null)
    setRawHtml('')
    setError('')
    setHistory({ items: [], index: -1 })
    if (!source) return

    let opened: ChmArchive | null = null
    setLoading(true)
    void ChmArchive.open(source, { encoding }).then(async (result) => {
      opened = result
      if (version !== loadVersionRef.current) {
        result.close()
        return
      }
      archiveRef.current = result
      setArchive(result)
      onReady?.(result)
      const firstPath = initialPath || result.metadata.defaultTopic
      if (firstPath) await renderPath(result, firstPath)
    }).catch(reportError).finally(() => {
      if (version === loadVersionRef.current) setLoading(false)
    })

    return () => {
      loadVersionRef.current += 1
      if (archiveRef.current === opened) archiveRef.current = null
      opened?.close()
    }
  }, [encoding, initialPath, onReady, renderPath, reportError, source])

  useEffect(() => () => {
    searchControllerRef.current?.abort()
    archiveRef.current?.close()
    archiveRef.current = null
  }, [])

  const onFrameLoad = useCallback(() => {
    iframeRef.current?.contentDocument?.addEventListener('click', (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-chm-path]')
      if (!link?.dataset.chmPath) return
      event.preventDefault()
      void navigate(link.dataset.chmPath)
    })
  }, [navigate])

  const moveHistory = useCallback((delta: number) => {
    setHistory((current) => {
      const index = current.index + delta
      const path = current.items[index]
      if (!path || !archiveRef.current) return current
      void renderPath(archiveRef.current, path, false)
      return { ...current, index }
    })
  }, [renderPath])

  const openLocalFile = useCallback((file: File) => {
    setLoading(true)
    setError('')
    void ChmArchive.open(file, { encoding }).then((opened) => {
      archiveRef.current?.close()
      archiveRef.current = opened
      setArchive(opened)
      onReady?.(opened)
      const firstPath = initialPath || opened.metadata.defaultTopic
      if (firstPath) void renderPath(opened, firstPath)
    }).catch(reportError).finally(() => setLoading(false))
  }, [encoding, initialPath, onReady, renderPath, reportError])

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) openLocalFile(file)
  }

  const dropFile = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) openLocalFile(file)
  }

  return (
    <section
      className={`vcr-reader is-${theme}${className ? ` ${className}` : ''}`}
      style={{ height, ...style }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFile}
    >
      {archive ? (
        <>
          <header className="vcr-toolbar">
            <div className="vcr-toolbar-group">
              <button className="vcr-icon-button vcr-mobile-menu" type="button" aria-label="目录" onClick={() => setSidebarOpen((value) => !value)}>☰</button>
              <button className="vcr-icon-button" type="button" aria-label="后退" disabled={!canGoBack} onClick={() => moveHistory(-1)}>←</button>
              <button className="vcr-icon-button" type="button" aria-label="前进" disabled={!canGoForward} onClick={() => moveHistory(1)}>→</button>
            </div>
            <div className="vcr-document-title" title={pageTitle || archive.metadata.title}>
              <span className="vcr-title-kicker">{archive.metadata.title || 'CHM 文档'}</span>
              <strong>{pageTitle || '正在打开…'}</strong>
            </div>
            <div className="vcr-toolbar-group vcr-toolbar-end">
              {showSearch ? <button className="vcr-icon-button" type="button" aria-label="搜索" onClick={() => setSearchOpen((value) => !value)}>⌕</button> : null}
              <button className="vcr-text-button" type="button" aria-label="缩小字号" onClick={() => setZoom((value) => Math.max(.75, value - .1))}>A−</button>
              <button className="vcr-text-button" type="button" aria-label="放大字号" onClick={() => setZoom((value) => Math.min(1.6, value + .1))}>A+</button>
            </div>
          </header>
          <div className="vcr-workspace">
            <aside className={`vcr-sidebar${sidebarOpen ? ' is-open' : ''}`}>
              <div className="vcr-sidebar-heading"><span>目录</span><small>{archive.entries.length} 个文件</small></div>
              <nav aria-label="CHM 目录">
                <ul className="vcr-tree-list vcr-tree-root">
                  {archive.toc.map((item) => <TocNode key={item.id} item={item} activePath={activePath} onNavigate={(path) => void navigate(path)} />)}
                </ul>
              </nav>
            </aside>
            <main className="vcr-content">
              {searchOpen ? (
                <div className="vcr-search-panel">
                  <form className="vcr-search-form" onSubmit={(event) => { event.preventDefault(); void search(searchQuery) }}>
                    <span aria-hidden="true">⌕</span>
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="搜索整本 CHM…" autoFocus />
                    <button type="submit" disabled={searching}>{searching ? '搜索中' : '搜索'}</button>
                  </form>
                  {searching ? <div className="vcr-search-progress"><i style={{ width: `${searchProgress * 100}%` }} /></div> : null}
                  <div className="vcr-search-results">
                    {searchResults.map((result) => (
                      <button key={result.path} type="button" onClick={() => void navigate(result.path)}>
                        <strong>{result.title}</strong><span>{result.excerpt}</span>
                      </button>
                    ))}
                    {!searching && searchQuery && searchResults.length === 0 ? <p className="vcr-empty-result">没有找到匹配内容</p> : null}
                  </div>
                </div>
              ) : null}
              {pageHtml ? <iframe ref={iframeRef} className="vcr-page-frame" srcDoc={pageHtml} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title={pageTitle} onLoad={onFrameLoad} /> : null}
              {loading ? <div className="vcr-loading" role="status"><i /><span>正在读取文档</span></div> : null}
              {error ? <div className="vcr-error" role="alert"><strong>无法打开</strong><span>{error}</span></div> : null}
            </main>
          </div>
        </>
      ) : (
        <label className="vcr-dropzone">
          <input type="file" accept=".chm,application/vnd.ms-htmlhelp" onChange={chooseFile} />
          <span className="vcr-file-icon" aria-hidden="true">CHM</span>
          <strong>{loading ? '正在解析 CHM…' : '打开 CHM 文档'}</strong>
          <span>{loading ? '文件只在本机处理，不会上传' : '拖入文件，或点击选择'}</span>
          {error ? <small>{error}</small> : null}
        </label>
      )}
    </section>
  )
})

function injectReaderStyles(html: string, scale: number, theme: ChmReaderProps['theme']): string {
  if (!html) return ''
  const style = `<style data-vcr-reader>html{font-size:${scale}em}body{max-width:980px;margin:0 auto;padding:32px 40px 80px;box-sizing:border-box;line-height:1.72;color:#252b32;background:#fff;overflow-wrap:anywhere}img,video,svg{max-width:100%;height:auto}pre{max-width:100%;overflow:auto}table{max-width:100%;border-collapse:collapse}a{color:#356859}@media(prefers-color-scheme:dark){html[data-vcr-theme=auto] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=auto] a{color:#8fc5b2}}html[data-vcr-theme=dark] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=dark] a{color:#8fc5b2}</style>`
  return html.replace('<html', `<html data-vcr-theme="${theme}"`).replace('</head>', `${style}</head>`)
}
