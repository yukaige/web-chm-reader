# vue-chm-reader

在浏览器中读取 `.chm` 的 TypeScript 库，包含框架无关的核心 API 和 Vue 3 阅读器组件。文件按需切片读取，内容不会上传到服务器。

在线体验：[https://yukaige.github.io/vue-chm-reader/](https://yukaige.github.io/vue-chm-reader/)

## 功能

- 解析 ITSF/ITSP 与 LZX 压缩内容
- 读取 `.hhc` 目录和 `/#SYSTEM` 元数据
- 支持 GB2312、GBK、GB18030、Big5、UTF-8 等旧文档编码
- 自动改写 HTML 内部链接、图片、样式表和 CSS 资源
- 全文搜索、前进后退、字号与亮暗主题
- HTML 清理与受限 iframe 渲染
- 无 `.hhc` 时自动用 HTML 文件生成后备目录

## 安装

```bash
npm install vue-chm-reader
```

## Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ChmReader } from 'vue-chm-reader/vue'
import 'vue-chm-reader/style.css'

const file = ref<File | null>(null)
</script>

<template>
  <input
    type="file"
    accept=".chm"
    @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
  >
  <ChmReader :source="file" height="720px" />
</template>
```

组件本身也带有拖放和文件选择空状态，所以也可以只写：

```vue
<ChmReader height="720px" />
```

### 组件属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `source` | `Blob \| ArrayBuffer \| Uint8Array \| null` | `null` | CHM 数据源 |
| `initialPath` | `string` | `''` | 首次打开的内部页面 |
| `encoding` | `string` | `'gb18030'` | 无编码声明时的回退编码 |
| `height` | `string` | `'720px'` | 阅读器高度 |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | 主题 |
| `showSearch` | `boolean` | `true` | 是否显示全文搜索 |

事件包括 `ready(archive)`、`navigate(path)` 和 `error(error)`。组件实例暴露 `navigate(path)`、`search()` 与 `archive`。

## 核心 API

```ts
import { ChmArchive } from 'vue-chm-reader'

const file = input.files![0]
const archive = await ChmArchive.open(file, { encoding: 'gb18030' })

console.log(archive.metadata)
console.log(archive.toc)
console.log(archive.entries)

const page = await archive.render(archive.metadata.defaultTopic!)
const results = await archive.search('安装')
const rawImage = await archive.readBinary('/images/logo.png')

archive.close()
```

`Blob`/`File` 会按需切片读取；`ArrayBuffer` 与 `Uint8Array` 适合已经在内存里的数据。调用 `close()` 会同时释放阅读时生成的 Blob URL。

## 本地开发

```bash
npm install
npm run dev
npm run check
```

## 安全边界

默认会清理脚本、事件处理器、表单、嵌入对象，并在没有脚本权限的 sandbox iframe 中显示页面。外部链接会在新窗口打开。若传入 `{ sanitize: false }`，iframe 仍不允许脚本，但只应对可信 CHM 使用该选项。

## 已知限制

- 目前读取文本型 `.hhc` 目录；只有二进制 TOC 且没有 `.hhc` 的文件会使用后备目录。
- 全文搜索首次执行时需要逐页解压；超大文档可通过 `AbortSignal` 取消。
- ActiveX、脚本驱动导航、外部 CHM 合并和旧版 IE 专属行为不会执行。

底层格式解析由 `chmlib-ts` 提供，相关许可证见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
