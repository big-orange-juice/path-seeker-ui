<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import type { RouteMapDetail } from '@/types/route-map'
import type { RouteNodeResponse } from '@/types/route'

const props = defineProps<{ routeId: string; nodes: RouteNodeResponse[]; selectedStageId: string; canEdit: boolean }>()
const emit = defineEmits<{ select: [stageId: string]; edit: [stageId: string]; changed: [] }>()
const { request } = useApiClient()
const detail = shallowRef<RouteMapDetail | null>(null)
const error = shallowRef('')
const pending = shallowRef(false)
const ordered = computed(() => [...props.nodes].sort((left, right) => (left.sortOrder || left.stageNo) - (right.sortOrder || right.stageNo)))
let version = 0

async function load() {
  const token = ++version
  try {
    const result = await request<RouteMapDetail>('/api/route-map/get', { query: { routeId: props.routeId } })
    if (token === version) detail.value = result
  } catch (caught) { if (token === version) error.value = caught instanceof Error ? caught.message : '地图加载失败。' }
}

async function reorder(index: number, delta: number) {
  if (pending.value || !props.canEdit) return
  const target = index + delta
  if (target < 0 || target >= ordered.value.length) return
  const ids = ordered.value.map(node => node.stageId)
  if (ids.some(id => !id)) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  pending.value = true
  error.value = ''
  try {
    await request('/api/route/stage-reorder', { method: 'POST', body: { routeId: props.routeId, orderedStageIds: ids } })
    await request('/api/route-map/sync-stations', { method: 'POST', body: { routeId: props.routeId } })
    await load()
    emit('changed')
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '顺序保存失败。' }
  finally { pending.value = false }
}

watch(() => [props.routeId, props.nodes], () => void load(), { immediate: true })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative min-h-[16rem] flex-1 overflow-hidden rounded-lg border"><RouteMapCanvas :detail="detail" :focused-stage-id="selectedStageId" @select="emit('select', $event)" @edit="canEdit && emit('edit', $event)" @error="error = $event" /></div>
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    <ol class="max-h-[25vh] space-y-1 overflow-auto"><li v-for="(node, index) in ordered" :key="node.stageId || index" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" :class="node.stageId === selectedStageId ? 'border-primary/50 bg-primary/10' : 'border-border'" @dblclick="canEdit && node.stageId && emit('edit', node.stageId)"><button type="button" class="min-w-0 flex-1 truncate text-left" :disabled="pending" @click="node.stageId && emit('select', node.stageId)">{{ index + 1 }}. {{ node.title }}</button><Button v-if="canEdit" type="button" size="sm" variant="ghost" :disabled="pending || index === 0" @click="reorder(index, -1)">上移</Button><Button v-if="canEdit" type="button" size="sm" variant="ghost" :disabled="pending || index === ordered.length - 1" @click="reorder(index, 1)">下移</Button></li></ol>
  </div>
</template>
