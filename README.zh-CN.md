# web-chm-reader

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/Read_in_English-356859?style=for-the-badge" alt="Read in English"></a>
</p>

在浏览器中读取 Microsoft HTML Help（`.chm`）文件的 TypeScript 库。提供框架无关的核心 API、标准 Web Component，以及 React、Vue 组件。文件始终在本地浏览器中读取，不会上传服务器。

**[在线体验](https://yukaige.github.io/web-chm-reader/)**

## 功能

- 解析 ITSF/ITSP 容器与 LZX 压缩内容
- 读取 `.hhc` 目录和 `/#SYSTEM` 元数据
- 支持 GB2312、GBK、GB18030、Big5、UTF-8 及 BOM 编码识别
- 自动改写内部链接、图片、样式表、字体和 CSS 资源
- 全文搜索、前进后退、字号调整和亮暗主题
- 清理 HTML，并在受限 iframe 中安全显示
- 支持原生 JavaScript、React、Vue、Svelte 和 SolidJS
- `Blob`/`File` 按需切片读取，避免大文件全部进入内存

## 安装

```bash
npm install web-chm-reader
```

React 和 Vue 都是可选 peer dependency。核心 API 和 Web Component 不需要任何 UI 框架。

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

Svelte 和 SolidJS 也可以跳过 Web Component，直接调用框架无关的核心 API。

## 核心 API

```ts
import { ChmArchive } from 'web-chm-reader'

const archive = await ChmArchive.open(file, { encoding: 'gb18030' })

archive.metadata
archive.toc
archive.entries
await archive.readBinary(path)
await archive.readText(path)
await archive.render(path)
await archive.search('安装')
archive.close()
```

`Blob` 和 `File` 会按需切片读取；文件已经在内存中时可以使用 `ArrayBuffer` 或 `Uint8Array`。

## 通用配置

| React / Vue | Web Component | 默认值 | 说明 |
| --- | --- | --- | --- |
| `source` | `.source` 属性 | `null` | `Blob`、`ArrayBuffer` 或 `Uint8Array` |
| `initialPath` | `initial-path` | `''` | 首次打开的包内页面 |
| `encoding` | `encoding` | `'gb18030'` | 无编码声明时的回退编码 |
| `height` | `height` | `'720px'` | 阅读器高度 |
| `theme` | `theme` | `'auto'` | `light`、`dark` 或 `auto` |
| `showSearch` | `show-search` | `true` | 是否显示全文搜索 |

React 通过 ref 暴露 `navigate(path)`、`search(query)` 和 `archive`；Vue 从组件实例暴露相同方法；Web Component 直接从元素实例调用。

## 安全模型

默认移除脚本、事件处理器、表单、嵌入对象和不安全 URL。页面在不允许脚本的 sandbox iframe 中显示。外部链接在新标签打开，外部图片和样式不会自动请求。

## 已知限制

- 支持文本型 `.hhc` 目录；只有二进制 TOC 的文档会使用自动生成的 HTML 文件目录。
- 首次全文搜索需要逐页解压，超大文档可能需要一些时间。
- 不执行 ActiveX、脚本驱动导航、外部 CHM 合并及 Internet Explorer 专属行为。

## 本地开发

```bash
npm install
npm run dev
npm run check
```

底层格式引擎由 `chmlib-ts` 提供，许可证见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
