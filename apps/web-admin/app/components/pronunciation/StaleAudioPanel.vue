<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue'
import type { AffectedNarration } from '@/types/tts-pronunciation'
import { pronunciationStatusLabel } from '@/types/tts-pronunciation'

const props = defineProps<{ rows: AffectedNarration[]; selectedIds: string[]; pending?: boolean; actingId?: string }>()
const emit = defineEmits<{ 'update:selectedIds': [ids: string[]]; regenerate: [row: AffectedNarration] }>()
const toggle = (id: string, checked: boolean) => {
  const next = checked ? [...props.selectedIds, id] : props.selectedIds.filter((item) => item !== id)
  if (next.length <= 100) emit('update:selectedIds', next)
}
</script>

<template>
  <div class="warm-panel warm-outline overflow-x-auto rounded-xl border border-border/70">
    <table class="w-full min-w-[900px] text-sm">
      <thead class="border-b border-border/70 text-left text-xs text-muted-foreground"><tr><th class="p-3">选择</th><th>博物馆</th><th>路线 / 节点</th><th>导游</th><th>发音状态</th><th>音频状态</th><th>音频附件</th><th class="pr-3">操作</th></tr></thead>
      <tbody>
        <tr v-if="pending"><td colspan="8" class="h-28 text-center text-muted-foreground">正在加载过期音频...</td></tr>
        <tr v-for="row in rows" v-else :key="row.stageId || row.routeId || row.stageTitle" class="border-b border-border/40 last:border-0">
          <td class="p-3"><input v-if="row.stageId" type="checkbox" :checked="selectedIds.includes(row.stageId)" @change="toggle(row.stageId, ($event.target as HTMLInputElement).checked)"></td>
          <td>{{ row.museumName || row.museumId || '—' }}</td><td><p>{{ row.routeTitle || row.routeId || '—' }}</p><p class="text-xs text-muted-foreground">{{ row.stageTitle || row.stageId || '—' }}</p></td><td>{{ row.guideName || row.guideId || '—' }}</td>
          <td><span class="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-200">{{ pronunciationStatusLabel(row.pronunciationStatus) }}</span></td><td>{{ row.audioStatus }}</td><td class="max-w-36 truncate" :title="row.audioAttachmentId || ''">{{ row.audioAttachmentId || '—' }}</td>
          <td class="pr-3"><Button size="sm" variant="outline" :disabled="!row.stageId || actingId === row.stageId" @click="emit('regenerate', row)">重新生成</Button></td>
        </tr>
        <tr v-if="!pending && !rows.length"><td colspan="8" class="h-28 text-center text-muted-foreground">暂无发音过期音频。</td></tr>
      </tbody>
    </table>
  </div>
</template>
