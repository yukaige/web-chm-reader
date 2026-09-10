<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChmReader } from '../src/vue'

interface FrameworkDemo {
  id: string
  label: string
  language: string
  filename: string
  code: string
}

const source = ref<File | null>(null)
const activeFramework = ref('vanilla')
const copied = ref('')

const demos: FrameworkDemo[] = [
  {
    id: 'vanilla',
    label: 'JavaScript',
    language: 'HTML + JavaScript',
    filename: 'index.js',
    code: [
      "import 'web-chm-reader/element'",
      "import 'web-chm-reader/style.css'",
      '',
      "const reader = document.querySelector('chm-reader')",
      "const input = document.querySelector('#file')",
      '',
      "input.addEventListener('change', (event) => {",
      '  reader.source = event.target.files[0]',
      '})',
      '',
      '// <input id="file" type="file" accept=".chm">',
      '// <chm-reader height="720px"></chm-reader>',
    ].join('\n'),
  },
  {
    id: 'react',
    label: 'React',
    language: 'TSX',
    filename: 'App.tsx',
    code: [
      "import { ChmReader } from 'web-chm-reader/react'",
      "import 'web-chm-reader/style.css'",
      '',
      'export default function App() {',
      '  return (',
      '    <ChmReader',
      '      height="720px"',
      '      theme="auto"',
      '      onError={console.error}',
      '    />',
      '  )',
      '}',
    ].join('\n'),
  },
  {
    id: 'vue',
    label: 'Vue',
    language: 'Vue SFC',
    filename: 'App.vue',
    code: [
      '<script setup lang="ts">',
      "import { ChmReader } from 'web-chm-reader/vue'",
      "import 'web-chm-reader/style.css'",
      '<\/script>',
      '',
      '<template>',
      '  <ChmReader',
      '    height="720px"',
      '    theme="auto"',
      '    @error="console.error"',
      '  />',
      '</template>',
    ].join('\n'),
  },
  {
    id: 'svelte',
    label: 'Svelte',
    language: 'Svelte',
    filename: 'App.svelte',
    code: [
      '<script lang="ts">',
      "  import 'web-chm-reader/element'",
      "  import 'web-chm-reader/style.css'",
      '  let reader: HTMLElement & { source: File | null }',
      '<\/script>',
      '',
      '<input type="file" accept=".chm" onchange={(event) => {',
      '  reader.source = event.currentTarget.files?.[0] ?? null',
      '}}>',
      '<chm-reader bind:this={reader} height="720px"></chm-reader>',
    ].join('\n'),
  },
  {
    id: 'solid',
    label: 'SolidJS',
    language: 'TSX',
    filename: 'App.tsx',
    code: [
      "import 'web-chm-reader/element'",
      "import 'web-chm-reader/style.css'",
      '',
      'export default function App() {',
      '  let reader!: HTMLElement & { source: File | null }',
      '  return <>',
      '    <input type="file" accept=".chm" onChange={(event) => {',
      '      reader.source = event.currentTarget.files?.[0] ?? null',
      '    }} />',
      '    <chm-reader ref={reader} height="720px" />',
      '  </>',
      '}',
    ].join('\n'),
  },
]

const activeDemo = computed(() => demos.find((demo) => demo.id === activeFramework.value) ?? demos[0])

function chooseFile(event: Event): void {
  source.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function scrollToDemo(): void {
  document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' })
}

async function copy(text: string, key: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  copied.value = key
  window.setTimeout(() => {
    if (copied.value === key) copied.value = ''
  }, 1600)
}
</script>

<template>
  <div class="site">
    <header class="site-nav">
      <a class="brand" href="#" aria-label="web-chm-reader home">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M7 5.5h12.5L25 11v15.5H7z" />
          <path d="M19.5 5.5V11H25M11.5 16h9M11.5 20h9" />
        </svg>
        <span>web-chm-reader</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#demo">Demo</a>
        <a href="#frameworks">Frameworks</a>
        <a href="#api">API</a>
        <a href="https://github.com/yukaige/web-chm-reader" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
      <a class="language-link" href="https://github.com/yukaige/web-chm-reader/blob/main/README.zh-CN.md">中文</a>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <h1>Read CHM files<br>anywhere on the web.</h1>
          <p>A browser-first CHM reader for JavaScript, React, Vue, Svelte and SolidJS. Private by design—your files never leave the browser.</p>
          <div class="hero-actions">
            <button type="button" class="primary-action" @click="scrollToDemo">
              Try the live demo
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
            </button>
            <button type="button" class="install-command" @click="copy('npm install web-chm-reader', 'install')">
              <code>npm install web-chm-reader</code>
              <span>{{ copied === 'install' ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>
        </div>
        <div class="hero-aside" aria-label="Library highlights">
          <div><strong>Local-first</strong><span>No uploads or server required</span></div>
          <div><strong>Legacy-ready</strong><span>LZX, GB18030 and Big5 support</span></div>
          <div><strong>Framework-free core</strong><span>Use only the layer you need</span></div>
        </div>
      </section>

      <section id="demo" class="demo-section">
        <div class="section-heading">
          <div>
            <h2>Open a real CHM file</h2>
            <p>Drop a document into the reader. Parsing, search and rendering happen entirely on this device.</p>
          </div>
          <label class="open-button">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6.5h5l1.5 2h6.5v7H3.5z" /><path d="M3.5 6.5V4h5l1.5 2" /></svg>
            Choose CHM
            <input type="file" accept=".chm,application/vnd.ms-htmlhelp" @change="chooseFile">
          </label>
        </div>
        <ChmReader :source="source" locale="en" height="min(760px, calc(100vh - 130px))" />
      </section>

      <section id="frameworks" class="frameworks-section">
        <div class="section-heading frameworks-heading">
          <div>
            <h2>One reader, every web stack</h2>
            <p>Use a native component for React or Vue, the standard custom element everywhere else, or call the TypeScript core directly.</p>
          </div>
        </div>
        <div class="code-workbench">
          <div class="framework-tabs" role="tablist" aria-label="Framework examples">
            <button
              v-for="demo in demos"
              :key="demo.id"
              type="button"
              role="tab"
              :aria-selected="activeFramework === demo.id"
              :class="{ active: activeFramework === demo.id }"
              @click="activeFramework = demo.id"
            >
              {{ demo.label }}
            </button>
          </div>
          <div class="code-panel">
            <header>
              <span>{{ activeDemo.filename }}</span>
              <small>{{ activeDemo.language }}</small>
              <button type="button" @click="copy(activeDemo.code, activeDemo.id)">
                <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="1" /><path d="M13 7V4H4v9h3" /></svg>
                {{ copied === activeDemo.id ? 'Copied' : 'Copy code' }}
              </button>
            </header>
            <pre><code>{{ activeDemo.code }}</code></pre>
          </div>
          <aside class="integration-note">
            <strong>{{ activeDemo.label }}</strong>
            <p v-if="activeDemo.id === 'react' || activeDemo.id === 'vue'">Dedicated component entry with typed props, events and imperative navigation.</p>
            <p v-else>Uses the standards-based <code>&lt;chm-reader&gt;</code> element—no framework adapter required.</p>
            <a href="https://github.com/yukaige/web-chm-reader#readme">Read the full guide <span>→</span></a>
          </aside>
        </div>
      </section>

      <section id="api" class="api-section">
        <div class="api-copy">
          <h2>The core stays small<br>and predictable.</h2>
          <p>Read raw entries, render a safe page, inspect the table of contents or build your own search interface.</p>
          <a href="https://github.com/yukaige/web-chm-reader#core-api">Explore the API on GitHub</a>
        </div>
        <pre class="api-code"><code><span>import</span> { ChmArchive } <span>from</span> 'web-chm-reader'

<span>const</span> archive = <span>await</span> ChmArchive.open(file)

archive.metadata
archive.toc
<span>await</span> archive.render('/index.html')
<span>await</span> archive.search('installation')

archive.close()</code></pre>
      </section>
    </main>

    <footer class="site-footer">
      <a class="brand" href="#"><span>web-chm-reader</span></a>
      <p>MIT licensed. Built for documents that still matter.</p>
      <div><a href="https://github.com/yukaige/web-chm-reader">GitHub</a><a href="https://www.npmjs.com/package/web-chm-reader">npm</a></div>
    </footer>
  </div>
</template>
