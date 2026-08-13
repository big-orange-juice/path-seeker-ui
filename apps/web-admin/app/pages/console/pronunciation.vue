<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import PronunciationBatchesPanel from '@/components/pronunciation/PronunciationBatchesPanel.vue'
import PronunciationEntriesPanel from '@/components/pronunciation/PronunciationEntriesPanel.vue'
import PronunciationEntryDialog from '@/components/pronunciation/PronunciationEntryDialog.vue'
import StaleAudioPanel from '@/components/pronunciation/StaleAudioPanel.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { usePronunciationManagement } from '@/composables/usePronunciationManagement'
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum'
import type { AffectedNarration, PronunciationBatch, PronunciationEntry, PronunciationEntryDraft } from '@/types/tts-pronunciation'
import { entryStatusLabel, scopeLabel } from '@/types/tts-pronunciation'

definePageMeta({ middleware: 'admin-auth' })

const route = useRoute()
const { request } = useApiClient()
const manager = usePronunciationManagement()
const feedback = useActionFeedback()
const actingId = shallowRef('')
const entryDialogOpen = shallowRef(false)
const editingEntry = shallowRef<PronunciationEntry | null>(null)
const submittingEntry = shallowRef(false)
const generationOpen = shallowRef(false)
const generationSubmitting = shallowRef(false)
const generationDraft = reactive({ scopeType: 2, museumId: '', sourceType: 'mixed', guideId: '', materialIds: '', includeNarrations: true, text: '' })
if (typeof route.query.guideId === 'string') generationDraft.guideId = route.query.guideId
if (route.query.create === '1') generationOpen.value = true
const confirmOpen = shallowRef(false)
const confirmMode = shallowRef<'publish' | 'batch-publish' | 'regenerate'>('publish')
const targetEntry = shallowRef<PronunciationEntry | null>(null)
const targetBatch = shallowRef<PronunciationBatch | null>(null)
const targetStageIds = shallowRef<string[]>([])
const affected = shallowRef<AffectedNarration[]>([])
const affectedLoading = shallowRef(false)
const detailOpen = shallowRef(false)
const detailEntry = shallowRef<PronunciationEntry | null>(null)
const versions = shallowRef<PronunciationEntry[]>([])
const detailAffected = shallowRef<AffectedNarration[]>([])
const detailLoading = shallowRef(false)

const { data: museumData, pending: museumPending } = useAsyncData(
  'pronunciation:museums',
  () => request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 1000,
      keyword: null,
      status: null,
    },
  }),
  {
    default: () => ({
      list: [],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    }),
  },
)

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      label: String(museum.name || museum.museumCode || museum.id).trim() || String(museum.id),
    })),
)

const tabOptions = [
  { value: 'entries', label: '词条校对与共享词典' },
  { value: 'stale', label: '发音过期音频' },
] as const

const statusOptions = computed(() => manager.activeTab.value === 'batches'
  ? [{ value: -1, label: '全部状态' }, { value: 0, label: '等待中' }, { value: 1, label: '生成中' }, { value: 2, label: '已完成' }, { value: 3, label: '失败' }, { value: 4, label: '已取消' }]
  : [{ value: -1, label: '全部状态' }, { value: 0, label: '待校对' }, { value: 1, label: '已发布' }, { value: 2, label: '已拒绝' }, { value: 3, label: '已停用' }, { value: 4, label: '冲突' }])

const switchTab = (tab: typeof manager.activeTab.value) => {
  manager.activeTab.value = tab
  manager.pageIndex.value = 1
  manager.filters.status = -1
}

const perform = async (id: string, action: () => Promise<unknown>, success: string) => {
  actingId.value = id
  try {
    await action()
    feedback.success(success)
  } catch (caught) {
    feedback.errorFrom(caught)
  } finally {
    actingId.value = ''
  }
}

const openCreate = () => { editingEntry.value = null; entryDialogOpen.value = true }
const openEdit = (row: PronunciationEntry) => { editingEntry.value = row; entryDialogOpen.value = true }
const submitEntry = async (draft: PronunciationEntryDraft) => {
  submittingEntry.value = true
  try {
    await manager.saveEntry(draft, editingEntry.value?.id || undefined)
    entryDialogOpen.value = false
    feedback.success(editingEntry.value ? '词条已更新。' : '词条草稿已创建。')
  } catch (caught) {
    feedback.errorFrom(caught, '词条保存失败。')
  } finally { submittingEntry.value = false }
}

const submitGeneration = async () => {
  if (generationDraft.scopeType === 2 && !generationDraft.museumId.trim()) {
    feedback.show('馆级词典必须填写目标博物馆 ID。')
    return
  }
  if (generationDraft.sourceType === 'manual_text' && !generationDraft.text.trim()) {
    feedback.show('手工文本来源必须填写补充文本。')
    return
  }
  generationSubmitting.value = true
  try {
    await manager.createBatch({ ...generationDraft })
    generationOpen.value = false
    feedback.success('发音词典生成批次已创建。')
  } catch (caught) { feedback.errorFrom(caught, '生成批次创建失败。') }
  finally { generationSubmitting.value = false }
}

const askPublish = async (row: PronunciationEntry) => {
  if (!row.id) return
  confirmMode.value = 'publish'; targetEntry.value = row; targetBatch.value = null; targetStageIds.value = []; confirmOpen.value = true
  affectedLoading.value = true
  try { affected.value = await manager.getAffectedNarrations(row.id) } catch { affected.value = [] } finally { affectedLoading.value = false }
}

const askBatchPublish = () => {
  const entryIds = manager.selectedIds.value
  const batchId = manager.filters.batchId.trim()
  if (!entryIds.length || !batchId) {
    feedback.show('请从某个生成批次进入校对，并明确勾选要发布的词条。')
    return
  }
  targetBatch.value = { id: batchId } as PronunciationBatch
  confirmMode.value = 'batch-publish'; confirmOpen.value = true
}

const askRegenerate = (stageIds: string[]) => {
  if (!stageIds.length) return
  targetStageIds.value = stageIds
  confirmMode.value = 'regenerate'; confirmOpen.value = true
}

const confirmTitle = computed(() => confirmMode.value === 'regenerate' ? '重新生成音频' : confirmMode.value === 'batch-publish' ? '批量发布词条' : '发布发音词条')
const confirmDescription = computed(() => {
  if (confirmMode.value === 'regenerate') return `将创建 ${targetStageIds.value.length} 个 MiniMax TTS 任务，可能产生供应商费用，确认继续吗？`
  if (confirmMode.value === 'batch-publish') return `仅发布已明确勾选的 ${manager.selectedIds.value.length} 个词条。发布后相关讲解音频可能被标记为过期。`
  const entry = targetEntry.value
  const scopeText = entry?.scopeType === 2 ? `该词条将影响博物馆 ${entry.museumId || ''} 内包含该词语的讲解。` : '该词条将影响所有没有博物馆同名覆盖的讲解。'
  return `${scopeText}预计影响 ${affectedLoading.value ? '加载中' : affected.value.length} 个讲解节点，相关旧音频可能被标记为过期。`
})

const submitConfirm = async () => {
  confirmOpen.value = false
  if (confirmMode.value === 'publish' && targetEntry.value?.id) {
    await perform(targetEntry.value.id, () => manager.publishEntry(targetEntry.value!.id!), '词条已发布，相关讲解音频已标记为过期。')
  } else if (confirmMode.value === 'batch-publish' && targetBatch.value?.id) {
    await perform(targetBatch.value.id, () => manager.publishBatch(targetBatch.value!.id!, manager.selectedIds.value), '已完成所选词条的批量发布。')
  } else if (confirmMode.value === 'regenerate') {
    actingId.value = targetStageIds.value[0] || 'batch'
    try {
      const result = await manager.regenerate(targetStageIds.value)
      const failed = result?.items?.filter((item) => !item.success) ?? []
      feedback.show({ tone: failed.length ? 'info' : 'success', title: '任务提交完成', description: `已提交 ${result?.submittedCount ?? 0} 条，失败 ${failed.length} 条${failed.length ? `：${failed.map((item) => item.stageId).join('、')}` : ''}` })
      await manager.refresh()
    } catch (caught) { feedback.errorFrom(caught, '音频重生成提交失败。') } finally { actingId.value = '' }
  }
}

const reviewBatch = (row: PronunciationBatch) => {
  if (!row.id) return
  switchTab('entries'); manager.filters.batchId = row.id
}

const inspectEntry = async (row: PronunciationEntry) => {
  if (!row.id) return
  detailEntry.value = row; detailOpen.value = true; detailLoading.value = true
  try { [versions.value, detailAffected.value] = await Promise.all([manager.getEntryVersions(row.id), manager.getAffectedNarrations(row.id)]) }
  catch (caught) { feedback.errorFrom(caught, '词条详情加载失败。') }
  finally { detailLoading.value = false }
}
</script>

<template>
  <div class="admin-page-frame flex flex-col gap-4">
    <div v-if="manager.error.value" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ manager.error.value.message }}</div>
    <div class="flex flex-wrap gap-2">
      <Button v-for="tab in tabOptions" :key="tab.value" :variant="manager.activeTab.value === tab.value ? 'default' : 'outline'" @click="switchTab(tab.value)">{{ tab.label }}</Button>
    </div>
    <section class="warm-panel warm-outline rounded-xl border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div v-if="manager.activeTab.value !== 'stale'" class="w-[130px] space-y-1.5"><label class="text-sm font-medium">作用域</label><Select :model-value="String(manager.filters.scopeType)" @update:model-value="manager.filters.scopeType = Number($event)"><option value="0">全部</option><option value="1">全局</option><option value="2">博物馆</option></Select></div>
        <div class="w-[190px] space-y-1.5"><label class="text-sm font-medium">博物馆 ID</label><Input v-model="manager.filters.museumId" placeholder="按博物馆筛选" /></div>
        <div v-if="manager.activeTab.value !== 'entries'" class="w-[180px] space-y-1.5"><label class="text-sm font-medium">导游 ID</label><Input v-model="manager.filters.guideId" placeholder="按导游筛选" /></div>
        <div v-if="manager.activeTab.value === 'entries'" class="w-[200px] space-y-1.5"><label class="text-sm font-medium">批次 ID</label><Input v-model="manager.filters.batchId" placeholder="按生成批次筛选" /></div>
        <div v-if="manager.activeTab.value !== 'batches'" class="min-w-[220px] flex-1 space-y-1.5"><label class="text-sm font-medium">关键词</label><Input v-model="manager.filters.keyword" placeholder="搜索词语、路线、节点或导游" /></div>
        <div v-if="manager.activeTab.value !== 'stale'" class="w-[145px] space-y-1.5"><label class="text-sm font-medium">状态</label><Select :model-value="String(manager.filters.status)" @update:model-value="manager.filters.status = Number($event)"><option v-for="option in statusOptions" :key="option.value" :value="String(option.value)">{{ option.label }}</option></Select></div>
        <div class="flex gap-2 xl:ml-auto">
          <Button v-if="manager.activeTab.value === 'batches'" @click="generationOpen = true">新建生成批次</Button>
          <Button v-if="manager.activeTab.value === 'entries'" @click="openCreate">新增词条</Button>
          <Button v-if="manager.activeTab.value === 'entries'" :disabled="!manager.selectedIds.value.length" @click="askBatchPublish">发布所选（{{ manager.selectedIds.value.length }}）</Button>
          <Button v-if="manager.activeTab.value === 'stale'" :disabled="!manager.selectedIds.value.length" @click="askRegenerate(manager.selectedIds.value)">批量重生成（{{ manager.selectedIds.value.length }}）</Button>
          <Button variant="outline" @click="manager.resetFilters(); manager.pageIndex.value = 1; manager.refresh()">重置</Button><Button variant="outline" @click="manager.refresh()">查询</Button>
        </div>
      </div>
    </section>

    <PronunciationBatchesPanel v-if="manager.activeTab.value === 'batches'" :rows="manager.batches.value" :pending="manager.pending.value" :acting-id="actingId" @review="reviewBatch" @retry="(row) => row.id && perform(row.id, () => manager.retryBatch(row.id!), '批次已重新提交。')" @cancel="(row) => row.id && perform(row.id, () => manager.cancelBatch(row.id!), '批次已取消。')" />
    <PronunciationEntriesPanel v-else-if="manager.activeTab.value === 'entries'" :rows="manager.entries.value" :pending="manager.pending.value" :selected-ids="manager.selectedIds.value" :acting-id="actingId" @update:selected-ids="manager.selectedIds.value = $event" @edit="openEdit" @publish="askPublish" @reject="(row) => row.id && perform(row.id, () => manager.rejectEntry(row.id!), '词条已拒绝。')" @disable="(row) => row.id && perform(row.id, () => manager.disableEntry(row.id!), '词条已停用。')" @copy="(row) => row.id && perform(row.id, () => manager.copyToGlobal(row.id!), '已复制为全局词条草稿。')" @inspect="inspectEntry" />
    <StaleAudioPanel v-else :rows="manager.staleItems.value" :pending="manager.pending.value" :selected-ids="manager.selectedIds.value" :acting-id="actingId" @update:selected-ids="manager.selectedIds.value = $event" @regenerate="(row) => row.stageId && askRegenerate([row.stageId])" />

    <div class="flex items-center justify-between px-1 text-sm text-muted-foreground"><span>共 {{ manager.total.value }} 条，当前第 {{ manager.pageIndex.value }} / {{ Math.max(manager.totalPages.value, 1) }} 页</span><div class="flex gap-2"><Button variant="outline" :disabled="manager.pageIndex.value <= 1 || manager.pending.value" @click="manager.pageIndex.value--">上一页</Button><Button variant="outline" :disabled="manager.pageIndex.value >= Math.max(manager.totalPages.value, 1) || manager.pending.value" @click="manager.pageIndex.value++">下一页</Button></div></div>

    <PronunciationEntryDialog
      :open="entryDialogOpen"
      :entry="editingEntry"
      :submitting="submittingEntry"
      :museum-options="museumOptions"
      :museum-pending="museumPending"
      @update:open="entryDialogOpen = $event"
      @submit="submitEntry" />
    <Dialog v-model:open="generationOpen"><DialogContent class="max-w-[min(94vw,42rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left"><DialogHeader class="px-5 pb-2 pt-4"><DialogTitle>新建发音词典生成批次</DialogTitle><DialogDescription>选择作用域与材料来源，系统将提取多音字和专名候选词条。</DialogDescription></DialogHeader><form class="grid gap-4 px-5 py-3 sm:grid-cols-2" @submit.prevent="submitGeneration"><div class="space-y-1.5"><label class="text-sm font-medium">作用域</label><Select :model-value="String(generationDraft.scopeType)" @update:model-value="generationDraft.scopeType = Number($event)"><option value="1">全局</option><option value="2">博物馆</option></Select></div><div class="space-y-1.5"><label class="text-sm font-medium">目标博物馆 ID</label><Input v-model="generationDraft.museumId" :disabled="generationDraft.scopeType !== 2" placeholder="馆级作用域必填" /></div><div class="space-y-1.5"><label class="text-sm font-medium">来源类型</label><Select v-model="generationDraft.sourceType"><option value="materials">导游材料</option><option value="narrations">讲解词</option><option value="manual_text">手工文本</option><option value="mixed">混合</option></Select></div><div class="space-y-1.5"><label class="text-sm font-medium">导游 ID</label><Input v-model="generationDraft.guideId" placeholder="按导游读取有效材料" /></div><div class="space-y-1.5 sm:col-span-2"><label class="text-sm font-medium">材料 ID</label><Input v-model="generationDraft.materialIds" placeholder="多个 ID 使用逗号分隔；留空读取全部有效材料" /></div><div class="space-y-1.5 sm:col-span-2"><label class="text-sm font-medium">补充文本</label><textarea v-model="generationDraft.text" rows="4" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="手工文本来源必填；混合来源可补充" /></div><label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="generationDraft.includeNarrations" type="checkbox">包含已有讲解词</label><DialogFooter class="sm:col-span-2"><Button variant="outline" type="button" @click="generationOpen = false">取消</Button><Button type="submit" :disabled="generationSubmitting">创建批次</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog v-model:open="confirmOpen"><DialogContent class="max-w-[min(92vw,28rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left"><DialogHeader class="space-y-2 px-5 pb-2 pt-4"><DialogTitle>{{ confirmTitle }}</DialogTitle><DialogDescription>{{ confirmDescription }}</DialogDescription></DialogHeader><DialogFooter class="px-5 pb-4 pt-3"><Button variant="outline" @click="confirmOpen = false">取消</Button><Button @click="submitConfirm">确认</Button></DialogFooter></DialogContent></Dialog>
    <Dialog v-model:open="detailOpen"><DialogContent class="h-[86vh] max-w-[min(94vw,58rem)] overflow-y-auto rounded-xl border border-border bg-[#15171b] p-0 text-left"><DialogHeader class="px-5 pb-2 pt-4"><DialogTitle>{{ detailEntry?.phrase || '词条详情' }} · {{ detailEntry?.pronunciation }}</DialogTitle><DialogDescription>{{ scopeLabel(detailEntry?.scopeType ?? 1) }} · {{ entryStatusLabel(detailEntry?.status ?? 0) }} · 当前 v{{ detailEntry?.version ?? 0 }}</DialogDescription></DialogHeader><div class="grid gap-4 px-5 py-4 md:grid-cols-2"><section class="rounded-lg border border-border/70 p-4"><h3 class="mb-3 font-medium">版本链</h3><p v-if="detailLoading" class="text-sm text-muted-foreground">正在加载...</p><div v-for="version in versions" v-else :key="version.id || version.version" class="mb-2 rounded-md bg-secondary/40 p-3 text-sm"><div class="flex justify-between"><strong>v{{ version.version }} · {{ version.pronunciation }}</strong><span>{{ entryStatusLabel(version.status) }}</span></div><p class="mt-1 text-xs text-muted-foreground">{{ version.remark || '无备注' }}</p></div><p v-if="!detailLoading && !versions.length" class="text-sm text-muted-foreground">暂无历史版本。</p></section><section class="rounded-lg border border-border/70 p-4"><h3 class="mb-3 font-medium">影响范围（{{ detailAffected.length }}）</h3><p v-if="detailLoading" class="text-sm text-muted-foreground">正在加载...</p><div v-for="item in detailAffected" v-else :key="item.stageId || item.routeId" class="mb-2 rounded-md bg-secondary/40 p-3 text-sm"><p>{{ item.museumName || item.museumId || '未关联博物馆' }}</p><p class="text-xs text-muted-foreground">{{ item.routeTitle || item.routeId }} / {{ item.stageTitle || item.stageId }}</p></div><p v-if="!detailLoading && !detailAffected.length" class="text-sm text-muted-foreground">暂无受影响讲解。</p></section></div></DialogContent></Dialog>
  </div>
</template>
