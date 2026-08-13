<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue'
import type { PronunciationEntry } from '@/types/tts-pronunciation'
import { entryStatusLabel, scopeLabel } from '@/types/tts-pronunciation'

const props = defineProps<{
  rows: PronunciationEntry[]
  selectedIds: string[]
  pending?: boolean
  actingId?: string
}>()

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
  edit: [row: PronunciationEntry]
  publish: [row: PronunciationEntry]
  reject: [row: PronunciationEntry]
  disable: [row: PronunciationEntry]
  copy: [row: PronunciationEntry]
  inspect: [row: PronunciationEntry]
}>()

const toggle = (id: string, checked: boolean) => {
  emit(
    'update:selectedIds',
    checked ? [...props.selectedIds, id] : props.selectedIds.filter((item) => item !== id),
  )
}
</script>

<template>
  <div class="warm-panel warm-outline overflow-x-auto rounded-xl border border-border/70">
    <table class="w-full min-w-[900px] table-fixed text-sm">
      <thead class="border-b border-border/70 text-left text-xs text-muted-foreground">
        <tr>
          <th class="w-14 p-3">选择</th>
          <th class="w-[22%] px-3 py-3">词语</th>
          <th class="w-[25%] px-3 py-3">拼音</th>
          <th class="w-36 px-3 py-3">作用域</th>
          <th class="w-20 px-3 py-3">状态</th>
          <th class="w-16 px-3 py-3">版本</th>
          <th class="px-3 py-3">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="pending">
          <td colspan="7" class="h-28 text-center text-muted-foreground">正在加载词条...</td>
        </tr>
        <tr
          v-for="row in rows"
          v-else
          :key="row.id || row.createdAt"
          class="border-b border-border/40 last:border-0"
        >
          <td class="p-3 align-middle">
            <input
              v-if="row.id && (row.status === 0 || row.status === 4)"
              type="checkbox"
              :checked="selectedIds.includes(row.id)"
              @change="toggle(row.id, ($event.target as HTMLInputElement).checked)"
            >
          </td>
          <td class="px-3 py-3 align-middle">
            <p class="break-words font-medium leading-5">{{ row.phrase || '—' }}</p>
          </td>
          <td class="px-3 py-3 align-middle">
            <p class="break-words font-mono text-xs leading-5 text-primary">{{ row.pronunciation || '—' }}</p>
          </td>
          <td class="px-3 py-3 align-middle">
            <p>{{ scopeLabel(row.scopeType) }}</p>
            <p v-if="row.museumId" class="truncate text-xs text-muted-foreground" :title="row.museumId">
              {{ row.museumId }}
            </p>
          </td>
          <td class="px-3 py-3 align-middle">
            <span class="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs">
              {{ entryStatusLabel(row.status) }}
            </span>
          </td>
          <td class="px-3 py-3 align-middle text-muted-foreground">v{{ row.version }}</td>
          <td class="px-3 py-3 align-middle">
            <div class="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" @click="emit('inspect', row)">详情</Button>
              <Button v-if="row.status === 0 || row.status === 4" size="sm" variant="outline" @click="emit('edit', row)">编辑</Button>
              <Button v-if="row.status === 0 || row.status === 4" size="sm" :disabled="actingId === row.id" @click="emit('publish', row)">发布</Button>
              <Button v-if="row.status === 0 || row.status === 4" size="sm" variant="secondary" @click="emit('reject', row)">拒绝</Button>
              <Button v-if="row.status === 1" size="sm" variant="secondary" @click="emit('disable', row)">停用</Button>
              <Button v-if="row.status === 1 && row.scopeType === 2" size="sm" variant="outline" @click="emit('copy', row)">复制到全局</Button>
            </div>
          </td>
        </tr>
        <tr v-if="!pending && !rows.length">
          <td colspan="7" class="h-28 text-center text-muted-foreground">暂无发音词条。</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
