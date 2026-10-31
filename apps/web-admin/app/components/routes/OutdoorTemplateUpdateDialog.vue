<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import type { OutdoorTemplatePreview } from '@/types/outdoor-template'

const props = defineProps<{ open: boolean; routeId: string; templateCode: string; canEdit: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; applied: [] }>()
const { request } = useApiClient()
const preview = shallowRef<OutdoorTemplatePreview | null>(null)
const pending = shallowRef(false)
const error = shallowRef('')
const applied = shallowRef(false)
const model = computed({ get: () => props.open, set: value => { if (!pending.value) emit('update:open', value) } })
const reusedCount = computed(() => preview.value?.stations.filter(station => station.existingStageId).length ?? 0)
let revision = 0

async function load() {
  const token = ++revision
  preview.value = null
  applied.value = false
  error.value = ''
  pending.value = true
  try {
    const result = await request<OutdoorTemplatePreview>('/api/route/template-preview', {
      method: 'POST', body: { routeId: props.routeId, fixedRouteCode: props.templateCode },
    })
    if (token === revision) preview.value = result
  } catch (caught) { if (token === revision) error.value = caught instanceof Error ? caught.message : '模板预览失败。' }
  finally { if (token === revision) pending.value = false }
}

async function apply() {
  if (!preview.value || pending.value || !props.canEdit || applied.value) return
  pending.value = true
  error.value = ''
  try {
    await request('/api/route/template-apply', {
      method: 'POST', body: { routeId: props.routeId, fixedRouteCode: props.templateCode, previewToken: preview.value.previewToken },
    })
    applied.value = true
    emit('applied')
    // 节点更新与地图同步分开报告，避免同步失败后重复应用已经完成的编排。
    try {
      await request('/api/route-map/sync-stations', { method: 'POST', body: { routeId: props.routeId } })
    } catch { error.value = '节点已更新，地图同步失败。请关闭后点击“保存编排”重试。' }
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '模板更新失败，请重新预览。' }
  finally { pending.value = false }
}

watch(() => [props.open, props.routeId, props.templateCode] as const, ([open]) => {
  if (open) void load()
  else { revision++; pending.value = false }
})
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="flex h-[85vh] max-w-[620px] flex-col rounded-xl p-0">
      <DialogHeader class="border-b px-5 py-3 text-left">
        <DialogTitle>按模板更新路线</DialogTitle>
        <DialogDescription>按当前 {{ templateCode }} 线模板调整站点，复用站点保留已有解说和素材。</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-3">
        <p v-if="pending && !preview" class="text-sm text-muted-foreground">正在预览变更…</p>
        <template v-if="preview">
          <p class="text-sm">共 {{ preview.stations.length }} 站 · 复用 {{ reusedCount }} 站 · 新增 {{ preview.stations.length - reusedCount }} 站 · 移出 {{ preview.removedStations.length }} 站</p>
          <ol class="divide-y rounded-lg border">
            <li v-for="station in preview.stations" :key="station.order" class="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div><strong>{{ station.order }}. {{ station.title }}</strong><p class="text-xs text-muted-foreground">定位景点：{{ station.placeName }}<template v-if="station.previousTitle && station.previousTitle !== station.title"> · 原站名：{{ station.previousTitle }}</template></p></div>
              <span class="shrink-0 text-xs" :class="station.existingStageId ? 'text-muted-foreground' : 'text-emerald-300'">{{ station.existingStageId ? '复用' : '新增' }}</span>
            </li>
          </ol>
          <div v-if="preview.removedStations.length" class="space-y-1 rounded-lg border border-amber-500/30 p-3 text-sm">
            <p class="font-medium">将移出本路线的站点</p>
            <p>{{ preview.removedStations.map(station => station.title).join('、') }}</p>
            <p class="text-xs text-muted-foreground">移出后无法通过此页面恢复；景点资料和原附件文件保留。应用前请确认已安排需要迁移的内容。</p>
          </div>
          <p class="text-xs text-muted-foreground">新增站点需补齐解说与媒体；合并路段的正文需重新整理。地图路段需重新检查。已发布、待审核或仍有进行中游览的路线不能应用更新。</p>
          <p v-if="applied" class="text-sm text-emerald-300" role="status">路线节点已按模板更新。</p>
        </template>
        <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      </div>
      <DialogFooter class="border-t px-5 py-3">
        <Button variant="outline" :disabled="pending" @click="model = false">{{ applied ? '完成' : '取消' }}</Button>
        <Button v-if="!applied" variant="outline" :disabled="pending" @click="load">重新预览</Button>
        <Button v-if="!applied" :disabled="pending || !preview || !canEdit" @click="apply">{{ pending ? '处理中…' : '确认按模板更新' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
