<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import GuideDataTable from '@/components/guides/GuideDataTable.vue'
import GuideDetailDialog from '@/components/guides/GuideDetailDialog.vue'
import GuideFormDialog from '@/components/guides/GuideFormDialog.vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  createEmptyGuideDraft,
  createGuideDraftFromRecord,
  useGuideManagement,
} from '@/composables/useGuideManagement'
import {
  GUIDE_STATUS_OPTIONS,
  GUIDE_VOICE_STATUS_OPTIONS,
  type GuideDraft,
  type GuideRecord,
  type TtsVoiceResponse,
} from '@/types/guide'

definePageMeta({
  middleware: 'admin-auth',
})

const {
  keyword,
  status,
  voiceStatus,
  rows,
  pending,
  error,
  refresh,
  pageIndex,
  pageSize,
  total,
  totalPages,
  setPage,
  setPageSize,
  resetFilters,
  fetchGuideDetail,
  fetchTtsVoices,
  saveGuide,
  deleteGuide,
} = useGuideManagement()

const formOpen = shallowRef(false)
const formMode = shallowRef<'create' | 'edit'>('create')
const formDraft = shallowRef<GuideDraft>(createEmptyGuideDraft())
const formSubmitting = shallowRef(false)
const formError = shallowRef('')
const voiceOptions = shallowRef<TtsVoiceResponse[]>([])
const voiceLoading = shallowRef(false)

const detailOpen = shallowRef(false)
const detailPending = shallowRef(false)
const detailRecord = shallowRef<GuideRecord | null>(null)

const confirmOpen = shallowRef(false)
const confirmRecord = shallowRef<GuideRecord | null>(null)
const actionPendingIds = shallowRef<string[]>([])
const actionError = shallowRef('')
const actionFeedback = shallowRef('')

const loadVoiceOptions = async (keyword?: string) => {
  voiceLoading.value = true
  try {
    voiceOptions.value = await fetchTtsVoices(keyword)
  } catch {
    voiceOptions.value = []
  } finally {
    voiceLoading.value = false
  }
}

const searchVoiceOptions = useDebounceFn((keyword: string) => {
  // 仅编辑弹窗需要音色列表
  if (!formOpen.value || formMode.value !== 'edit') {
    return
  }
  void loadVoiceOptions(keyword)
}, 300)

watch(formOpen, (open) => {
  if (open && formMode.value === 'edit') {
    void loadVoiceOptions()
  }
})

const startCreate = () => {
  formMode.value = 'create'
  formDraft.value = createEmptyGuideDraft()
  formError.value = ''
  formOpen.value = true
}

const startEdit = async (record: GuideRecord) => {
  if (record.isGenerating) {
    return
  }

  formMode.value = 'edit'
  formError.value = ''
  formDraft.value = createGuideDraftFromRecord(record)
  formOpen.value = true

  try {
    const detail = await fetchGuideDetail(record.id)
    if (detail) {
      formDraft.value = createGuideDraftFromRecord(detail)
    }
  } catch {
    // 列表数据可继续编辑
  }
}

const openDetail = async (record: GuideRecord) => {
  detailRecord.value = record
  detailOpen.value = true
  detailPending.value = true
  actionError.value = ''

  try {
    const detail = await fetchGuideDetail(record.id)
    if (detail) {
      detailRecord.value = detail
    }
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : '导游详情加载失败。'
  } finally {
    detailPending.value = false
  }
}

const handleFormSubmit = async (draft: GuideDraft) => {
  formSubmitting.value = true
  formError.value = ''
  actionFeedback.value = ''

  try {
    await saveGuide(draft, formMode.value)
    // 异步接口返回后即可关闭并刷新列表
    formOpen.value = false
    actionFeedback.value =
      formMode.value === 'edit'
        ? '导游已提交更新，生成完成后可在列表中查看。'
        : '导游已提交创建，生成完成后可在列表中查看。'
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : '导游保存失败。'
  } finally {
    formSubmitting.value = false
  }
}

const refreshGuideRow = async (record: GuideRecord) => {
  if (actionPendingIds.value.includes(record.id)) {
    return
  }

  actionPendingIds.value = [...actionPendingIds.value, record.id]
  actionError.value = ''
  actionFeedback.value = ''

  try {
    await refresh()
    actionFeedback.value = `已刷新「${record.name || record.guideCode || record.id}」。`
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : '导游列表刷新失败。'
  } finally {
    actionPendingIds.value = actionPendingIds.value.filter((item) => item !== record.id)
  }
}

const askRemove = (record: GuideRecord) => {
  confirmRecord.value = record
  confirmOpen.value = true
  actionError.value = ''
}

const finishActing = (id: string) => {
  actionPendingIds.value = actionPendingIds.value.filter((item) => item !== id)
}

const submitRemove = async () => {
  const record = confirmRecord.value
  if (!record) {
    return
  }

  if (actionPendingIds.value.includes(record.id)) {
    return
  }

  actionPendingIds.value = [...actionPendingIds.value, record.id]
  actionError.value = ''
  actionFeedback.value = ''

  try {
    await deleteGuide(record.id)
    confirmOpen.value = false
    confirmRecord.value = null
    if (detailRecord.value?.id === record.id) {
      detailOpen.value = false
      detailRecord.value = null
    }
    actionFeedback.value = '导游已删除。'
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : '导游删除失败。'
  } finally {
    finishActing(record.id)
  }
}

const handleDetailEdit = (record: GuideRecord) => {
  detailOpen.value = false
  void startEdit(record)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div
      v-if="error"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error.message || '导游数据加载失败。' }}
    </div>
    <div
      v-if="formError"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ formError }}
    </div>
    <div
      v-if="actionError"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ actionError }}
    </div>
    <div
      v-if="actionFeedback"
      class="rounded-[0.85rem] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {{ actionFeedback }}
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[260px] flex-1 space-y-2">
          <label class="text-sm font-medium text-foreground">关键词</label>
          <Input v-model="keyword" placeholder="搜索名称、简介" />
        </div>
        <div class="w-[150px] space-y-2">
          <label class="text-sm font-medium text-foreground">状态</label>
          <Select :model-value="String(status)" @update:model-value="status = Number($event)">
            <option
              v-for="option in GUIDE_STATUS_OPTIONS"
              :key="option.value"
              :value="String(option.value)"
            >
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[150px] space-y-2">
          <label class="text-sm font-medium text-foreground">音色状态</label>
          <Select :model-value="String(voiceStatus)" @update:model-value="voiceStatus = Number($event)">
            <option
              v-for="option in GUIDE_VOICE_STATUS_OPTIONS"
              :key="option.value"
              :value="String(option.value)"
            >
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button @click="startCreate">
            <AppIcon name="user-round" class="h-4 w-4" />
            新增导游
          </Button>
          <Button variant="outline" @click="resetFilters">
            重置筛选
          </Button>
          <Button variant="outline" @click="refresh()">
            刷新
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页
        </div>
        <div class="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-muted-foreground">
          <span class="whitespace-nowrap">每页</span>
          <Select
            :model-value="String(pageSize)"
            class="w-[78px] shrink-0"
            @update:model-value="setPageSize(Number($event))"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
          <Button
            variant="outline"
            class="shrink-0 whitespace-nowrap"
            :disabled="pageIndex <= 1 || pending"
            @click="setPage(pageIndex - 1)"
          >
            上一页
          </Button>
          <Button
            variant="outline"
            class="shrink-0 whitespace-nowrap"
            :disabled="pageIndex >= Math.max(totalPages, 1) || pending"
            @click="setPage(pageIndex + 1)"
          >
            下一页
          </Button>
        </div>
      </div>

      <GuideDataTable
        :rows="rows"
        :pending="pending"
        :acting-ids="actionPendingIds"
        @detail="openDetail"
        @edit="startEdit"
        @remove="askRemove"
        @refresh-row="refreshGuideRow"
      />
    </section>

    <GuideFormDialog
      v-model:open="formOpen"
      :mode="formMode"
      :initial-value="formDraft"
      :submitting="formSubmitting"
      :voice-options="voiceOptions"
      :voice-loading="voiceLoading"
      @submit="handleFormSubmit"
      @search-voice="searchVoiceOptions"
    />

    <GuideDetailDialog
      v-model:open="detailOpen"
      :record="detailRecord"
      :pending="detailPending"
      @edit="handleDetailEdit"
    />

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>删除导游</DialogTitle>
          <DialogDescription>
            确认删除「{{ confirmRecord?.name || confirmRecord?.guideCode || '该导游' }}」吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" @click="confirmOpen = false">
            取消
          </Button>
          <Button
            variant="secondary"
            type="button"
            :disabled="!confirmRecord || actionPendingIds.includes(confirmRecord.id)"
            @click="submitRemove"
          >
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
