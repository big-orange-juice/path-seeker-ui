<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import CollectionCandidateDiffDialog from '@/components/collections/CollectionCandidateDiffDialog.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { useCollectionImport, useCollectionSearch } from '@/composables/useCollectionImport'
import { COLLECTION_IMPORT_TARGET_TYPE } from '@/types/collection-import'
import type { CollectionImportCandidate } from '@/types/collection-import'

/**
 * 「AI 联网补充资料」弹窗。
 *
 * 入口挂在景点新增 / 编辑弹窗内，因此打开时默认锁定为「文化点」并按当前景点预填对象，
 * 也仍允许后台用户改成按名称检索。
 *
 * 设计依据 doc/b-admin-functional-optimization-plan.md §7：检索产物写入与导入同一套
 * collection_import_candidate 契约，因此结果继续复用导入的候选预览 / 差异确认 /
 * 逐条或批量确认 / 提交入库流程，不另写一套预览与确认界面。
 */
const props = defineProps<{
  museumId: string
  /** 针对单条典藏发起检索时传入 */
  exhibits?: { id: string; name: string; code?: string | null }[]
  /** 针对单条景点发起检索时传入 */
  places?: { id: string; name: string; code?: string | null }[]
}>()

const emit = defineEmits<{ finished: [] }>()

const actionFeedback = useActionFeedback()

const search = useCollectionSearch()
const { submitting, polling, error: searchError, task } = search

const importer = useCollectionImport()
const {
  candidates,
  busy,
  error: importError,
  confirmCandidates,
  skipCandidates,
  commitImport,
  loadBatchCandidates,
} = importer

const open = shallowRef(false)
const candidatesOpen = shallowRef(false)
const detailCandidate = shallowRef<CollectionImportCandidate | null>(null)

const form = shallowRef({
  targetType: COLLECTION_IMPORT_TARGET_TYPE.EXHIBIT as number,
  targetId: '',
  objectName: '',
  objectCode: '',
  fields: '',
})

/** 候选清单跟随对象类型切换，避免把景点 ID 当作文物目标提交 */
const optionsFor = (targetType: number) =>
  targetType === COLLECTION_IMPORT_TARGET_TYPE.CULTURAL_PLACE ? props.places ?? [] : props.exhibits ?? []

const objectOptions = computed(() => optionsFor(form.value.targetType))

const canSubmit = computed(() => Boolean(props.museumId) && Boolean(form.value.targetId || form.value.objectName.trim()))

function openDialog(preset?: { id: string; name: string; code?: string | null; targetType?: number }) {
  search.reset()
  form.value = {
    targetType: preset?.targetType ?? COLLECTION_IMPORT_TARGET_TYPE.EXHIBIT,
    targetId: preset?.id ?? '',
    objectName: preset?.name ?? '',
    objectCode: preset?.code ?? '',
    fields: '',
  }
  open.value = true
}

function applyObjectSelection(targetId: string) {
  const matched = objectOptions.value.find((item) => item.id === targetId)
  form.value = {
    ...form.value,
    targetId,
    objectName: matched?.name ?? form.value.objectName,
    objectCode: matched?.code ?? form.value.objectCode,
  }
}

/** 切换对象类型后旧的目标 ID 不再属于新清单，直接丢弃以免提交错对象 */
function changeTargetType(value: string) {
  const targetType = Number(value)
  const keep = optionsFor(targetType).some((item) => item.id === form.value.targetId)
  form.value = { ...form.value, targetType, targetId: keep ? form.value.targetId : '' }
}

async function submit() {
  const fields = form.value.fields
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const ok = await search.submit({
    museumId: props.museumId,
    targetType: form.value.targetType,
    targetId: form.value.targetId || null,
    objectName: form.value.objectName.trim() || null,
    objectCode: form.value.objectCode.trim() || null,
    fields: fields.length ? fields : null,
  })

  if (!ok) {
    return
  }

  actionFeedback.success('检索任务已提交，完成后在候选条目中确认。')

  const done = await search.pollTask()
  if (!done) {
    return
  }

  // 检索结果写入同一份候选条目契约，打开导入的候选预览继续确认
  open.value = false
  candidatesOpen.value = true
  await loadBatchCandidates(search.candidateBatchId.value)
}

function handleConfirmOne(candidateId: string) {
  detailCandidate.value = null
  void confirmCandidates([candidateId]).then((ok) => {
    if (ok) actionFeedback.success('已确认该行。')
  })
}

function handleSkipOne(candidateId: string) {
  detailCandidate.value = null
  void skipCandidates([candidateId]).then((ok) => {
    if (ok) actionFeedback.success('已跳过该行。')
  })
}

async function commit() {
  const ok = await commitImport()
  if (ok) {
    actionFeedback.success('已提交入库，请核对结果统计。')
    emit('finished')
  }
}

function closeDetail(value: boolean) {
  if (!value) detailCandidate.value = null
}

defineExpose({ openDialog })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-[min(94vw,32rem)] p-0">
      <DialogHeader class="border-b px-5 py-3">
        <DialogTitle>AI 联网补充资料</DialogTitle>
        <p class="mt-1 text-xs text-muted-foreground">
          按景点或文物检索公开资料来源，结果需人工逐条确认后才会写入；默认只补空值，覆盖已有字段必须确认。
        </p>
      </DialogHeader>

      <form class="space-y-3 px-5 py-4" @submit.prevent="submit">
        <label class="block space-y-1.5 text-sm">
          <span class="font-medium">对象类型</span>
          <Select :model-value="String(form.targetType)" @update:model-value="changeTargetType($event)">
            <option :value="String(COLLECTION_IMPORT_TARGET_TYPE.EXHIBIT)">文物</option>
            <option :value="String(COLLECTION_IMPORT_TARGET_TYPE.CULTURAL_PLACE)">文化点 / 景点</option>
          </Select>
        </label>

        <label v-if="objectOptions.length" class="block space-y-1.5 text-sm">
          <span class="font-medium">从当前列表选择（可选）</span>
          <Select :model-value="form.targetId" searchable @update:model-value="applyObjectSelection($event)">
            <option value="">不指定，按名称检索并生成新建草稿</option>
            <option v-for="item in objectOptions" :key="item.id" :value="item.id">
              {{ item.name }}{{ item.code ? ` / ${item.code}` : '' }}
            </option>
          </Select>
        </label>

        <label class="block space-y-1.5 text-sm">
          <span class="font-medium">对象名称</span>
          <Input v-model="form.objectName" placeholder="例如：青花缠枝莲纹瓶" />
        </label>

        <label class="block space-y-1.5 text-sm">
          <span class="font-medium">业务编码（可选）</span>
          <Input v-model="form.objectCode" placeholder="用于草稿编码与匹配提示" />
        </label>

        <label class="block space-y-1.5 text-sm">
          <span class="font-medium">检索字段（可选，逗号分隔）</span>
          <Input v-model="form.fields" placeholder="留空使用默认字段集，例如：年代,尺寸,来源" />
        </label>

        <p
          v-if="searchError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ searchError }}
        </p>
        <p v-if="!props.museumId" class="text-xs text-amber-200">请先选择所属场馆/目的地。</p>
      </form>

      <DialogFooter class="gap-2 border-t px-5 py-3">
        <Button variant="outline" size="sm" :disabled="submitting || polling" @click="open = false">
          关闭
        </Button>
        <Button size="sm" :disabled="!canSubmit || submitting || polling" @click="submit">
          {{ submitting || polling ? '检索中…' : '开始联网检索' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 检索结果进入与导入相同的候选预览与确认流程 -->
  <Dialog v-model:open="candidatesOpen">
    <DialogContent class="max-h-[92vh] max-w-[min(96vw,1000px)] overflow-hidden p-0">
      <DialogHeader class="border-b px-5 py-3">
        <DialogTitle>检索结果候选条目</DialogTitle>
        <p class="mt-1 text-xs text-muted-foreground">
          渠道：{{ task?.provider || '—' }}<template v-if="task?.model"> / {{ task.model }}</template>
          · 与导入共用同一份候选条目与确认流程；未确认的行不会写入。
        </p>
      </DialogHeader>

      <div class="max-h-[62vh] min-h-0 overflow-y-auto px-5 py-4">
        <table class="w-full text-sm">
          <thead class="bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">序号</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-left">匹配</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!candidates.length">
              <td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">
                暂无候选条目。任务可能仍在执行，请稍后重试或到导入页刷新。
              </td>
            </tr>
            <tr v-for="candidate in candidates" :key="candidate.id" class="border-t">
              <td class="px-3 py-2 text-muted-foreground">{{ candidate.rowNo }}</td>
              <td class="px-3 py-2 text-xs">{{ candidate.statusText }}</td>
              <td class="px-3 py-2 text-xs">
                <span v-if="candidate.targetId" class="text-amber-200">命中既有对象</span>
                <span v-else class="text-muted-foreground">新建草稿</span>
                <span v-if="candidate.uncertainFields.length" class="ml-1 text-amber-200">· {{ candidate.uncertainFields.length }} 项待确认</span>
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-1.5">
                  <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="detailCandidate = candidate">证据与差异</Button>
                  <Button v-if="candidate.status === 0" variant="outline" size="sm" class="h-7 px-2 text-xs" @click="handleConfirmOne(candidate.id)">确认</Button>
                  <Button v-if="candidate.status === 0" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="handleSkipOne(candidate.id)">跳过</Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DialogFooter class="gap-2 border-t px-5 py-3">
        <p v-if="importError" class="mr-auto text-xs text-destructive">{{ importError }}</p>
        <Button variant="outline" size="sm" @click="candidatesOpen = false">关闭</Button>
        <Button size="sm" :disabled="busy" @click="commit">
          {{ busy ? '提交中…' : '提交入库（仅已确认项）' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <CollectionCandidateDiffDialog
    :open="detailCandidate !== null"
    :candidate="detailCandidate"
    @update:open="closeDetail"
    @confirm="handleConfirmOne"
    @skip="handleSkipOne" />
</template>
