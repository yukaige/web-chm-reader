<script setup lang="ts">
import { ref } from 'vue'
import { ChmReader } from '../src/vue'

const source = ref<File | null>(null)
</script>

<template>
  <main class="demo-shell">
    <header class="demo-header">
      <div>
        <span class="demo-eyebrow">LOCAL · PRIVATE · FAST</span>
        <h1>Vue CHM Reader</h1>
        <p>在浏览器中直接打开 Microsoft HTML Help 文档。</p>
      </div>
      <label class="demo-open-button">
        选择 CHM
        <input type="file" accept=".chm" @change="source = ($event.target as HTMLInputElement).files?.[0] ?? null">
      </label>
    </header>
    <ChmReader :source="source" height="min(760px, calc(100vh - 210px))" />
  </main>
</template>
