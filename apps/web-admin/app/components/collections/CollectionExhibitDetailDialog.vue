<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import type {
  ExhibitAiArchive,
  ExhibitMediaResponse,
  ExhibitRecord,
} from '@/types/museum'

interface Props {
  open: boolean
  record: ExhibitRecord | null
  galleryLabelById?: Record<string, string>
}

interface DisplayField {
  label: string
  value: string
  chips?: string[]
}

interface TimelinePhase {
  phase?: string
  period?: string
  description?: string
  persons?: Array<{
    name?: string
    role?: string
    contribution?: string
  }>
}

interface MemoryPoint {
  title?: string
  category?: string
  description?: string
}

interface RelationshipClue {
  clueType?: string
  personName?: string
  eventName?: string
  techniqueName?: string
  motifName?: string
  siteName?: string
  targetHint?: string
  confidence?: number
  narrative?: string
}

const props = withDefaults(defineProps<Props>(), {
  galleryLabelById: () => ({}),
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const knownArchiveKeys = new Set([
  'formalName',
  'era',
  'dimensions',
  'materialCraft',
  'excavationSite',
  'currentCollection',
  'formFunction',
  'originStory',
  'backgroundStories',
  'culturalContext',
  'historicalSignificance',
  'keyPersonTimeline',
  'coreMemoryPoints',
  'historicalValueSummary',
  'relationshipClues',
  'influenceLevel',
])

const currentRecord = computed(() => props.record)

const formatValue = (value: unknown, fallback = '未填写') => {
  const text = String(value ?? '')
    .replace(/&nbsp;/g, '')
    .trim()
  return text || fallback
}

const hasValue = (value: unknown) => formatValue(value, '') !== ''

const parseJsonArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const aiArchive = computed<Record<string, unknown> | null>(() => {
  const record = currentRecord.value as
    | (ExhibitRecord & {
        aiAchive?: ExhibitAiArchive | string | null
        AIachive?: ExhibitAiArchive | string | null
      })
    | null

  return parseJsonObject(
    record?.aiArchive ?? record?.aiAchive ?? record?.AIachive ?? null,
  )
})

const getArchiveString = (key: string) => {
  const archive = aiArchive.value
  return archive ? formatValue(archive[key], '') : ''
}

const getGalleryName = (record: ExhibitRecord) =>
  props.galleryLabelById[record.galleryId ?? '']
  || (record.galleryId === '0' ? '未展览' : '未分配')

/** 基础字段 + extra 属性平铺（不展示分组名） */
const detailFields = computed<DisplayField[]>(() => {
  const record = currentRecord.value
  if (!record) {
    return []
  }

  const fields: DisplayField[] = [
    { label: '馆藏编码', value: formatValue(record.exhibitCode) },
    { label: '所属展厅', value: getGalleryName(record) },
    { label: '年代', value: formatValue(record.dynasty) },
    { label: '材质', value: formatValue(record.material) },
    { label: '类别', value: formatValue(record.category) },
    { label: '展柜号', value: formatValue(record.showcaseNo) },
    {
      label: '推荐停留时长',
      value:
        record.recommendedMinutes === null
          ? '未设置'
          : `${record.recommendedMinutes} 分钟`,
    },
    {
      label: '重点状态',
      value: record.isHighlight === 1 ? '重点展品' : '普通馆藏',
    },
    { label: '排序号', value: String(record.sortOrder ?? 0) },
  ]

  const extras = [...(record.extraList ?? [])]
    .filter((item) => item.attrKey !== 'tags')
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))

  for (const item of extras) {
    const chips =
      item.valueType === 4
        ? parseJsonArray<string>(item.attrValue)
            .filter((chip) => typeof chip === 'string')
            .map((chip) => chip.trim())
            .filter(Boolean)
        : []

    fields.push({
      label: formatValue(item.attrKey, '未命名属性'),
      value: chips.length ? '' : formatValue(item.attrValue, '暂无内容'),
      chips,
    })
  }

  return fields
})

const archiveTags = computed(() => {
  const tagExtra = currentRecord.value?.extraList.find(
    (item) => item.attrKey === 'tags',
  )
  return parseJsonArray<string>(tagExtra?.attrValue)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
})

const mediaItems = computed<ExhibitMediaResponse[]>(() =>
  [...(currentRecord.value?.mediaList ?? [])].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
  ),
)

const archiveSummaryFields = computed<DisplayField[]>(() => {
  const archive = aiArchive.value
  if (!archive) {
    return []
  }

  return [
    { label: '正式名称', value: getArchiveString('formalName') },
    { label: '时代', value: getArchiveString('era') },
    { label: '尺寸', value: getArchiveString('dimensions') },
    { label: '材质工艺', value: getArchiveString('materialCraft') },
    { label: '出土地/产地', value: getArchiveString('excavationSite') },
    { label: '当前收藏', value: getArchiveString('currentCollection') },
    { label: '器形与功能', value: getArchiveString('formFunction') },
    {
      label: '影响等级',
      value: hasValue(archive.influenceLevel)
        ? String(archive.influenceLevel)
        : '',
    },
  ].filter((item) => item.value)
})

const archiveRichSections = computed(() =>
  [
    { title: '来源故事', value: getArchiveString('originStory') },
    { title: '背景故事', value: getArchiveString('backgroundStories') },
    { title: '文化语境', value: getArchiveString('culturalContext') },
    { title: '历史意义', value: getArchiveString('historicalSignificance') },
  ].filter((item) => item.value),
)

const timelinePhases = computed(() =>
  parseJsonArray<TimelinePhase>(aiArchive.value?.keyPersonTimeline).filter(
    (item) =>
      item.phase || item.period || item.description || item.persons?.length,
  ),
)

const memoryPoints = computed(() =>
  parseJsonArray<MemoryPoint>(aiArchive.value?.coreMemoryPoints).filter(
    (item) => item.title || item.description,
  ),
)

const valueSummaries = computed(() =>
  parseJsonArray<string>(aiArchive.value?.historicalValueSummary)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean),
)

const relationshipClues = computed(() =>
  parseJsonArray<RelationshipClue>(aiArchive.value?.relationshipClues).filter(
    (item) => item.clueType || item.targetHint || item.narrative,
  ),
)

const archiveOtherFields = computed<DisplayField[]>(() => {
  const archive = aiArchive.value
  if (!archive) {
    return []
  }

  return Object.entries(archive)
    .filter(([key, value]) => !knownArchiveKeys.has(key) && hasValue(value))
    .map(([key, value]) => ({
      label: key,
      value: formatValue(
        typeof value === 'object' ? JSON.stringify(value) : value,
      ),
    }))
})

const hasArchiveContent = computed(() =>
  Boolean(
    archiveSummaryFields.value.length
    || archiveRichSections.value.length
    || timelinePhases.value.length
    || memoryPoints.value.length
    || valueSummaries.value.length
    || relationshipClues.value.length
    || archiveOtherFields.value.length,
  ),
)

const showDeepArchive = shallowRef(false)

const updateOpen = (...args: unknown[]) =>
  emit('update:open', Boolean(args[0]))
</script>

<template>
  <Dialog :open="props.open" @update:open="updateOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(96vw,40rem)] flex-col overflow-hidden p-0">
      <div class="flex shrink-0 items-center border-b border-border/70 px-5 py-3 pr-12">
        <DialogHeader class="min-w-0 space-y-0.5">
          <DialogTitle class="truncate text-[1.2rem] font-semibold tracking-tight text-foreground">
            {{ currentRecord?.name || '馆藏详情' }}
          </DialogTitle>
          <DialogDescription class="truncate text-xs text-muted-foreground">
            <template v-if="currentRecord">
              {{ getGalleryName(currentRecord) }}
              <span v-if="currentRecord.exhibitCode"> · {{ currentRecord.exhibitCode }}</span>
            </template>
            <template v-else>
              未分配
            </template>
          </DialogDescription>
        </DialogHeader>
      </div>

      <div
        v-if="currentRecord"
        class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        <section class="flex gap-4">
          <div class="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-background">
            <img
              v-if="currentRecord.imageUrl"
              :src="currentRecord.imageUrl"
              :alt="currentRecord.name || '馆藏图片'"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
            >
              暂无图片
            </div>
          </div>

          <div class="min-w-0 flex-1 space-y-3">
            <div
              v-if="archiveTags.length"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="tag in archiveTags"
                :key="tag"
                class="rounded bg-secondary px-2 py-1 text-xs"
              >
                {{ tag }}
              </span>
            </div>

            <p
              v-if="currentRecord.description"
              class="form-value line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
            >
              {{ currentRecord.description }}
            </p>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              暂无馆藏描述
            </p>
          </div>
        </section>

        <section class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="field in detailFields"
            :key="field.label"
            class="min-w-0 space-y-1.5"
          >
            <p class="field-caption text-sm font-medium">
              {{ field.label }}
            </p>
            <div
              v-if="field.chips?.length"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="chip in field.chips"
                :key="chip"
                class="rounded bg-secondary px-2 py-1 text-xs"
              >
                {{ chip }}
              </span>
            </div>
            <p
              v-else
              class="form-value whitespace-pre-wrap break-words text-sm"
            >
              {{ field.value }}
            </p>
          </div>
        </section>

        <section
          v-if="mediaItems.length"
          class="space-y-2 border-t border-border/60 pt-4"
        >
          <p class="form-label text-sm font-medium">
            媒体资源
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <article
              v-for="item in mediaItems"
              :key="`${item.mediaUrl}:${item.sortOrder}`"
              class="rounded-lg border border-border/70 px-3 py-2.5"
            >
              <p class="form-value truncate text-sm font-medium">
                {{ item.title || '未命名媒体' }}
              </p>
              <a
                v-if="item.mediaUrl"
                :href="item.mediaUrl"
                target="_blank"
                rel="noreferrer"
                class="mt-1 inline-block text-xs text-sky-300 hover:text-sky-200"
              >
                打开媒体
              </a>
            </article>
          </div>
        </section>

        <section
          v-if="hasArchiveContent"
          class="rounded-lg border border-border/60"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground"
            @click="showDeepArchive = !showDeepArchive"
          >
            <span>深度档案</span>
            <span class="text-xs">{{ showDeepArchive ? '收起' : '展开' }}</span>
          </button>

          <div
            v-if="showDeepArchive"
            class="space-y-4 border-t border-border/60 px-3 py-3"
          >
            <section
              v-if="archiveSummaryFields.length"
              class="grid gap-3 sm:grid-cols-2"
            >
              <div
                v-for="field in archiveSummaryFields"
                :key="field.label"
                class="min-w-0 space-y-1.5"
              >
                <p class="field-caption text-sm font-medium">
                  {{ field.label }}
                </p>
                <p class="form-value whitespace-pre-wrap text-sm">
                  {{ field.value }}
                </p>
              </div>
            </section>

            <section
              v-if="timelinePhases.length"
              class="space-y-2"
            >
              <p class="form-label text-sm font-medium">
                关键人物时间线
              </p>
              <div class="space-y-2">
                <article
                  v-for="phase in timelinePhases"
                  :key="`${phase.phase}:${phase.period}`"
                  class="rounded-lg border border-border/70 px-3 py-2.5"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="form-value text-sm font-medium">
                      {{ phase.phase || '阶段' }}
                    </p>
                    <span
                      v-if="phase.period"
                      class="text-xs text-muted-foreground"
                    >
                      {{ phase.period }}
                    </span>
                  </div>
                  <p
                    v-if="phase.description"
                    class="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
                  >
                    {{ phase.description }}
                  </p>
                  <div
                    v-if="phase.persons?.length"
                    class="mt-2 grid gap-2 sm:grid-cols-2"
                  >
                    <div
                      v-for="person in phase.persons"
                      :key="`${phase.phase}:${person.name}:${person.role}`"
                      class="rounded-md bg-secondary/30 px-2.5 py-2"
                    >
                      <p class="form-value text-sm font-medium">
                        {{ person.name || '未命名人物' }}
                      </p>
                      <p
                        v-if="person.role"
                        class="mt-0.5 text-xs text-muted-foreground"
                      >
                        {{ person.role }}
                      </p>
                      <p
                        v-if="person.contribution"
                        class="mt-1 text-sm leading-6 text-muted-foreground"
                      >
                        {{ person.contribution }}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section
              v-if="memoryPoints.length"
              class="space-y-2"
            >
              <p class="form-label text-sm font-medium">
                核心记忆点
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <article
                  v-for="point in memoryPoints"
                  :key="`${point.title}:${point.category}`"
                  class="rounded-lg border border-border/70 px-3 py-2.5"
                >
                  <div class="flex flex-wrap items-center gap-1.5">
                    <p class="form-value text-sm font-medium">
                      {{ point.title || '未命名记忆点' }}
                    </p>
                    <span
                      v-if="point.category"
                      class="rounded bg-secondary px-2 py-1 text-xs"
                    >
                      {{ point.category }}
                    </span>
                  </div>
                  <p
                    v-if="point.description"
                    class="mt-1.5 text-sm leading-6 text-muted-foreground"
                  >
                    {{ point.description }}
                  </p>
                </article>
              </div>
            </section>

            <section
              v-if="valueSummaries.length"
              class="space-y-1.5"
            >
              <p class="form-label text-sm font-medium">
                价值摘要
              </p>
              <ol class="space-y-1 text-sm leading-6 text-muted-foreground">
                <li
                  v-for="(item, index) in valueSummaries"
                  :key="item"
                >
                  {{ index + 1 }}. {{ item }}
                </li>
              </ol>
            </section>

            <section
              v-if="archiveRichSections.length"
              class="space-y-3"
            >
              <article
                v-for="section in archiveRichSections"
                :key="section.title"
                class="space-y-1.5"
              >
                <p class="form-label text-sm font-medium">
                  {{ section.title }}
                </p>
                <p class="form-value whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {{ section.value }}
                </p>
              </article>
            </section>

            <section
              v-if="relationshipClues.length"
              class="space-y-2"
            >
              <p class="form-label text-sm font-medium">
                关联线索
              </p>
              <div class="space-y-2">
                <article
                  v-for="(item, index) in relationshipClues"
                  :key="`${item.clueType}:${index}`"
                  class="rounded-lg border border-border/70 px-3 py-2.5"
                >
                  <div class="flex flex-wrap items-center gap-1.5">
                    <p class="form-value text-sm font-medium">
                      {{ item.clueType || '线索' }}
                    </p>
                    <span
                      v-if="item.confidence !== undefined"
                      class="rounded bg-secondary px-2 py-1 text-xs"
                    >
                      置信度 {{ item.confidence }}
                    </span>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span v-if="item.personName">人物：{{ item.personName }}</span>
                    <span v-if="item.eventName">事件：{{ item.eventName }}</span>
                    <span v-if="item.techniqueName">工艺：{{ item.techniqueName }}</span>
                    <span v-if="item.motifName">题材：{{ item.motifName }}</span>
                    <span v-if="item.siteName">地点：{{ item.siteName }}</span>
                  </div>
                  <p
                    v-if="item.targetHint"
                    class="form-value mt-1.5 text-sm"
                  >
                    {{ item.targetHint }}
                  </p>
                  <p
                    v-if="item.narrative"
                    class="mt-1 text-sm leading-6 text-muted-foreground"
                  >
                    {{ item.narrative }}
                  </p>
                </article>
              </div>
            </section>

            <section
              v-if="archiveOtherFields.length"
              class="grid gap-3 sm:grid-cols-2"
            >
              <div
                v-for="field in archiveOtherFields"
                :key="field.label"
                class="min-w-0 space-y-1.5"
              >
                <p class="field-caption text-sm font-medium">
                  {{ field.label }}
                </p>
                <p class="form-value whitespace-pre-wrap break-words text-sm">
                  {{ field.value }}
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
