<script setup lang="ts">
import { ref } from 'vue'
import type { ChmTocItem } from '../core/types'

defineOptions({ name: 'ChmTocNode' })

const props = defineProps<{
  item: ChmTocItem
  activePath?: string
  depth?: number
}>()

const emit = defineEmits<{
  navigate: [path: string]
}>()

const expanded = ref((props.depth ?? 0) < 1)
</script>

<template>
  <li class="vcr-tree-item">
    <div
      class="vcr-tree-row"
      :class="{ 'is-active': item.path === activePath }"
      :style="{ '--vcr-depth': depth ?? 0 }"
    >
      <button
        v-if="item.children.length"
        type="button"
        class="vcr-tree-toggle"
        :aria-label="expanded ? '折叠' : '展开'"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 5 4.5-5 4.5" /></svg>
      </button>
      <span v-else class="vcr-tree-spacer" />
      <button
        type="button"
        class="vcr-tree-label"
        :disabled="!item.path"
        :title="item.label"
        @click="item.path && emit('navigate', item.path)"
      >
        {{ item.label }}
      </button>
    </div>
    <ul v-if="item.children.length && expanded" class="vcr-tree-list">
      <ChmTocNode
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :active-path="activePath"
        :depth="(depth ?? 0) + 1"
        @navigate="emit('navigate', $event)"
      />
    </ul>
  </li>
</template>
