<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue'
import type { PronunciationBatch } from '@/types/tts-pronunciation'
import { batchStatusLabel, scopeLabel } from '@/types/tts-pronunciation'

defineProps<{ rows: PronunciationBatch[]; pending?: boolean; actingId?: string }>()
const emit = defineEmits<{ retry: [row: PronunciationBatch]; cancel: [row: PronunciationBatch]; review: [row: PronunciationBatch] }>()
const dateText = (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '—'
</script>

<template>
  <div class="warm-panel warm-outline overflow-x-auto rounded-xl border border-border/70">
    <table class="w-full min-w-[980px] text-sm">
      <thead class="border-b border-border/70 text-left text-xs text-muted-foreground"><tr><th class="p-3">批次</th><th>作用域</th><th>来源</th><th>状态</th><th>统计</th><th>创建时间</th><th class="pr-3">操作</th></tr></thead>
      <tbody>
        <tr v-if="pending"><td colspan="7" class="h-28 text-center text-muted-foreground">正在加载生成批次...</td></tr>
        <tr v-for="row in rows" v-else :key="row.id || row.createdAt" class="border-b border-border/40 last:border-0">
          <td class="p-3"><p class="max-w-40 truncate font-medium" :title="row.id || ''">{{ row.id || '—' }}</p><p class="text-xs text-muted-foreground">任务 {{ row.taskId || '—' }}</p></td>
          <td><p>{{ scopeLabel(row.scopeType) }}</p><p class="max-w-32 truncate text-xs text-muted-foreground">{{ row.museumId || '—' }}</p></td>
          <td><p>{{ row.sourceType || '—' }}</p><p class="max-w-32 truncate text-xs text-muted-foreground">导游 {{ row.guideId || '—' }}</p></td>
          <td><span class="rounded-md bg-secondary px-2 py-1 text-xs">{{ batchStatusLabel(row.status) }}</span><p v-if="row.errorMessage" class="mt-1 max-w-44 truncate text-xs text-rose-300" :title="row.errorMessage">{{ row.errorMessage }}</p></td>
          <td class="text-xs leading-5 text-muted-foreground">候选 {{ row.candidateCount }} · 有效 {{ row.validCount }}<br>冲突 {{ row.conflictCount }} · 未解决 {{ row.unresolvedCount }} · 已发布 {{ row.publishedCount }}</td>
          <td class="text-xs text-muted-foreground">{{ dateText(row.createdAt) }}</td>
          <td class="pr-3"><div class="flex gap-1.5"><Button size="sm" variant="outline" :disabled="!row.id" @click="emit('review', row)">校对</Button><Button v-if="row.status === 3" size="sm" variant="outline" :disabled="actingId === row.id" @click="emit('retry', row)">重试</Button><Button v-if="row.status === 0 || row.status === 1" size="sm" variant="secondary" :disabled="actingId === row.id" @click="emit('cancel', row)">取消</Button></div></td>
        </tr>
        <tr v-if="!pending && !rows.length"><td colspan="7" class="h-28 text-center text-muted-foreground">暂无生成批次。</td></tr>
      </tbody>
    </table>
  </div>
</template>
