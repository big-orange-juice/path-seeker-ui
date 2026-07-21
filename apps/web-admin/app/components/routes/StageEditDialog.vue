<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import GuideSelectDialog from '@/components/guides/GuideSelectDialog.vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import { isSupportedInteractionType, parseStageConfig } from '@path-seeker/game-renderer'
import type { NarrationDetailResponse, UpdateNarrationStageResponse } from '@/types/narration'
import { mapGuideResponse } from '@/composables/useGuideManagement'
import type { GuideRecord, GuideResponseListTotalPageResult } from '@/types/guide'
import type { RouteNodeResponse } from '@/types/route'

interface Props {
  open: boolean
  routeId: string
  node: RouteNodeResponse | null
  canEdit?: boolean
}

interface StageFormState {
  title: string
  subtitle: string
  prompt: string
  optionsInput: string
  correctOptionId: string
  hintsInput: string
  imageUrl: string
  gridSize: string
  piecesInput: string
  correctOrderInput: string
  clueText: string
  location: string
  videoUrl: string
  userStyleInput: string
  sceneContext: string
  targetDurationSeconds: string
  narrationText: string
  guideId: string
  guideName: string
}

const props = withDefaults(defineProps<Props>(), { canEdit: true })
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()
const { request } = useApiClient()

const saving = ref(false)
const generatingAudio = ref(false)
const errorMessage = ref('')
const narrationDetail = ref<NarrationDetailResponse | null>(null)
const baseConfig = ref<Record<string, unknown>>({})
const guideSelectOpen = ref(false)
const guidePending = ref(false)
const guides = ref<GuideRecord[]>([])
const form = reactive<StageFormState>({
  title: '', subtitle: '', prompt: '', optionsInput: '', correctOptionId: '', hintsInput: '',
  imageUrl: '', gridSize: '3', piecesInput: '', correctOrderInput: '', clueText: '', location: '', videoUrl: '',
  userStyleInput: '', sceneContext: '', targetDurationSeconds: '90', narrationText: '', guideId: '', guideName: '',
})

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})
const stageId = computed(() => String(props.node?.stageId ?? '').trim())
const interactionType = computed(() => props.node?.interactionType ?? 0)
const isSupported = computed(() => isSupportedInteractionType(interactionType.value))
const isNarration = computed(() => interactionType.value === 11)
const isObserveChoice = computed(() => interactionType.value === 1)
const isImagePuzzle = computed(() => interactionType.value === 6)
const isFindScan = computed(() => interactionType.value === 10)
const nodeTitle = computed(() => props.node?.title || '未命名节点')
const selectedGuideLabel = computed(() => form.guideName || (form.guideId ? '已选择导游' : '未选择导游'))
const canSave = computed(() => Boolean(
  props.canEdit && isSupported.value && stageId.value && props.routeId && !saving.value,
))

const resolveError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.statusMessage === 'string' && record.statusMessage) return record.statusMessage
    if (typeof record.message === 'string' && record.message) return record.message
  }
  return fallback
}
const readText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const readArray = (value: unknown) => Array.isArray(value) ? value : []
const toLines = (value: unknown, mapper: (item: Record<string, unknown>, index: number) => string) =>
  readArray(value).map((item, index) => mapper(item as Record<string, unknown>, index)).join('\n')

const resetForm = () => {
  const node = props.node
  const config = node ? parseStageConfig(node.config) as Record<string, unknown> : {}
  baseConfig.value = { ...config }
  form.title = node?.title || ''
  form.subtitle = node?.subtitle || ''
  form.prompt = readText(config.content) || readText(config.prompt)
  form.optionsInput = toLines(config.options ?? config.choices, (item, index) =>
    `${readText(item.id) || readText(item.key) || `option-${index + 1}`} | ${readText(item.label) || readText(item.text) || `选项 ${index + 1}`}`,
  )
  form.correctOptionId = readText(config.correct_option_id) || readText(config.correctOptionId) || readText(config.answer)
  form.hintsInput = toLines(config.hints, (item) => readText(item.content) || readText(item.text))
  form.imageUrl = readText(config.image_url) || readText(config.imageUrl)
  form.gridSize = String(config.grid_size ?? config.gridSize ?? 3)
  form.piecesInput = toLines(config.pieces ?? config.items ?? config.fragments, (item, index) =>
    `${readText(item.id) || readText(item.key) || `piece-${index + 1}`} | ${readText(item.label) || readText(item.text) || `碎片 ${index + 1}`} | ${readText(item.hint) || readText(item.description)}`,
  )
  form.correctOrderInput = readArray(config.correct_order ?? config.correctOrder ?? config.answer).map((item) => String(item)).join('\n')
  form.clueText = readText(config.clue_text) || readText(config.clue) || readText(config.rule_hint)
  form.location = readText(config.location) || readText(config.target_exhibit_name) || readText(config.gallery_name)
  form.videoUrl = readText(config.video_url) || readText(config.videoUrl) || readText(config.intro_video_url)
  form.userStyleInput = readText(config.user_style_input)
  form.sceneContext = readText(config.scene_context)
  form.targetDurationSeconds = String(config.target_duration_seconds ?? 90)
  form.narrationText = narrationDetail.value?.narrationText || ''
  form.guideId = String(narrationDetail.value?.guideId ?? config.guide_id ?? '').trim()
  form.guideName = String(narrationDetail.value?.guideName ?? config.guide_name ?? '').trim()
  errorMessage.value = ''
}

const loadNarrationDetail = async () => {
  if (!props.open || !isNarration.value || !stageId.value) {
    narrationDetail.value = null
    resetForm()
    return
  }
  try {
    narrationDetail.value = await request<NarrationDetailResponse | null>('/api/narration/detail', {
      method: 'GET', query: { stageId: stageId.value },
    })
  } catch {
    narrationDetail.value = null
  }
  resetForm()
}

watch(
  () => [props.open, stageId.value, props.node?.config, props.node?.title, props.node?.subtitle],
  () => {
    if (isNarration.value && props.open) {
      void loadNarrationDetail()
      return
    }
    narrationDetail.value = null
    resetForm()
  },
  { immediate: true },
)

const parseOptions = () => form.optionsInput.split('\n')
  .map((line, index) => {
    const [rawId, rawLabel] = line.split('|').map((part) => part.trim())
    return rawLabel ? { id: rawId || `option-${index + 1}`, label: rawLabel } : null
  })
  .filter((item): item is { id: string; label: string } => item !== null)
const parsePieces = () => form.piecesInput.split('\n')
  .map((line, index) => {
    const [rawId, rawLabel, rawHint] = line.split('|').map((part) => part.trim())
    return rawLabel ? { id: rawId || `piece-${index + 1}`, label: rawLabel, hint: rawHint || null } : null
  })
  .filter((item): item is { id: string; label: string; hint: string | null } => item !== null)
const parseHints = () => form.hintsInput.split('\n')
  .map((content, index) => ({ content: content.trim(), sort_order: index + 1 }))
  .filter((item) => Boolean(item.content))
const toBoundedInteger = (value: string, minimum: number, maximum: number, fallback: number) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.min(maximum, Math.max(minimum, Math.round(numberValue))) : fallback
}

const buildRegularConfig = () => {
  const config: Record<string, unknown> = { ...baseConfig.value }
  const hints = parseHints()
  config.hints = hints

  if (isObserveChoice.value) {
    const options = parseOptions()
    if (!form.prompt.trim() || options.length < 2 || !form.correctOptionId.trim()) {
      errorMessage.value = '请填写题干、至少两个选项和正确项。'
      return null
    }
    config.content = form.prompt.trim()
    config.options = options
    config.correct_option_id = form.correctOptionId.trim()
  } else if (isImagePuzzle.value) {
    const pieces = parsePieces()
    const correctOrder = form.correctOrderInput.split('\n').map((item) => item.trim()).filter(Boolean)
    if (!form.prompt.trim() || !pieces.length || !correctOrder.length) {
      errorMessage.value = '请填写题干、碎片和正确顺序。'
      return null
    }
    config.content = form.prompt.trim()
    config.image_url = form.imageUrl.trim() || null
    config.grid_size = toBoundedInteger(form.gridSize, 1, 12, 3)
    config.pieces = pieces
    config.correct_order = correctOrder
  } else if (isFindScan.value) {
    if (!form.clueText.trim()) {
      errorMessage.value = '请填写寻找线索。'
      return null
    }
    config.clue_text = form.clueText.trim()
    config.location = form.location.trim() || null
    config.video_url = form.videoUrl.trim() || null
  }
  return config
}

const saveRegularStage = async () => {
  const config = buildRegularConfig()
  if (!config || !props.node) return false
  await request('/api/route/stage-update', {
    method: 'POST',
    body: {
      id: stageId.value, routeId: props.routeId, title: form.title.trim() || null,
      subtitle: form.subtitle.trim() || null, interactionType: props.node.interactionType,
      refPuzzleId: props.node.refPuzzleId, refExhibitId: props.node.refExhibitId,
      config: JSON.stringify(config),
    },
  })
  return true
}

const loadGuides = async (keyword = '') => {
  guidePending.value = true
  try {
    const result = await request<GuideResponseListTotalPageResult>('/api/guide/query', {
      query: { keyword: keyword.trim() || undefined, status: 1, pageIndex: 1, pageSize: 100 },
    })
    guides.value = (result?.list ?? []).map(mapGuideResponse).filter((guide) => Boolean(guide.id))
  } catch (error) {
    errorMessage.value = resolveError(error, '导游列表加载失败。')
  } finally {
    guidePending.value = false
  }
}
const openGuideSelector = () => {
  if (!props.canEdit || saving.value) return
  guideSelectOpen.value = true
  void loadGuides()
}
const selectGuide = (guide: GuideRecord) => {
  form.guideId = guide.id
  form.guideName = guide.name
}

const saveNarrationStage = async () => {
  const targetDurationSeconds = toBoundedInteger(form.targetDurationSeconds, 10, 600, 90)
  await request<UpdateNarrationStageResponse | null>('/api/narration/update-stage', {
    method: 'POST',
    body: {
      stageId: stageId.value, title: form.title.trim() || null, subtitle: form.subtitle.trim() || null,
      exhibitId: props.node?.refExhibitId ?? null, guideId: form.guideId || null, userStyleInput: form.userStyleInput.trim() || null,
      sceneContext: form.sceneContext.trim() || null, targetDurationSeconds,
    },
  })
  const nextText = form.narrationText.trim()
  const currentText = String(narrationDetail.value?.narrationText ?? '').trim()
  if (nextText && nextText !== currentText) {
    await request<NarrationDetailResponse | null>('/api/narration/update-text', {
      method: 'POST',
      body: { stageId: stageId.value, narrationText: nextText, ...(typeof narrationDetail.value?.version === 'number' ? { version: narrationDetail.value.version } : {}) },
    })
  }
}

const handleGenerateAudio = async () => {
  if (!props.canEdit || !isNarration.value || !stageId.value || generatingAudio.value) return
  generatingAudio.value = true
  errorMessage.value = ''
  try {
    await request('/api/narration/generate-audio', { method: 'POST', body: { stageId: stageId.value } })
    errorMessage.value = '语音生成任务已提交。'
  } catch (error) {
    errorMessage.value = resolveError(error, '语音生成任务提交失败。')
  } finally {
    generatingAudio.value = false
  }
}

const handleSave = async () => {
  if (!canSave.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const saved = isNarration.value ? (await saveNarrationStage(), true) : await saveRegularStage()
    if (!saved) return
    emit('saved')
    isOpen.value = false
  } catch (error) {
    errorMessage.value = resolveError(error, '节点保存失败。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(92vw,720px)] flex-col overflow-hidden p-0">
      <DialogHeader class="shrink-0 border-b border-border/70 px-5 py-3">
        <DialogTitle>编辑节点</DialogTitle>
        <DialogDescription class="truncate">{{ nodeTitle }}</DialogDescription>
      </DialogHeader>

      <div class="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
        <div v-if="!isSupported" class="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          此节点类型已不再支持编辑。
        </div>
        <template v-else>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">节点名称<Input v-model="form.title" :disabled="!props.canEdit || saving" /></label>
            <label class="space-y-1.5 text-sm font-medium">节点副标题<Input v-model="form.subtitle" :disabled="!props.canEdit || saving" /></label>
          </div>

          <template v-if="isObserveChoice">
            <label class="block space-y-1.5 text-sm font-medium">题干<Textarea v-model="form.prompt" class="min-h-[88px]" :disabled="!props.canEdit || saving" /></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-1.5 text-sm font-medium">选项（每行：标识 | 文案）<Textarea v-model="form.optionsInput" class="min-h-[132px]" :disabled="!props.canEdit || saving" /></label>
              <label class="space-y-1.5 text-sm font-medium">正确项标识<Input v-model="form.correctOptionId" :disabled="!props.canEdit || saving" /></label>
            </div>
          </template>

          <template v-else-if="isImagePuzzle">
            <label class="block space-y-1.5 text-sm font-medium">题干<Textarea v-model="form.prompt" class="min-h-[88px]" :disabled="!props.canEdit || saving" /></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-1.5 text-sm font-medium">拼图图片地址<Input v-model="form.imageUrl" :disabled="!props.canEdit || saving" /></label>
              <label class="space-y-1.5 text-sm font-medium">网格尺寸<Input v-model="form.gridSize" type="number" min="1" max="12" :disabled="!props.canEdit || saving" /></label>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-1.5 text-sm font-medium">碎片（每行：标识 | 文案 | 提示）<Textarea v-model="form.piecesInput" class="min-h-[132px]" :disabled="!props.canEdit || saving" /></label>
              <label class="space-y-1.5 text-sm font-medium">正确顺序（每行一个碎片标识）<Textarea v-model="form.correctOrderInput" class="min-h-[132px]" :disabled="!props.canEdit || saving" /></label>
            </div>
          </template>

          <template v-else-if="isFindScan">
            <label class="block space-y-1.5 text-sm font-medium">寻找线索<Textarea v-model="form.clueText" class="min-h-[112px]" :disabled="!props.canEdit || saving" /></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-1.5 text-sm font-medium">目标位置<Input v-model="form.location" :disabled="!props.canEdit || saving" /></label>
              <label class="space-y-1.5 text-sm font-medium">观展短片地址<Input v-model="form.videoUrl" :disabled="!props.canEdit || saving" /></label>
            </div>
          </template>

          <template v-else-if="isNarration">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-1.5 text-sm font-medium">解说风格<Input v-model="form.userStyleInput" :disabled="!props.canEdit || saving" /></label>
              <label class="space-y-1.5 text-sm font-medium">目标时长（秒）<Input v-model="form.targetDurationSeconds" type="number" min="10" max="600" :disabled="!props.canEdit || saving" /></label>
            </div>
            <div class="flex items-end gap-3 rounded-lg border border-border/70 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">讲解导游</p>
                <p class="truncate text-xs text-muted-foreground">{{ selectedGuideLabel }}</p>
              </div>
              <Button variant="outline" type="button" :disabled="!props.canEdit || saving" @click="openGuideSelector">选择导游</Button>
            </div>
            <label class="block space-y-1.5 text-sm font-medium">场景说明<Textarea v-model="form.sceneContext" class="min-h-[88px]" :disabled="!props.canEdit || saving" /></label>
            <label class="block space-y-1.5 text-sm font-medium">解说词<Textarea v-model="form.narrationText" class="min-h-[180px]" :disabled="!props.canEdit || saving" /></label>
            <div class="flex justify-end">
              <Button variant="outline" type="button" :disabled="!props.canEdit || saving || generatingAudio" @click="handleGenerateAudio">{{ generatingAudio ? '提交中...' : '生成语音' }}</Button>
            </div>
          </template>

          <template v-if="!isNarration">
            <label class="block space-y-1.5 text-sm font-medium">提示（每行一条）<Textarea v-model="form.hintsInput" class="min-h-[96px]" :disabled="!props.canEdit || saving" /></label>
          </template>
        </template>
        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/70 px-5 py-3">
        <Button variant="outline" type="button" :disabled="saving" @click="isOpen = false">取消</Button>
        <Button type="button" :disabled="!canSave" @click="handleSave">{{ saving ? '保存中...' : '保存' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <GuideSelectDialog v-model:open="guideSelectOpen" :guides="guides" :pending="guidePending" :selected-id="form.guideId || null" @select="selectGuide" @search="loadGuides" />
</template>