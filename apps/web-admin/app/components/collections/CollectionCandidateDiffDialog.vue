<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import {
  candidateStatusText,
  evidenceSourceText,
  flattenDraft,
  parseFieldEvidence,
  parseImageLinks,
  parseOverwrite,
  targetTypeText,
} from '@/types/collection-import'
import type { CollectionImportCandidate } from '@/types/collection-import'

const props = withDefaults(defineProps<{
  open: boolean
  candidate: CollectionImportCandidate | null
}>(), {
  candidate: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [candidateId: string]
  skip: [candidateId: string]
}>()

const model = computed({ get: () => props.open, set: value => emit('update:open', value) })

/** 模板列名（CollectionImportSchema.Columns）到中文标签；draft 里其余字段按原名展示 */
const FIELD_LABELS: Record<string, string> = {
  code: '业务编码',
  exhibitCode: '业务编码',
  name: '名称',
  category: '分类',
  galleryId: '所属场馆',
  gallery: '所属场馆',
  siteAreaId: '所属区域',
  siteArea: '所属区域',
  description: '简介',
  dynasty: '年代',
  size: '尺寸',
  source: '来源',
  images: '图片文件名',
}

const fieldLabel = (field: string): string => {
  const head = field.split('.')[0] ?? field
  return FIELD_LABELS[field] ?? FIELD_LABELS[head] ?? field
}

const draftEntries = computed(() => flattenDraft(props.candidate?.draft ?? null))

const overwrite = computed(() => parseOverwrite(props.candidate?.overwrite ?? null))

const imageView = computed(() => parseImageLinks(props.candidate?.imageLinks ?? null))

const evidence = computed(() => parseFieldEvidence(props.candidate?.fieldEvidence ?? null))

const evidenceEntries = computed(() => {
  const current = evidence.value
  if (!current) return []
  return Object.entries(current.fields).map(([field, detail]) => ({
    field,
    label: fieldLabel(field),
    detail,
    source: detail.source ?? current.source,
    url: detail.url ?? '',
    title: detail.title ?? '',
    excerpt: detail.excerpt ?? '',
    retrievedAt: detail.retrievedAt ?? current.retrievedAt,
    rowNo: detail.rowNo ?? '',
    column: detail.column ?? '',
    rawValue: detail.rawValue ?? '',
  }))
})

const isPending = computed(() => Number(props.candidate?.status ?? -1) === 0)

const isExhibit = computed(() => Number(props.candidate?.targetType ?? 1) === 1)

const usageText = (usage: string): string => (usage === 'cover' ? '封面/主图' : '细节图')
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="max-h-[92vh] max-w-[min(96vw,1100px)] overflow-hidden p-0">
      <DialogHeader class="border-b px-5 py-3">
        <div class="pr-8">
          <DialogTitle>
            候选条目 · 第 {{ candidate?.rowNo ?? '-' }} 行
            <span v-if="candidate?.targetName" class="ml-2 text-sm font-normal text-muted-foreground">
              （匹配既有对象：{{ candidate.targetName }}）
            </span>
          </DialogTitle>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ candidate ? targetTypeText(candidate.targetType) : '' }} ·
            {{ candidate ? candidateStatusText(candidate.status) : '' }} ·
            {{ candidate?.targetId ? '命中既有对象，将对象级覆盖' : '新建对象' }}
            <template v-if="candidate?.matchEvidence"> · 匹配依据：{{ candidate.matchEvidence }}</template>
          </p>
        </div>
      </DialogHeader>

      <div class="max-h-[68vh] min-h-0 overflow-y-auto px-5 py-4">
        <p v-if="candidate?.errorMessage" class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          写入失败：{{ candidate.errorMessage }}
        </p>

        <!-- 将被覆盖的字段：旧值 vs 新值 -->
        <section v-if="overwrite && overwrite.fields.length" class="mb-5">
          <h3 class="mb-2 text-sm font-medium">将被覆盖的字段（旧值 → 新值）</h3>
          <div class="overflow-hidden rounded-md border">
            <table class="w-full text-sm">
              <thead class="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">字段</th>
                  <th class="px-3 py-2 text-left">旧值</th>
                  <th class="px-3 py-2 text-left">新值</th>
                  <th class="px-3 py-2 text-left">类型</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="change in overwrite.fields" :key="change.field" class="border-t">
                  <td class="px-3 py-2 align-top">{{ change.label || fieldLabel(change.field) }}</td>
                  <td class="px-3 py-2 align-top text-muted-foreground">{{ change.oldValue || '（空）' }}</td>
                  <td class="px-3 py-2 align-top text-amber-200">{{ change.newValue || '（空）' }}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">
                    {{ change.change === 'fill' ? '补全空值' : '改写既有值' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">确认即接受对象级覆盖；未确认的行不会写入。</p>
        </section>

        <section v-if="overwrite && overwrite.retained.length" class="mb-5">
          <h3 class="mb-2 text-sm font-medium">本次导入未提供、保留既有值的字段</h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="change in overwrite.retained"
              :key="change.field"
              class="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              {{ change.label || fieldLabel(change.field) }}：{{ change.oldValue || '（空）' }}
            </span>
          </div>
        </section>

        <!-- 拟写入字段 -->
        <section class="mb-5">
          <h3 class="mb-2 text-sm font-medium">拟写入字段（共 {{ draftEntries.length }} 项）</h3>
          <p v-if="!draftEntries.length" class="text-sm text-muted-foreground">草稿为空。</p>
          <div v-else class="grid gap-1.5 sm:grid-cols-2">
            <div
              v-for="entry in draftEntries"
              :key="entry.field"
              class="flex items-start justify-between gap-3 rounded-md border px-3 py-1.5 text-xs">
              <span class="shrink-0 text-muted-foreground">{{ fieldLabel(entry.field) }}</span>
              <span class="min-w-0 break-all text-right">{{ entry.value }}</span>
            </div>
          </div>
        </section>

        <!-- 待人工确认字段 -->
        <section v-if="candidate?.uncertainFields.length" class="mb-5">
          <h3 class="mb-2 text-sm font-medium">待人工确认字段</h3>
          <ul class="space-y-1.5">
            <li
              v-for="field in candidate.uncertainFields"
              :key="`${field.field}-${field.reason}`"
              class="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <b>{{ field.label || fieldLabel(field.field) }}</b>：{{ field.reason }}
              <span v-if="field.rawValue" class="ml-1 text-amber-100/80">（原值：{{ field.rawValue }}）</span>
            </li>
          </ul>
        </section>

        <!-- 图片归属：图片列支持逗号分隔多值 -->
        <section v-if="imageView.resolved.length || imageView.unresolved.length" class="mb-5">
          <h3 class="mb-2 text-sm font-medium">
            图片归属（{{ imageView.resolved.length }} 张已匹配<template v-if="imageView.unresolved.length">，{{ imageView.unresolved.length }} 个未匹配</template>）
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="(image, index) in imageView.resolved"
              :key="image.attachmentId"
              class="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-xs">
              <span class="min-w-0 truncate">
                <b>{{ index + 1 }}.</b> {{ image.fileName || `附件 ${image.attachmentId}` }}
              </span>
              <span class="shrink-0 text-muted-foreground">{{ usageText(image.usage) }}</span>
            </li>
            <li
              v-for="name in imageView.unresolved"
              :key="`unresolved-${name}`"
              class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              未匹配到同批上传的图片附件：{{ name }}
            </li>
          </ul>
        </section>

        <!-- 逐字段证据：表格与网络证据分栏 -->
        <section v-if="evidence" class="mb-2">
          <h3 class="mb-2 text-sm font-medium">
            字段证据 · {{ evidenceSourceText(evidence.source) }}
            <span v-if="evidence.provider" class="ml-1 text-xs text-muted-foreground">
              （provider={{ evidence.provider }}<template v-if="evidence.model"> / model={{ evidence.model }}</template>）
            </span>
            <span v-if="evidence.fileName" class="ml-1 text-xs text-muted-foreground">（{{ evidence.fileName }}<template v-if="evidence.sheetName"> / {{ evidence.sheetName }}</template>）</span>
          </h3>
          <p v-if="!evidenceEntries.length" class="text-sm text-muted-foreground">后端未返回逐字段证据。</p>
          <ul v-else class="space-y-1.5">
            <li
              v-for="item in evidenceEntries"
              :key="`${item.field}-${item.source}`"
              class="rounded-md border px-3 py-2 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <b>{{ item.label }}</b>
                <span class="text-muted-foreground">{{ evidenceSourceText(item.source) }}</span>
              </div>
              <p v-if="item.url" class="mt-1 break-all">
                来源：<a class="text-primary underline" :href="item.url" target="_blank" rel="noreferrer noopener">{{ item.title || item.url }}</a>
              </p>
              <p v-if="item.excerpt" class="mt-1 text-muted-foreground">摘录：{{ item.excerpt }}</p>
              <p v-if="item.retrievedAt" class="mt-1 text-muted-foreground">检索时间：{{ item.retrievedAt }}</p>
              <p v-if="item.rowNo || item.column" class="mt-1 text-muted-foreground">
                位置：第 {{ item.rowNo }} 行<template v-if="item.column"> / 列 {{ item.column }}</template>
              </p>
              <p v-if="item.rawValue" class="mt-1 text-muted-foreground">原始值：{{ item.rawValue }}</p>
            </li>
          </ul>
        </section>
      </div>

      <DialogFooter class="shrink-0 gap-2 border-t px-5 py-3">
        <span class="mr-auto text-xs text-muted-foreground">
          {{ isExhibit ? '文物写入后 public_status=2（暂不公开）' : '文化点写入后 status=2（停用）' }}，需人工再置 1。
        </span>
        <Button
          v-if="isPending"
          variant="outline"
          size="sm"
          @click="candidate && emit('skip', candidate.id)">
          跳过此行
        </Button>
        <Button
          v-if="isPending"
          size="sm"
          @click="candidate && emit('confirm', candidate.id)">
          确认（接受覆盖）
        </Button>
        <Button v-else variant="outline" size="sm" @click="model = false">关闭</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
