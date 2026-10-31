<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { parseStageConfig } from '@path-seeker/game-renderer'
import type { RouteNodeResponse } from '@/types/route'

const props = defineProps<{
  node: RouteNodeResponse
  nodes: RouteNodeResponse[]
  disabled: boolean
}>()
const { request } = useApiClient()
const selected = shallowRef('')
const saved = shallowRef('')
const predecessors = computed(() => props.nodes.slice(0, -1))
const missing = computed(() => selected.value && !predecessors.value.some(node => node.stageId === selected.value))
watch(() => [props.node.stageId, props.node.config], () => {
  const config = parseStageConfig(props.node.config) as Record<string, unknown>
  saved.value = typeof config.auto_trigger_prerequisite_stage_id === 'string' ? config.auto_trigger_prerequisite_stage_id : ''
  selected.value = saved.value
}, { immediate: true })

async function save() {
  if (selected.value === saved.value) return
  if (missing.value) throw new Error('前序站点已不在路线中，请重新选择。')
  await request('/api/route/stage-auto-trigger', {
    method: 'POST',
    body: { stageId: props.node.stageId, prerequisiteStageId: selected.value || null },
  })
  saved.value = selected.value
}
defineExpose({ save })
</script>

<template>
  <section class="space-y-2 border-t border-border/60 pt-4">
    <label class="block max-w-xl space-y-1.5 text-sm font-medium">
      终点自动触发
      <select v-model="selected" aria-label="终点自动触发前序站点" :disabled="props.disabled"
        class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
        <option value="">进入范围即可触发</option>
        <option v-if="missing" :value="selected">原前序站点已移出，请重新选择</option>
        <option v-for="(node, index) in predecessors" :key="node.stageId || index" :value="node.stageId || ''">
          到访第 {{ index + 1 }} 站「{{ node.title }}」后解锁
        </option>
      </select>
    </label>
    <p class="text-xs text-muted-foreground">只限制终点自动到站；无需听完前序站点解说，手动浏览与播放仍可使用。</p>
  </section>
</template>
