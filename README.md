# web-chm-reader

<p align="center">
  <a href="./README.zh-CN.md"><img src="https://img.shields.io/badge/阅读中文-356859?style=for-the-badge" alt="阅读中文"></a>
</p>

A browser-first TypeScript library for reading Microsoft HTML Help (`.chm`) files. Use the framework-agnostic core API, the standard Web Component, or dedicated React and Vue components. Files are read locally in the browser and are never uploaded.

**[Try the live demo](https://yukaige.github.io/web-chm-reader/)**

## Features

- ITSF/ITSP container parsing and LZX decompression
- `.hhc` table of contents and `/#SYSTEM` metadata
- GB2312, GBK, GB18030, Big5, UTF-8, and BOM-aware text decoding
- Automatic rewriting for internal links, images, stylesheets, fonts, and CSS resources
- Full-text search, navigation history, font scaling, and light/dark themes
- Sanitized HTML rendered in a restricted iframe
- Works with vanilla JavaScript, React, Vue, Svelte, and SolidJS
- Lazy `Blob`/`File` slicing keeps large archives out of memory

## Install

```bash
npm install web-chm-reader
```

React and Vue are optional peer dependencies. The core API and Web Component do not require a UI framework.

## Vanilla JavaScript / Web Component

```js
import 'web-chm-reader/element'
import 'web-chm-reader/style.css'

const reader = document.querySelector('chm-reader')

document.querySelector('#file').addEventListener('change', (event) => {
  reader.source = event.target.files[0]
})
```

```html
<input id="file" type="file" accept=".chm">
<chm-reader height="720px" theme="auto"></chm-reader>
```

## React

```tsx
import { ChmReader } from 'web-chm-reader/react'
import 'web-chm-reader/style.css'

export default function App() {
  return <ChmReader height="720px" onError={console.error} />
}
```

## Vue 3

```vue
<script setup lang="ts">
import { ChmReader } from 'web-chm-reader/vue'
import 'web-chm-reader/style.css'
</script>

<template>
  <ChmReader height="720px" @error="console.error" />
</template>
```

## Svelte

```svelte
<script lang="ts">
  import 'web-chm-reader/element'
  import 'web-chm-reader/style.css'

  let reader: HTMLElement & { source: File | null }
</script>

<input type="file" accept=".chm" onchange={(event) => {
  reader.source = event.currentTarget.files?.[0] ?? null
}}>
<chm-reader bind:this={reader} height="720px"></chm-reader>
```

## SolidJS

```tsx
import 'web-chm-reader/element'
import 'web-chm-reader/style.css'

export default function App() {
  let reader!: HTMLElement & { source: File | null }

  return <>
    <input type="file" accept=".chm" onChange={(event) => {
      reader.source = event.currentTarget.files?.[0] ?? null
    }} />
    <chm-reader ref={reader} height="720px" />
  </>
}
```

Svelte and SolidJS can also call the framework-agnostic core API directly.

## Core API

```ts
import { ChmArchive } from 'web-chm-reader'

const archive = await ChmArchive.open(file, { encoding: 'gb18030' })

archive.metadata
archive.toc
archive.entries
await archive.readBinary(path)
await archive.readText(path)
await archive.render(path)
await archive.search('installation')
archive.close()
```

`Blob` and `File` sources are sliced on demand. Use `ArrayBuffer` or `Uint8Array` when the archive is already in memory.

## Component options

| React / Vue | Web Component | Default | Description |
| --- | --- | --- | --- |
| `source` | `.source` property | `null` | `Blob`, `ArrayBuffer`, or `Uint8Array` source |
| `initialPath` | `initial-path` | `''` | Initial archive page |
| `encoding` | `encoding` | `'gb18030'` | Fallback encoding |
| `height` | `height` | `'720px'` | Reader height |
| `theme` | `theme` | `'auto'` | `light`, `dark`, or `auto` |
| `showSearch` | `show-search` | `true` | Show full-text search |

React exposes `navigate(path)`, `search(query)`, and `archive` through its ref. Vue exposes the same methods from the component instance. The Web Component exposes them directly on the element.

## Security model

Scripts, event handlers, forms, embedded objects, and unsafe URLs are removed by default. Pages render inside a sandboxed iframe without script permission. External links open in a new tab; external images and styles are not fetched automatically.

## Known limitations

- Text-based `.hhc` navigation is supported. Archives with only a binary TOC use a generated HTML-file fallback.
- The first full-text search must decompress each HTML page and can take time on very large archives.
- ActiveX, script-driven navigation, merged external CHM archives, and Internet Explorer-only behavior are not executed.

## Development

```bash
npm install
npm run dev
npm run check
```

The format engine is provided by `chmlib-ts`. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for licenses.
