<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue'
import type { PronunciationEntry } from '@/types/tts-pronunciation'
import { entryStatusLabel, scopeLabel } from '@/types/tts-pronunciation'

const props = defineProps<{ rows: PronunciationEntry[]; selectedIds: string[]; pending?: boolean; actingId?: string }>()
const emit = defineEmits<{ 'update:selectedIds': [ids: string[]]; edit: [row: PronunciationEntry]; publish: [row: PronunciationEntry]; reject: [row: PronunciationEntry]; disable: [row: PronunciationEntry]; copy: [row: PronunciationEntry]; inspect: [row: PronunciationEntry] }>()
const toggle = (id: string, checked: boolean) => emit('update:selectedIds', checked ? [...props.selectedIds, id] : props.selectedIds.filter((item) => item !== id))
</script>

<template>
  <div class="warm-panel warm-outline overflow-x-auto rounded-xl border border-border/70">
    <table class="w-full min-w-[1120px] text-sm">
      <thead class="border-b border-border/70 text-left text-xs text-muted-foreground"><tr><th class="p-3">选择</th><th>词语 / 拼音</th><th>分类</th><th>作用域</th><th>置信度</th><th>证据与校验</th><th>状态</th><th>版本</th><th class="pr-3">操作</th></tr></thead>
      <tbody>
        <tr v-if="pending"><td colspan="9" class="h-28 text-center text-muted-foreground">正在加载词条...</td></tr>
        <tr v-for="row in rows" v-else :key="row.id || row.createdAt" class="border-b border-border/40 last:border-0">
          <td class="p-3"><input v-if="row.id && (row.status === 0 || row.status === 4)" type="checkbox" :checked="selectedIds.includes(row.id)" @change="toggle(row.id, ($event.target as HTMLInputElement).checked)"></td>
          <td><p class="font-medium">{{ row.phrase || '—' }}</p><p class="font-mono text-xs text-primary">{{ row.pronunciation || '—' }}</p></td>
          <td>{{ row.category || '—' }}</td><td><p>{{ scopeLabel(row.scopeType) }}</p><p class="max-w-28 truncate text-xs text-muted-foreground">{{ row.museumId || '—' }}</p></td>
          <td>{{ row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}%` }}</td>
          <td><p class="max-w-52 truncate text-xs text-muted-foreground" :title="row.evidenceJson || ''">{{ row.evidenceJson || '无原文证据' }}</p><p class="max-w-52 truncate text-xs text-amber-200" :title="row.validationJson || ''">{{ row.validationJson || '—' }}</p></td>
          <td><span class="rounded-md bg-secondary px-2 py-1 text-xs">{{ entryStatusLabel(row.status) }}</span></td><td>v{{ row.version }}</td>
          <td class="pr-3"><div class="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" @click="emit('inspect', row)">详情</Button><Button v-if="row.status === 0 || row.status === 4" size="sm" variant="outline" @click="emit('edit', row)">编辑</Button><Button v-if="row.status === 0 || row.status === 4" size="sm" :disabled="actingId === row.id" @click="emit('publish', row)">发布</Button><Button v-if="row.status === 0 || row.status === 4" size="sm" variant="secondary" @click="emit('reject', row)">拒绝</Button><Button v-if="row.status === 1" size="sm" variant="secondary" @click="emit('disable', row)">停用</Button><Button v-if="row.status === 1 && row.scopeType === 2" size="sm" variant="outline" @click="emit('copy', row)">复制到全局</Button></div></td>
        </tr>
        <tr v-if="!pending && !rows.length"><td colspan="9" class="h-28 text-center text-muted-foreground">暂无发音词条。</td></tr>
      </tbody>
    </table>
  </div>
</template>
