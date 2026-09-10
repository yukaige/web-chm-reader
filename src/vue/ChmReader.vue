<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ChmArchive } from '../core/chm-archive'
import { splitReference } from '../core/path'
import type { ChmOpenOptions, ChmSearchResult, ChmSource } from '../core/types'
import ChmTocNode from './ChmTocNode.vue'

const props = withDefaults(defineProps<{
  source?: ChmSource | null
  initialPath?: string
  encoding?: string
  height?: string
  theme?: 'light' | 'dark' | 'auto'
  showSearch?: boolean
  locale?: 'en' | 'zh-CN'
}>(), {
  source: null,
  initialPath: '',
  encoding: 'gb18030',
  height: '720px',
  theme: 'auto',
  showSearch: true,
  locale: 'en',
})

const emit = defineEmits<{
  ready: [archive: ChmArchive]
  navigate: [path: string]
  error: [error: Error]
}>()

const archive = ref<ChmArchive>()
const loading = ref(false)
const error = ref('')
const pageHtml = ref('')
const pageTitle = ref('')
const activePath = ref('')
const iframe = ref<HTMLIFrameElement>()
const sidebarOpen = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')
const searchResults = ref<ChmSearchResult[]>([])
const searching = ref(false)
const searchProgress = ref(0)
const zoom = ref(1)
const history = ref<string[]>([])
const historyIndex = ref(-1)
let searchController: AbortController | undefined
let loadVersion = 0

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1)
const labels = computed(() => props.locale === 'zh-CN' ? {
  contents: '目录', files: '个文件', back: '后退', forward: '前进', search: '搜索',
  searchPlaceholder: '搜索整本 CHM…', searching: '搜索中', noResults: '没有找到匹配内容',
  decrease: '缩小字号', increase: '放大字号', document: 'CHM 文档', opening: '正在打开…',
  reading: '正在读取文档', cannotOpen: '无法打开', parsing: '正在解析 CHM…',
  localOnly: '文件只在本机处理，不会上传', open: '打开 CHM 文档', drop: '拖入文件，或点击选择',
} : {
  contents: 'Contents', files: 'files', back: 'Back', forward: 'Forward', search: 'Search',
  searchPlaceholder: 'Search this CHM…', searching: 'Searching', noResults: 'No matching content',
  decrease: 'Decrease font size', increase: 'Increase font size', document: 'CHM document', opening: 'Opening…',
  reading: 'Reading document', cannotOpen: 'Unable to open', parsing: 'Parsing CHM…',
  localOnly: 'Processed locally. Nothing is uploaded.', open: 'Open a CHM document', drop: 'Drop a file here, or click to choose',
})

watch(() => props.source, (source) => { void openSource(source) }, { immediate: true })

async function openSource(source: ChmSource | null | undefined): Promise<void> {
  const version = ++loadVersion
  archive.value?.close()
  archive.value = undefined
  pageHtml.value = ''
  error.value = ''
  history.value = []
  historyIndex.value = -1
  if (!source) return
  loading.value = true
  try {
    const options: ChmOpenOptions = { encoding: props.encoding }
    const opened = await ChmArchive.open(source, options)
    if (version !== loadVersion) {
      opened.close()
      return
    }
    archive.value = opened
    emit('ready', opened)
    const firstPath = props.initialPath || opened.metadata.defaultTopic
    if (firstPath) await navigate(firstPath)
  } catch (cause) {
    reportError(cause)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function navigate(reference: string, addHistory = true): Promise<void> {
  if (!archive.value) return
  const { path, suffix } = splitReference(reference)
  loading.value = true
  error.value = ''
  try {
    const page = await archive.value.render(path)
    activePath.value = page.path
    pageTitle.value = page.title
    pageHtml.value = injectReaderStyles(page.html, zoom.value)
    if (addHistory) {
      history.value = history.value.slice(0, historyIndex.value + 1)
      history.value.push(page.path)
      historyIndex.value = history.value.length - 1
    }
    sidebarOpen.value = false
    searchOpen.value = false
    emit('navigate', page.path)
    if (suffix.startsWith('#')) {
      await nextTick()
      iframe.value?.addEventListener('load', () => scrollToHash(suffix), { once: true })
    }
  } catch (cause) {
    reportError(cause)
  } finally {
    loading.value = false
  }
}

function onFrameLoad(): void {
  const document = iframe.value?.contentDocument
  if (!document) return
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-chm-path]')
    if (!target?.dataset.chmPath) return
    event.preventDefault()
    void navigate(target.dataset.chmPath)
  })
}

function scrollToHash(hash: string): void {
  const id = decodeURIComponent(hash.slice(1))
  iframe.value?.contentDocument?.getElementById(id)?.scrollIntoView()
}

async function runSearch(): Promise<void> {
  if (!archive.value || !searchQuery.value.trim()) return
  searchController?.abort()
  searchController = new AbortController()
  searching.value = true
  searchProgress.value = 0
  try {
    searchResults.value = await archive.value.search(searchQuery.value, {
      signal: searchController.signal,
      onProgress(completed, total) { searchProgress.value = total ? completed / total : 0 },
    })
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'AbortError')) reportError(cause)
  } finally {
    searching.value = false
  }
}

function moveHistory(delta: number): void {
  const next = historyIndex.value + delta
  const path = history.value[next]
  if (!path) return
  historyIndex.value = next
  void navigate(path, false)
}

function changeZoom(delta: number): void {
  zoom.value = Math.min(1.6, Math.max(0.75, Number((zoom.value + delta).toFixed(2))))
  if (activePath.value) void navigate(activePath.value, false)
}

function chooseFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void openSource(file)
}

function dropFile(event: DragEvent): void {
  const file = event.dataTransfer?.files[0]
  if (file) void openSource(file)
}

function reportError(cause: unknown): void {
  const normalized = cause instanceof Error ? cause : new Error(String(cause))
  error.value = normalized.message
  emit('error', normalized)
}

function injectReaderStyles(html: string, scale: number): string {
  const style = `<style data-vcr-reader>html{font-size:${scale}em}body{max-width:980px;margin:0 auto;padding:32px 40px 80px;box-sizing:border-box;line-height:1.72;color:#252b32;background:#fff;overflow-wrap:anywhere}img,video,svg{max-width:100%;height:auto}pre{max-width:100%;overflow:auto}table{max-width:100%;border-collapse:collapse}a{color:#356859}@media(prefers-color-scheme:dark){html[data-vcr-theme=auto] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=auto] a{color:#8fc5b2}}html[data-vcr-theme=dark] body{color:#e8e6df;background:#1b1d1c}html[data-vcr-theme=dark] a{color:#8fc5b2}</style>`
  return html.replace('<html', `<html data-vcr-theme="${props.theme}"`).replace('</head>', `${style}</head>`)
}

onBeforeUnmount(() => {
  searchController?.abort()
  archive.value?.close()
})

defineExpose({ archive, navigate, search: runSearch })
</script>

<template>
  <section class="vcr-reader" :class="`is-${theme}`" :style="{ height }" @dragover.prevent @drop.prevent="dropFile">
    <template v-if="archive">
      <header class="vcr-toolbar">
        <div class="vcr-toolbar-group">
          <button class="vcr-icon-button vcr-mobile-menu" type="button" :aria-label="labels.contents" @click="sidebarOpen = !sidebarOpen">
            <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button class="vcr-icon-button" type="button" :aria-label="labels.back" :disabled="!canGoBack" @click="moveHistory(-1)">
            <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button class="vcr-icon-button" type="button" :aria-label="labels.forward" :disabled="!canGoForward" @click="moveHistory(1)">
            <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
        <div class="vcr-document-title" :title="pageTitle || archive.metadata.title">
          <span class="vcr-title-kicker">{{ archive.metadata.title || labels.document }}</span>
          <strong>{{ pageTitle || labels.opening }}</strong>
        </div>
        <div class="vcr-toolbar-group vcr-toolbar-end">
          <button v-if="showSearch" class="vcr-icon-button" type="button" :aria-label="labels.search" @click="searchOpen = !searchOpen">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          </button>
          <button class="vcr-text-button" type="button" :aria-label="labels.decrease" @click="changeZoom(-0.1)">A−</button>
          <button class="vcr-text-button" type="button" :aria-label="labels.increase" @click="changeZoom(0.1)">A+</button>
        </div>
      </header>

      <div class="vcr-workspace">
        <aside class="vcr-sidebar" :class="{ 'is-open': sidebarOpen }">
          <div class="vcr-sidebar-heading">
            <span>{{ labels.contents }}</span>
            <small>{{ archive.entries.length }} {{ labels.files }}</small>
          </div>
          <nav aria-label="CHM 目录">
            <ul class="vcr-tree-list vcr-tree-root">
              <ChmTocNode
                v-for="item in archive.toc"
                :key="item.id"
                :item="item"
                :active-path="activePath"
                @navigate="navigate"
              />
            </ul>
          </nav>
        </aside>

        <main class="vcr-content">
          <div v-if="searchOpen" class="vcr-search-panel">
            <form class="vcr-search-form" @submit.prevent="runSearch">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input v-model="searchQuery" type="search" :placeholder="labels.searchPlaceholder" autofocus>
              <button type="submit" :disabled="searching">{{ searching ? labels.searching : labels.search }}</button>
            </form>
            <div v-if="searching" class="vcr-search-progress"><i :style="{ width: `${searchProgress * 100}%` }" /></div>
            <div class="vcr-search-results">
              <button v-for="result in searchResults" :key="result.path" type="button" @click="navigate(result.path)">
                <strong>{{ result.title }}</strong>
                <span>{{ result.excerpt }}</span>
              </button>
              <p v-if="!searching && searchQuery && !searchResults.length" class="vcr-empty-result">{{ labels.noResults }}</p>
            </div>
          </div>
          <iframe
            v-if="pageHtml"
            ref="iframe"
            class="vcr-page-frame"
            :srcdoc="pageHtml"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            :title="pageTitle"
            @load="onFrameLoad"
          />
          <div v-if="loading" class="vcr-loading" role="status"><i /><span>{{ labels.reading }}</span></div>
          <div v-if="error" class="vcr-error" role="alert"><strong>{{ labels.cannotOpen }}</strong><span>{{ error }}</span></div>
        </main>
      </div>
    </template>

    <label v-else class="vcr-dropzone">
      <input type="file" accept=".chm,application/vnd.ms-htmlhelp" @change="chooseFile">
      <span class="vcr-file-icon"><svg viewBox="0 0 48 48"><path d="M10 5h19l9 9v29H10z" /><path d="M29 5v10h9M17 24h14M17 31h14" /></svg></span>
      <strong>{{ loading ? labels.parsing : labels.open }}</strong>
      <span>{{ loading ? labels.localOnly : labels.drop }}</span>
      <small v-if="error">{{ error }}</small>
    </label>
  </section>
</template>

<style src="./reader.css" />
