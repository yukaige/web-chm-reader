# web-chm-reader

在浏览器中读取 `.chm` 的 TypeScript 库。提供框架无关的核心 API、标准 Web Component，以及 React、Vue 3 阅读器组件。文件按需切片读取，内容不会上传到服务器。

在线体验：[https://yukaige.github.io/web-chm-reader/](https://yukaige.github.io/web-chm-reader/)

## 功能

- 解析 ITSF/ITSP 与 LZX 压缩内容
- 读取 `.hhc` 目录和 `/#SYSTEM` 元数据
- 支持 GB2312、GBK、GB18030、Big5、UTF-8 等旧文档编码
- 自动改写 HTML 内部链接、图片、样式表和 CSS 资源
- 全文搜索、前进后退、字号与亮暗主题
- HTML 清理与受限 iframe 渲染
- 原生 JavaScript、React、Vue、Svelte 和 SolidJS 可用

## 安装

```bash
npm install web-chm-reader
```

Vue 和 React 都是可选 peer dependency。核心 API 和 Web Component 不需要安装 UI 框架。

## 原生 JavaScript / Web Component

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

也可以只使用核心 API：

```ts
import { ChmArchive } from 'web-chm-reader'

const archive = await ChmArchive.open(file, { encoding: 'gb18030' })
const page = await archive.render(archive.metadata.defaultTopic!)
const results = await archive.search('安装')
archive.close()
```

## React

```tsx
import { ChmReader } from 'web-chm-reader/react'
import 'web-chm-reader/style.css'

export default function App() {
  return <ChmReader height="720px" onError={console.error} />
}
```

通过 `ref` 可调用 `navigate(path)`、`search(query)` 并取得 `archive`。

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

<input type="file" accept=".chm" on:change={(event) => {
  reader.source = event.currentTarget.files?.[0] ?? null
}}>
<chm-reader bind:this={reader} height="720px" />
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

Svelte、SolidJS 也可以绕过 Web Component，直接调用框架无关的 `ChmArchive` API。

## 通用配置

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `source` | `null` | `Blob \| ArrayBuffer \| Uint8Array` CHM 数据源 |
| `initialPath` / `initial-path` | `''` | 首次打开的内部页面 |
| `encoding` | `'gb18030'` | 无编码声明时的回退编码 |
| `height` | `'720px'` | 阅读器高度 |
| `theme` | `'auto'` | `light`、`dark` 或 `auto` |
| `showSearch` / `show-search` | `true` | 是否显示全文搜索 |

## 核心 API

```ts
archive.metadata
archive.toc
archive.entries
await archive.readBinary(path)
await archive.readText(path)
await archive.render(path)
await archive.search(query)
archive.close()
```

`Blob`/`File` 会按需切片读取；`ArrayBuffer` 与 `Uint8Array` 适合已经在内存里的数据。

## 本地开发

```bash
npm install
npm run dev
npm run check
```

## 安全边界

默认会清理脚本、事件处理器、表单、嵌入对象，并在没有脚本权限的 sandbox iframe 中显示页面。外部链接会在新窗口打开，外部图片和样式资源不会自动请求。

## 已知限制

- 目前读取文本型 `.hhc` 目录；只有二进制 TOC 且没有 `.hhc` 的文件会使用后备目录。
- 全文搜索首次执行时需要逐页解压；超大文档可通过 `AbortSignal` 取消。
- ActiveX、脚本驱动导航、外部 CHM 合并和旧版 IE 专属行为不会执行。

底层格式解析由 `chmlib-ts` 提供，相关许可证见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
