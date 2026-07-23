<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { v4 as uuidv4 } from 'uuid'
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
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  getInteractionTypeMeta,
  isSupportedInteractionType,
  parseStageConfig,
} from '@path-seeker/game-renderer'
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import type {
  GenerateRouteStageNarrationImageResponse,
  NarrationDetailResponse,
  RouteStageNarrationImageResponse,
  UpdateNarrationStageResponse,
} from '@/types/narration'
import { mapGuideResponse } from '@/composables/useGuideManagement'
import type { GuideRecord, GuideResponseListTotalPageResult } from '@/types/guide'
import type { RouteNodeResponse } from '@/types/route'

interface Props {
  open: boolean
  routeId: string
  node: RouteNodeResponse | null
  canEdit?: boolean
}

interface ChoiceOptionRow {
  id: string
  label: string
}

/** 拼图碎片行：标识后台维护，导游只填名称与可选提示 */
interface PuzzlePieceRow {
  id: string
  label: string
  hint: string
}

interface StageFormState {
  title: string
  subtitle: string
  prompt: string
  choiceOptions: ChoiceOptionRow[]
  correctOptionId: string
  hintsInput: string
  imageUrl: string
  gridSize: string
  puzzlePieces: PuzzlePieceRow[]
  /** 正确拼合顺序（碎片 id 列表） */
  correctOrderIds: string[]
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
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  /** 配图增删后通知父级重拉解说 detail，刷新模拟器 */
  'preview-refresh': []
}>()
const { request } = useApiClient()
const { uploadAttachment } = useUploadAttachment()

const saving = ref(false)
const generatingAudio = ref(false)
/** 生成音频任务轮询中（提交成功后轮询 detail.audioStatus） */
const audioPolling = ref(false)
const imageBusy = ref(false)
/** 配图来源：手动上传 / AI 生成（二选一交互） */
const imageSourceMode = ref<'upload' | 'generate'>('upload')
/** AI 配图：画面描述 */
const imageGenPrompt = ref('')
/** AI 配图：已选参考图 URL 列表（最多 5，仅存有效地址） */
const imageGenRefUrls = ref<string[]>([])
/** 外链粘贴草稿 */
const imageGenRefDraft = ref('')
/** 大图预览（参考图 / 已有配图） */
const imageLightboxUrl = ref('')
const generatingImage = ref(false)
/** AI 配图任务轮询中（提交后刷新 detail.images） */
const imageGenPolling = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const narrationDetail = ref<NarrationDetailResponse | null>(null)
let audioPollTimer: ReturnType<typeof setInterval> | null = null
let audioPollAttempts = 0
const AUDIO_POLL_INTERVAL_MS = 2500
const AUDIO_POLL_MAX_ATTEMPTS = 48
let imageGenPollTimer: ReturnType<typeof setInterval> | null = null
let imageGenPollAttempts = 0
const IMAGE_GEN_POLL_INTERVAL_MS = 2500
const IMAGE_GEN_POLL_MAX_ATTEMPTS = 48
const IMAGE_GEN_REF_MAX = 5
/** 解说配图本地列表；与 detail.images 同步，增删走 NarrationImage API */
const narrationImages = shallowRef<RouteStageNarrationImageResponse[]>([])
const imageInputRef = useTemplateRef<HTMLInputElement>('imageInput')
const puzzleImageInputRef = useTemplateRef<HTMLInputElement>('puzzleImageInput')
const videoInputRef = useTemplateRef<HTMLInputElement>('videoInput')
const baseConfig = ref<Record<string, unknown>>({})
const guideSelectOpen = ref(false)
const guidePending = ref(false)
const guides = ref<GuideRecord[]>([])
const mediaUploading = ref(false)
const showMediaAdvanced = ref(false)
const form = reactive<StageFormState>({
  title: '', subtitle: '', prompt: '', choiceOptions: [], correctOptionId: '', hintsInput: '',
  imageUrl: '', gridSize: '3', puzzlePieces: [], correctOrderIds: [], clueText: '', location: '', videoUrl: '',
  userStyleInput: '', sceneContext: '', targetDurationSeconds: '90', narrationText: '', guideId: '', guideName: '',
})

/** 解说音频状态（对齐后端枚举） */
const NARRATION_AUDIO_STATUS = {
  NotGenerated: 0,
  Queued: 1,
  Generating: 2,
  Completed: 3,
  Failed: 4,
  Stale: 5,
} as const

const syncNarrationImages = (detail: NarrationDetailResponse | null) => {
  narrationImages.value = [...(detail?.images ?? [])]
    .map((item) => ({
      ...item,
      id: item.id != null ? String(item.id) : null,
      stageId: item.stageId != null ? String(item.stageId) : null,
      attachmentId: item.attachmentId != null ? String(item.attachmentId) : null,
      imageUrl: item.imageUrl != null ? String(item.imageUrl) : null,
    }))
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
}

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
const nodeTitle = computed(() => props.node?.title || '未命名站点')
const interactionTypeLabel = computed(
  () => getInteractionTypeMeta(interactionType.value)?.label || `类型 ${interactionType.value}`,
)
const headerDescription = computed(() => `${nodeTitle.value} · ${interactionTypeLabel.value}`)
const selectedGuideLabel = computed(() => form.guideName || (form.guideId ? '已选择导游' : '未选择导游'))
const canSave = computed(() => Boolean(
  props.canEdit && isSupported.value && stageId.value && props.routeId && !saving.value,
))
/** 解说节点稍宽；整体固定高度避免切换内容时弹窗抖动 */
const dialogContentClass = computed(() =>
  isNarration.value
    ? 'flex h-[90vh] max-w-[min(96vw,920px)] flex-col overflow-hidden p-0'
    : 'flex h-[90vh] max-w-[min(92vw,720px)] flex-col overflow-hidden p-0',
)
const audioStatus = computed(() => {
  const status = narrationDetail.value?.audioStatus
  return typeof status === 'number' ? status : NARRATION_AUDIO_STATUS.NotGenerated
})
const audioUrl = computed(() => {
  const url = narrationDetail.value?.audioUrl
  return url != null ? String(url).trim() : ''
})
const audioDurationLabel = computed(() => {
  const ms = narrationDetail.value?.durationMs
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
})
/** 本地解说词是否相对服务端已改（仅正文，不看场景/风格等其它字段） */
const isNarrationTextDirty = computed(() => {
  const draft = form.narrationText.trim()
  const saved = String(narrationDetail.value?.narrationText ?? '').trim()
  return draft !== saved
})
const audioStatusLabel = computed(() => {
  switch (audioStatus.value) {
    case NARRATION_AUDIO_STATUS.Queued:
      return '排队中'
    case NARRATION_AUDIO_STATUS.Generating:
      return '生成中'
    case NARRATION_AUDIO_STATUS.Completed:
      // 仅解说词变更才提示需重生成；标题/场景/配图等不影响
      if (isNarrationTextDirty.value) {
        return '解说词已改，保存后需重新生成'
      }
      return audioDurationLabel.value ? `已生成 · ${audioDurationLabel.value}` : '已生成'
    case NARRATION_AUDIO_STATUS.Failed:
      return '生成失败'
    case NARRATION_AUDIO_STATUS.Stale:
      return '解说词已变更，需重新生成'
    default:
      return '尚未生成'
  }
})
/**
 * 可随时重新生成：只要有解说词即可。
 * 是否「需要」重生成只看解说词（Stale / 本地正文已改），与其它字段无关。
 */
const canGenerateAudio = computed(() => Boolean(
  props.canEdit
  && isNarration.value
  && stageId.value
  && form.narrationText.trim()
  && !generatingAudio.value
  && !saving.value
  && !audioPolling.value,
))
const isAudioPendingStatus = (status: number) =>
  status === NARRATION_AUDIO_STATUS.Queued
  || status === NARRATION_AUDIO_STATUS.Generating

const canGenerateImage = computed(() => Boolean(
  props.canEdit
  && isNarration.value
  && stageId.value
  && imageGenPrompt.value.trim()
  && !generatingImage.value
  && !imageGenPolling.value
  && !imageBusy.value
  && !saving.value,
))

/** 校验是否为可预览的 http(s) 图片地址 */
const isPreviewableImageUrl = (value: string) => {
  const text = value.trim()
  if (!text) return false
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

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

const createOptionId = (index: number) => `option-${index + 1}`
const createPieceId = (index: number) => `piece-${index + 1}`

const parseChoiceOptions = (value: unknown): ChoiceOptionRow[] => {
  const rows = readArray(value).map((item, index) => {
    const record = item as Record<string, unknown>
    const id = readText(record.id) || readText(record.key) || createOptionId(index)
    const label = readText(record.label) || readText(record.text) || `选项 ${index + 1}`
    return { id, label }
  }).filter((item) => Boolean(item.label.trim()))

  if (rows.length >= 2) {
    return rows
  }

  return [
    { id: 'option-1', label: '' },
    { id: 'option-2', label: '' },
  ]
}

const parsePuzzlePieces = (value: unknown): PuzzlePieceRow[] => {
  const rows = readArray(value).map((item, index) => {
    const record = item as Record<string, unknown>
    return {
      id: readText(record.id) || readText(record.key) || createPieceId(index),
      label: readText(record.label) || readText(record.text) || `碎片 ${index + 1}`,
      hint: readText(record.hint) || readText(record.description),
    }
  }).filter((item) => Boolean(item.label.trim()))

  if (rows.length) {
    return rows
  }

  return [
    { id: 'piece-1', label: '', hint: '' },
    { id: 'piece-2', label: '', hint: '' },
  ]
}

const syncCorrectOrderIds = (pieces: PuzzlePieceRow[], orderSource: unknown) => {
  const pieceIds = new Set(pieces.map((item) => item.id))
  const fromConfig = readArray(orderSource)
    .map((item) => String(item).trim())
    .filter((id) => pieceIds.has(id))
  const missing = pieces.map((item) => item.id).filter((id) => !fromConfig.includes(id))
  return [...fromConfig, ...missing]
}

const resetForm = () => {
  const node = props.node
  const config = node ? parseStageConfig(node.config) as Record<string, unknown> : {}
  baseConfig.value = { ...config }
  form.title = node?.title || ''
  form.subtitle = node?.subtitle || ''
  form.prompt = readText(config.content) || readText(config.prompt)
  form.choiceOptions = parseChoiceOptions(config.options ?? config.choices)
  form.correctOptionId = readText(config.correct_option_id) || readText(config.correctOptionId) || readText(config.answer)
  if (!form.choiceOptions.some((item) => item.id === form.correctOptionId)) {
    form.correctOptionId = form.choiceOptions[0]?.id || ''
  }
  form.hintsInput = toLines(config.hints, (item) => readText(item.content) || readText(item.text))
  form.imageUrl = readText(config.image_url) || readText(config.imageUrl)
  form.gridSize = String(config.grid_size ?? config.gridSize ?? 3)
  form.puzzlePieces = parsePuzzlePieces(config.pieces ?? config.items ?? config.fragments)
  form.correctOrderIds = syncCorrectOrderIds(
    form.puzzlePieces,
    config.correct_order ?? config.correctOrder ?? config.answer,
  )
  form.clueText = readText(config.clue_text) || readText(config.clue) || readText(config.rule_hint)
  form.location = readText(config.location) || readText(config.target_exhibit_name) || readText(config.gallery_name)
  form.videoUrl = readText(config.video_url) || readText(config.videoUrl) || readText(config.intro_video_url)
  form.userStyleInput = readText(config.user_style_input)
  form.sceneContext = readText(config.scene_context)
  form.targetDurationSeconds = String(config.target_duration_seconds ?? 90)
  form.narrationText = narrationDetail.value?.narrationText || ''
  form.guideId = String(narrationDetail.value?.guideId ?? config.guide_id ?? '').trim()
  form.guideName = String(narrationDetail.value?.guideName ?? config.guide_name ?? '').trim()
  syncNarrationImages(narrationDetail.value)
  showMediaAdvanced.value = false
  mediaUploading.value = false
  imageSourceMode.value = 'upload'
  imageGenPrompt.value = ''
  imageGenRefUrls.value = []
  imageGenRefDraft.value = ''
  imageLightboxUrl.value = ''
  errorMessage.value = ''
  infoMessage.value = ''
}

const addChoiceOption = () => {
  const nextIndex = form.choiceOptions.length
  const id = createOptionId(nextIndex)
  form.choiceOptions.push({ id, label: '' })
  if (!form.correctOptionId) {
    form.correctOptionId = id
  }
}

const removeChoiceOption = (index: number) => {
  if (form.choiceOptions.length <= 2) {
    return
  }
  const [removed] = form.choiceOptions.splice(index, 1)
  if (removed && form.correctOptionId === removed.id) {
    form.correctOptionId = form.choiceOptions[0]?.id || ''
  }
}

const addPuzzlePiece = () => {
  const id = createPieceId(form.puzzlePieces.length)
  form.puzzlePieces.push({ id, label: '', hint: '' })
  if (!form.correctOrderIds.includes(id)) {
    form.correctOrderIds.push(id)
  }
}

const removePuzzlePiece = (index: number) => {
  if (form.puzzlePieces.length <= 2) {
    return
  }
  const [removed] = form.puzzlePieces.splice(index, 1)
  if (removed) {
    form.correctOrderIds = form.correctOrderIds.filter((id) => id !== removed.id)
  }
}

const moveCorrectOrder = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (target < 0 || target >= form.correctOrderIds.length) {
    return
  }
  const list = form.correctOrderIds
  const current = list[index]
  const swap = list[target]
  if (current === undefined || swap === undefined) {
    return
  }
  list[index] = swap
  list[target] = current
}

const pieceLabelById = (id: string) => {
  const piece = form.puzzlePieces.find((item) => item.id === id)
  return piece?.label.trim() || id
}

const openPuzzleImagePicker = () => {
  if (!props.canEdit || mediaUploading.value || saving.value) return
  puzzleImageInputRef.value?.click()
}

const openVideoPicker = () => {
  if (!props.canEdit || mediaUploading.value || saving.value) return
  videoInputRef.value?.click()
}

const handlePuzzleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return

  mediaUploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadAttachment(file, 'image')
    const url = String(uploaded?.fileUrl ?? '').trim()
    if (!url) {
      throw new Error('上传成功但未返回图片地址。')
    }
    form.imageUrl = url
    infoMessage.value = '拼图图片已上传。'
  } catch (error) {
    errorMessage.value = resolveError(error, '拼图图片上传失败。')
  } finally {
    mediaUploading.value = false
  }
}

const handleVideoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return

  mediaUploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadAttachment(file, 'file')
    const url = String(uploaded?.fileUrl ?? '').trim()
    if (!url) {
      throw new Error('上传成功但未返回视频地址。')
    }
    form.videoUrl = url
    infoMessage.value = '短片已上传。'
  } catch (error) {
    errorMessage.value = resolveError(error, '短片上传失败。')
  } finally {
    mediaUploading.value = false
  }
}

const clearPuzzleImage = () => {
  form.imageUrl = ''
}

const clearVideoUrl = () => {
  form.videoUrl = ''
}

const loadNarrationDetail = async () => {
  if (!props.open || !isNarration.value || !stageId.value) {
    narrationDetail.value = null
    narrationImages.value = []
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

const stopAudioPoll = () => {
  if (audioPollTimer) {
    clearInterval(audioPollTimer)
    audioPollTimer = null
  }
  audioPollAttempts = 0
  audioPolling.value = false
}

/** 仅刷新音频相关字段，避免冲掉表单未保存编辑 */
const refreshNarrationAudioMeta = async () => {
  if (!stageId.value) return
  try {
    const detail = await request<NarrationDetailResponse | null>('/api/narration/detail', {
      method: 'GET',
      query: { stageId: stageId.value },
    })
    if (!detail) return
    const draftText = form.narrationText.trim()
    narrationDetail.value = {
      ...(narrationDetail.value ?? {}),
      ...detail,
      // 表单正文优先，避免轮询冲掉未保存编辑
      narrationText: draftText || detail.narrationText,
    }
  } catch {
    // 状态刷新失败不阻断主流程
  }
}

const finishAudioPollByStatus = (status: number) => {
  if (status === NARRATION_AUDIO_STATUS.Completed) {
    infoMessage.value = '音频已生成，可在下方试听。'
    errorMessage.value = ''
    stopAudioPoll()
    emit('preview-refresh')
    return true
  }
  if (status === NARRATION_AUDIO_STATUS.Failed) {
    errorMessage.value = '音频生成失败，请稍后重试。'
    infoMessage.value = ''
    stopAudioPoll()
    emit('preview-refresh')
    return true
  }
  if (status === NARRATION_AUDIO_STATUS.Stale) {
    infoMessage.value = '解说词已变更，请重新生成音频。'
    stopAudioPoll()
    emit('preview-refresh')
    return true
  }
  return false
}

/** 轮询 detail.audioStatus，直到完成 / 失败 / 超时（约 2 分钟） */
const startAudioPoll = () => {
  stopAudioPoll()
  audioPolling.value = true
  audioPollAttempts = 0
  infoMessage.value = '音频生成中，正在同步状态…'

  const tick = async () => {
    audioPollAttempts += 1
    await refreshNarrationAudioMeta()
    emit('preview-refresh')

    const status = audioStatus.value
    if (finishAudioPollByStatus(status)) return

    if (audioPollAttempts >= AUDIO_POLL_MAX_ATTEMPTS) {
      infoMessage.value = '音频仍在生成，可稍后重新打开节点查看。'
      stopAudioPoll()
    }
  }

  void tick()
  audioPollTimer = setInterval(() => {
    void tick()
  }, AUDIO_POLL_INTERVAL_MS)
}

const openImagePicker = () => {
  if (!props.canEdit || imageBusy.value || saving.value || generatingImage.value || imageGenPolling.value) return
  imageInputRef.value?.click()
}

/** 当前列表中的附件 ID（有序），供 update-stage.attachmentIds 全量同步 */
const collectAttachmentIds = () =>
  narrationImages.value
    .map((item) => String(item.attachmentId ?? '').trim())
    .filter(Boolean)

const stopImageGenPoll = () => {
  if (imageGenPollTimer) {
    clearInterval(imageGenPollTimer)
    imageGenPollTimer = null
  }
  imageGenPollAttempts = 0
  imageGenPolling.value = false
}

/** 仅刷新配图列表，保留表单未保存正文 */
const refreshNarrationImagesMeta = async () => {
  if (!stageId.value) return
  try {
    const detail = await request<NarrationDetailResponse | null>('/api/narration/detail', {
      method: 'GET',
      query: { stageId: stageId.value },
    })
    if (!detail) return
    const draftText = form.narrationText.trim()
    narrationDetail.value = {
      ...(narrationDetail.value ?? {}),
      ...detail,
      narrationText: draftText || detail.narrationText,
    }
    syncNarrationImages(detail)
  } catch {
    // 状态刷新失败不阻断主流程
  }
}

/**
 * 轮询 detail.images：任务成功后自动绑定，检测到新附件即结束。
 */
const startImageGenPoll = (baselineAttachmentIds: Set<string>) => {
  stopImageGenPoll()
  imageGenPolling.value = true
  imageGenPollAttempts = 0
  infoMessage.value = '配图生成中，完成后将自动加入列表…'

  const tick = async () => {
    imageGenPollAttempts += 1
    await refreshNarrationImagesMeta()
    emit('preview-refresh')

    const hasNew = collectAttachmentIds().some((id) => !baselineAttachmentIds.has(id))
    if (hasNew) {
      infoMessage.value = '配图已生成并加入列表。'
      errorMessage.value = ''
      stopImageGenPoll()
      return
    }

    if (imageGenPollAttempts >= IMAGE_GEN_POLL_MAX_ATTEMPTS) {
      infoMessage.value = '配图仍在生成，可稍后重新打开节点查看。'
      stopImageGenPoll()
    }
  }

  void tick()
  imageGenPollTimer = setInterval(() => {
    void tick()
  }, IMAGE_GEN_POLL_INTERVAL_MS)
}

const normalizeImageUrl = (value: string) => value.trim()

const isImageGenRefSelected = (url: string) => {
  const target = normalizeImageUrl(url)
  if (!target) return false
  return imageGenRefUrls.value.some((item) => normalizeImageUrl(item) === target)
}

/** 写入参考图；满员 / 重复时给出提示，返回是否成功 */
const pushImageGenRef = (url: string, options?: { silent?: boolean }) => {
  const nextUrl = normalizeImageUrl(url)
  if (!nextUrl || !isPreviewableImageUrl(nextUrl)) {
    if (!options?.silent) {
      errorMessage.value = '请使用可公开访问的 http(s) 图片地址。'
    }
    return false
  }
  if (isImageGenRefSelected(nextUrl)) {
    // 重复加入静默忽略，靠「已参考」标记即可
    return false
  }
  if (imageGenRefUrls.value.length >= IMAGE_GEN_REF_MAX) {
    if (!options?.silent) {
      errorMessage.value = `参考图最多 ${IMAGE_GEN_REF_MAX} 张。`
    }
    return false
  }
  imageGenRefUrls.value = [...imageGenRefUrls.value, nextUrl]
  errorMessage.value = ''
  return true
}

/** 粘贴外链加入参考（成功不弹全局提示，卡片本身即反馈） */
const addImageGenRefFromDraft = () => {
  if (!props.canEdit || generatingImage.value || imageGenPolling.value) return
  if (pushImageGenRef(imageGenRefDraft.value)) {
    imageGenRefDraft.value = ''
  }
}

/** 从已有配图点击加入参考（成功静默，仅「已参考」标记反馈） */
const addImageGenRefFromExisting = (image: RouteStageNarrationImageResponse) => {
  if (!props.canEdit || generatingImage.value || imageGenPolling.value) return
  const url = String(image.imageUrl ?? '').trim()
  if (!url) {
    errorMessage.value = '该配图暂无可用地址，无法加入参考。'
    return
  }
  pushImageGenRef(url, { silent: true })
}

const removeImageGenRef = (index: number) => {
  imageGenRefUrls.value = imageGenRefUrls.value.filter((_, i) => i !== index)
}

let lightboxEscHandler: ((event: KeyboardEvent) => void) | null = null

const bindLightboxEsc = () => {
  if (lightboxEscHandler || typeof window === 'undefined') return
  lightboxEscHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !imageLightboxUrl.value) return
    event.preventDefault()
    event.stopPropagation()
    closeImageLightbox()
  }
  // capture：先于 Dialog 的 Esc 关闭逻辑
  window.addEventListener('keydown', lightboxEscHandler, true)
}

const unbindLightboxEsc = () => {
  if (!lightboxEscHandler || typeof window === 'undefined') return
  window.removeEventListener('keydown', lightboxEscHandler, true)
  lightboxEscHandler = null
}

const openImageLightbox = (url: string) => {
  const next = normalizeImageUrl(url)
  if (!next) return
  // 不强制 http(s) 校验失败就静默：允许同源 / 相对路径预览
  imageLightboxUrl.value = next
  bindLightboxEsc()
}

const closeImageLightbox = () => {
  imageLightboxUrl.value = ''
  unbindLightboxEsc()
}

/** 提交 AI 配图任务；不传 parameters，priority 由服务端代理固定 10000 */
const handleGenerateImages = async () => {
  if (!canGenerateImage.value || !stageId.value) return

  const prompt = imageGenPrompt.value.trim()
  if (!prompt) {
    errorMessage.value = '请填写画面描述。'
    return
  }

  const referenceImageUrls = imageGenRefUrls.value
    .map((item) => normalizeImageUrl(item))
    .filter(Boolean)

  const invalidRef = referenceImageUrls.find((url) => !isPreviewableImageUrl(url))
  if (invalidRef) {
    errorMessage.value = '参考图请使用可公开访问的 http(s) 链接。'
    return
  }

  generatingImage.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  const baseline = new Set(collectAttachmentIds())

  try {
    await request<GenerateRouteStageNarrationImageResponse | null>('/api/narration-image/generate', {
      method: 'POST',
      body: {
        stageId: stageId.value,
        prompt,
        idempotencyKey: uuidv4(),
        ...(referenceImageUrls.length ? { referenceImageUrls } : {}),
      },
    })
    startImageGenPoll(baseline)
  } catch (error) {
    errorMessage.value = resolveError(error, '配图生成提交失败。')
  } finally {
    generatingImage.value = false
  }
}

/**
 * 传统上传双通道：
 * 1) 即时：UploadImage → NarrationImage/create（立即绑定）
 * 2) 保存：update-stage.attachmentIds 再全量同步顺序
 * create 失败时仍写入本地列表，依赖保存时 attachmentIds 落库。
 */
const handleImageFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length || !stageId.value) return

  imageBusy.value = true
  errorMessage.value = ''
  try {
    let nextOrder = narrationImages.value.length
    let createdAny = false
    const pendingLocal: RouteStageNarrationImageResponse[] = []

    for (const file of files) {
      const uploaded = await uploadAttachment(file, 'image')
      const attachmentId = String(uploaded?.fileId ?? '').trim()
      const imageUrl = String(uploaded?.fileUrl ?? '').trim() || null
      if (!attachmentId) {
        throw new Error('上传成功但未返回附件标识。')
      }

      let boundId: string | null = null
      try {
        const createdId = await request<string | null>('/api/narration-image/create', {
          method: 'POST',
          body: {
            stageId: stageId.value,
            attachmentId,
            sortOrder: nextOrder,
          },
        })
        boundId = createdId != null ? String(createdId).trim() || null : null
        createdAny = true
      } catch {
        // create 可选；保存时仍会通过 attachmentIds 同步
      }

      pendingLocal.push({
        id: boundId,
        stageId: stageId.value,
        attachmentId,
        imageUrl,
        sortOrder: nextOrder,
      })
      nextOrder += 1
    }

    if (createdAny) {
      // create 成功则以 detail 为准补全 imageUrl / id
      const detail = await request<NarrationDetailResponse | null>('/api/narration/detail', {
        method: 'GET',
        query: { stageId: stageId.value },
      })
      narrationDetail.value = detail
      syncNarrationImages(detail)
      // detail 若尚未包含刚 create 的图，合并本地 pending
      const knownAttachmentIds = new Set(collectAttachmentIds())
      const missing = pendingLocal.filter(
        (item) => item.attachmentId && !knownAttachmentIds.has(String(item.attachmentId)),
      )
      if (missing.length) {
        narrationImages.value = [...narrationImages.value, ...missing]
      }
    } else {
      narrationImages.value = [...narrationImages.value, ...pendingLocal]
    }
    emit('preview-refresh')
  } catch (error) {
    errorMessage.value = resolveError(error, '配图上传失败。')
  } finally {
    imageBusy.value = false
  }
}

const removeNarrationImage = async (image: RouteStageNarrationImageResponse) => {
  if (!props.canEdit || imageBusy.value) return
  if (!window.confirm('确定删除这张配图吗？')) return

  const id = String(image.id ?? '').trim()
  const attachmentId = String(image.attachmentId ?? '').trim()

  imageBusy.value = true
  errorMessage.value = ''
  try {
    // 已绑定记录走 delete；仅本地 pending 的直接从列表移除，保存时 attachmentIds 会同步
    if (id) {
      await request('/api/narration-image/delete', {
        method: 'POST',
        body: { id },
      })
    }
    narrationImages.value = narrationImages.value.filter((item) => {
      if (id && String(item.id ?? '') === id) return false
      if (!id && attachmentId && String(item.attachmentId ?? '') === attachmentId) return false
      return true
    })
    emit('preview-refresh')
  } catch (error) {
    errorMessage.value = resolveError(error, '配图删除失败。')
  } finally {
    imageBusy.value = false
  }
}

watch(
  () => [props.open, stageId.value, props.node?.config, props.node?.title, props.node?.subtitle],
  () => {
    stopAudioPoll()
    stopImageGenPoll()
    if (isNarration.value && props.open) {
      void loadNarrationDetail().then(() => {
        // 打开时若任务已在排队/生成中，自动接上轮询
        if (props.open && isNarration.value && isAudioPendingStatus(audioStatus.value)) {
          startAudioPoll()
        }
      })
      return
    }
    narrationDetail.value = null
    resetForm()
  },
  { immediate: true },
)

const parseChoiceOptionsForSave = () => form.choiceOptions
  .map((item, index) => {
    const label = item.label.trim()
    if (!label) return null
    return {
      id: item.id.trim() || createOptionId(index),
      label,
    }
  })
  .filter((item): item is ChoiceOptionRow => item !== null)

const parsePiecesForSave = () => form.puzzlePieces
  .map((item, index) => {
    const label = item.label.trim()
    if (!label) return null
    return {
      id: item.id.trim() || createPieceId(index),
      label,
      hint: item.hint.trim() || null,
    }
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
    const options = parseChoiceOptionsForSave()
    const correctId = form.correctOptionId.trim()
    if (!form.prompt.trim() || options.length < 2 || !correctId) {
      errorMessage.value = '请填写题干、至少两个选项，并点选正确答案。'
      return null
    }
    if (!options.some((item) => item.id === correctId)) {
      errorMessage.value = '请点选一个已填写的选项作为正确答案。'
      return null
    }
    config.content = form.prompt.trim()
    config.options = options
    config.correct_option_id = correctId
  } else if (isImagePuzzle.value) {
    const pieces = parsePiecesForSave()
    const pieceIds = new Set(pieces.map((item) => item.id))
    const correctOrder = form.correctOrderIds.filter((id) => pieceIds.has(id))
    if (!form.prompt.trim() || !pieces.length || !correctOrder.length) {
      errorMessage.value = '请填写题干、至少两块碎片，并设置正确顺序。'
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
  // 副标题 / 风格 / 时长 / 场景说明：UI 不再编辑，透传已有值以免被清空
  const targetDurationSeconds = toBoundedInteger(form.targetDurationSeconds, 10, 600, 90)
  // attachmentIds 全量有序同步；与上传时的 NarrationImage/create 互补
  const attachmentIds = collectAttachmentIds()
  await request<UpdateNarrationStageResponse | null>('/api/narration/update-stage', {
    method: 'POST',
    body: {
      stageId: stageId.value,
      title: form.title.trim() || null,
      subtitle: form.subtitle.trim() || null,
      exhibitId: props.node?.refExhibitId ?? null,
      guideId: form.guideId || null,
      userStyleInput: form.userStyleInput.trim() || null,
      sceneContext: form.sceneContext.trim() || null,
      targetDurationSeconds,
      attachmentIds,
    },
  })
  const nextText = form.narrationText.trim()
  const currentText = String(narrationDetail.value?.narrationText ?? '').trim()
  if (nextText && nextText !== currentText) {
    await request<NarrationDetailResponse | null>('/api/narration/update-text', {
      method: 'POST',
      body: {
        stageId: stageId.value,
        narrationText: nextText,
        ...(typeof narrationDetail.value?.version === 'number'
          ? { version: narrationDetail.value.version }
          : {}),
      },
    })
  }
}

const handleGenerateAudio = async () => {
  if (!canGenerateAudio.value) return
  generatingAudio.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    // 未落库的正文先写回，避免服务端因 textStatus 拒绝生成
    const nextText = form.narrationText.trim()
    const currentText = String(narrationDetail.value?.narrationText ?? '').trim()
    if (nextText && nextText !== currentText) {
      const updated = await request<NarrationDetailResponse | null>('/api/narration/update-text', {
        method: 'POST',
        body: {
          stageId: stageId.value,
          narrationText: nextText,
          ...(typeof narrationDetail.value?.version === 'number'
            ? { version: narrationDetail.value.version }
            : {}),
        },
      })
      if (updated) {
        narrationDetail.value = {
          ...(narrationDetail.value ?? {}),
          ...updated,
          narrationText: nextText,
        }
      } else if (narrationDetail.value) {
        narrationDetail.value = {
          ...narrationDetail.value,
          narrationText: nextText,
        }
      }
    }

    await request('/api/narration/generate-audio', {
      method: 'POST',
      body: { stageId: stageId.value },
    })
    // 提交后进入轮询，直到 Completed / Failed / 超时
    await refreshNarrationAudioMeta()
    emit('preview-refresh')
    if (finishAudioPollByStatus(audioStatus.value)) return
    startAudioPoll()
  } catch (error) {
    stopAudioPoll()
    errorMessage.value = resolveError(error, '音频生成任务提交失败。')
  } finally {
    generatingAudio.value = false
  }
}

const closeDialog = () => {
  if (saving.value || generatingAudio.value || imageBusy.value || generatingImage.value) return
  stopAudioPoll()
  stopImageGenPoll()
  closeImageLightbox()
  isOpen.value = false
}

onBeforeUnmount(() => {
  stopAudioPoll()
  stopImageGenPoll()
  closeImageLightbox()
})

const handleSave = async () => {
  if (!canSave.value) return
  saving.value = true
  errorMessage.value = ''
  infoMessage.value = ''
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
    <DialogContent :class="dialogContentClass">
      <!-- 统一头：关闭 X 由 DialogContent 提供 -->
      <div class="flex h-14 shrink-0 items-center border-b border-border/70 px-5 pr-12">
        <DialogHeader class="min-w-0 space-y-0.5 text-left">
          <DialogTitle class="truncate text-base">
            编辑这一站
          </DialogTitle>
          <DialogDescription class="truncate text-xs">
            {{ headerDescription }}
          </DialogDescription>
        </DialogHeader>
      </div>

      <!-- 可滚动内容区：单栏文档流，分区用分割线而非多层嵌套卡片 -->
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div
          v-if="!isSupported"
          class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          这一站的玩法类型暂不支持在此直接编辑。可先用左侧预览查看，或换到其它站点继续调整；如需改动本站，请联系管理员协助。
        </div>

        <template v-else>
          <!-- 站点名称：所有类型共用 -->
          <label class="block space-y-1.5 text-sm font-medium">
            站点名称
            <Input
              v-model="form.title"
              class="max-w-xl"
              :disabled="!props.canEdit || saving" />
          </label>

          <template v-if="isObserveChoice">
            <section class="space-y-3 border-t border-border/60 pt-5">
              <p class="text-sm font-medium">
                题目内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                题干
                <Textarea
                  v-model="form.prompt"
                  class="min-h-[88px]"
                  :disabled="!props.canEdit || saving" />
              </label>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    选项
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    点选左侧圆点设为正确答案
                  </p>
                </div>

                <div class="space-y-2">
                  <div
                    v-for="(option, index) in form.choiceOptions"
                    :key="option.id"
                    class="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2.5 py-2">
                    <input
                      type="radio"
                      class="h-4 w-4 shrink-0 accent-primary"
                      :name="`correct-option-${stageId}`"
                      :checked="form.correctOptionId === option.id"
                      :disabled="!props.canEdit || saving"
                      :title="`设为正确答案`"
                      @change="form.correctOptionId = option.id">
                    <Input
                      v-model="option.label"
                      class="min-w-0 flex-1"
                      :placeholder="`选项 ${index + 1}`"
                      :disabled="!props.canEdit || saving" />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      class="shrink-0"
                      :disabled="!props.canEdit || saving || form.choiceOptions.length <= 2"
                      @click="removeChoiceOption(index)">
                      删除
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  class="h-8"
                  :disabled="!props.canEdit || saving"
                  @click="addChoiceOption">
                  添加选项
                </Button>
              </div>
            </section>
          </template>

          <template v-else-if="isImagePuzzle">
            <section class="space-y-3 border-t border-border/60 pt-5">
              <p class="text-sm font-medium">
                拼图内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                题干
                <Textarea
                  v-model="form.prompt"
                  class="min-h-[88px]"
                  :disabled="!props.canEdit || saving" />
              </label>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    拼图图片
                  </p>
                  <span class="text-[11px] text-muted-foreground">JPG / PNG</span>
                </div>
                <input
                  ref="puzzleImageInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handlePuzzleImageUpload">
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    class="h-8"
                    :disabled="!props.canEdit || saving || mediaUploading"
                    @click="openPuzzleImagePicker">
                    {{ mediaUploading ? '上传中…' : form.imageUrl ? '重新上传' : '上传图片' }}
                  </Button>
                  <Button
                    v-if="form.imageUrl"
                    variant="ghost"
                    size="sm"
                    type="button"
                    class="h-8"
                    :disabled="!props.canEdit || saving || mediaUploading"
                    @click="clearPuzzleImage">
                    清除
                  </Button>
                </div>
                <div
                  v-if="form.imageUrl"
                  class="overflow-hidden rounded-lg border border-border/60 bg-background/40">
                  <img
                    :src="form.imageUrl"
                    alt="拼图预览"
                    class="max-h-40 w-full object-contain">
                </div>
                <div class="rounded-lg border border-border/50">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
                    @click="showMediaAdvanced = !showMediaAdvanced">
                    <span>高级：使用图片地址</span>
                    <span>{{ showMediaAdvanced ? '收起' : '展开' }}</span>
                  </button>
                  <div v-if="showMediaAdvanced" class="border-t border-border/50 px-3 py-2">
                    <Input
                      v-model="form.imageUrl"
                      placeholder="https://..."
                      :disabled="!props.canEdit || saving" />
                  </div>
                </div>
              </div>

              <label class="block space-y-1.5 text-sm font-medium">
                网格尺寸
                <Input
                  v-model="form.gridSize"
                  type="number"
                  min="1"
                  max="12"
                  :disabled="!props.canEdit || saving" />
              </label>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    拼图碎片
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    填写名称即可，标识由系统保存
                  </p>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(piece, index) in form.puzzlePieces"
                    :key="piece.id"
                    class="grid gap-2 rounded-lg border border-border/60 bg-background/30 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Input
                      v-model="piece.label"
                      class="min-w-0"
                      :placeholder="`碎片 ${index + 1} 名称`"
                      :disabled="!props.canEdit || saving" />
                    <Input
                      v-model="piece.hint"
                      class="min-w-0"
                      placeholder="提示（可选）"
                      :disabled="!props.canEdit || saving" />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      class="shrink-0"
                      :disabled="!props.canEdit || saving || form.puzzlePieces.length <= 2"
                      @click="removePuzzlePiece(index)">
                      删除
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  class="h-8"
                  :disabled="!props.canEdit || saving"
                  @click="addPuzzlePiece">
                  添加碎片
                </Button>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    正确顺序
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    用上下调整游客应拼合的先后
                  </p>
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="(pieceId, index) in form.correctOrderIds"
                    :key="`order-${pieceId}`"
                    class="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2.5 py-2">
                    <span class="w-6 shrink-0 text-center text-xs text-muted-foreground">
                      {{ index + 1 }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm">
                      {{ pieceLabelById(pieceId) }}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      class="h-8 shrink-0 px-2"
                      :disabled="!props.canEdit || saving || index === 0"
                      @click="moveCorrectOrder(index, -1)">
                      上移
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      class="h-8 shrink-0 px-2"
                      :disabled="!props.canEdit || saving || index >= form.correctOrderIds.length - 1"
                      @click="moveCorrectOrder(index, 1)">
                      下移
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="isFindScan">
            <section class="space-y-3 border-t border-border/60 pt-5">
              <p class="text-sm font-medium">
                寻访内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                寻找线索
                <Textarea
                  v-model="form.clueText"
                  class="min-h-[112px]"
                  :disabled="!props.canEdit || saving" />
              </label>
              <label class="block space-y-1.5 text-sm font-medium">
                目标位置
                <Input v-model="form.location" :disabled="!props.canEdit || saving" />
              </label>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    观展短片
                  </p>
                  <span class="text-[11px] text-muted-foreground">视频文件</span>
                </div>
                <input
                  ref="videoInput"
                  type="file"
                  accept="video/*,.mp4"
                  class="hidden"
                  @change="handleVideoUpload">
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    class="h-8"
                    :disabled="!props.canEdit || saving || mediaUploading"
                    @click="openVideoPicker">
                    {{ mediaUploading ? '上传中…' : form.videoUrl ? '重新上传' : '上传短片' }}
                  </Button>
                  <Button
                    v-if="form.videoUrl"
                    variant="ghost"
                    size="sm"
                    type="button"
                    class="h-8"
                    :disabled="!props.canEdit || saving || mediaUploading"
                    @click="clearVideoUrl">
                    清除
                  </Button>
                </div>
                <p
                  v-if="form.videoUrl"
                  class="truncate text-xs text-muted-foreground"
                  :title="form.videoUrl">
                  已设置短片
                </p>
                <div class="rounded-lg border border-border/50">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
                    @click="showMediaAdvanced = !showMediaAdvanced">
                    <span>高级：使用视频地址</span>
                    <span>{{ showMediaAdvanced ? '收起' : '展开' }}</span>
                  </button>
                  <div v-if="showMediaAdvanced" class="border-t border-border/50 px-3 py-2">
                    <Input
                      v-model="form.videoUrl"
                      placeholder="https://..."
                      :disabled="!props.canEdit || saving" />
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- type 11：三块清晰分区 — 正文 / 讲解与音频 / 配图 -->
          <template v-else-if="isNarration">
            <div class="space-y-5">
              <!-- 正文 + 讲解侧栏 -->
              <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label class="block space-y-1.5 text-sm font-medium">
                  解说词
                  <Textarea
                    v-model="form.narrationText"
                    class="h-[200px] resize-y text-sm leading-6 lg:h-[240px]"
                    placeholder="请输入解说词正文…"
                    :disabled="!props.canEdit || saving" />
                </label>

                <div class="space-y-4 lg:border-l lg:border-border/60 lg:pl-5">
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="form-label text-sm font-medium">导游</span>
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-7 shrink-0 px-2.5 text-xs"
                        :disabled="!props.canEdit || saving"
                        @click="openGuideSelector">
                        选择
                      </Button>
                    </div>
                    <p class="form-value break-words text-sm">
                      {{ selectedGuideLabel }}
                    </p>
                  </div>

                  <div class="space-y-2 border-t border-border/50 pt-4">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="form-label text-sm font-medium">
                          音频
                        </p>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                          {{ audioStatusLabel }}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-7 shrink-0 px-2.5 text-xs"
                        :disabled="!canGenerateAudio"
                        @click="handleGenerateAudio">
                        {{ generatingAudio ? '提交中…' : audioPolling ? '同步中…' : '生成' }}
                      </Button>
                    </div>
                    <audio
                      v-if="audioUrl"
                      :src="audioUrl"
                      controls
                      preload="none"
                      class="h-9 w-full" />
                  </div>
                </div>
              </div>

              <!-- 配图：单层区块，顶栏 + 内容 + 图库 -->
              <div class="space-y-3 border-t border-border/60 pt-5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="form-label text-sm font-medium">配图</span>
                  <div
                    class="inline-flex rounded-md border border-border/70 p-0.5"
                    role="tablist"
                    aria-label="配图来源">
                    <button
                      type="button"
                      role="tab"
                      class="h-7 rounded px-2.5 text-xs transition-colors"
                      :class="imageSourceMode === 'upload'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'"
                      :aria-selected="imageSourceMode === 'upload'"
                      :disabled="!props.canEdit || generatingImage || imageGenPolling"
                      @click="imageSourceMode = 'upload'">
                      上传
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="h-7 rounded px-2.5 text-xs transition-colors"
                      :class="imageSourceMode === 'generate'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'"
                      :aria-selected="imageSourceMode === 'generate'"
                      :disabled="!props.canEdit || imageBusy"
                      @click="imageSourceMode = 'generate'">
                      AI 生成
                    </button>
                  </div>
                </div>

                <div v-if="imageSourceMode === 'upload'" class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    class="h-8"
                    :disabled="!props.canEdit || saving || imageBusy || generatingImage || imageGenPolling || !stageId"
                    @click="openImagePicker">
                    <AppIcon name="image-up" class="mr-1.5 h-3.5 w-3.5" />
                    {{ imageBusy ? '处理中…' : '选择图片' }}
                  </Button>
                  <input
                    ref="imageInput"
                    type="file"
                    accept="image/*"
                    multiple
                    class="hidden"
                    @change="handleImageFiles">
                </div>

                <div v-else class="space-y-3">
                  <label class="block space-y-1.5 text-sm font-medium">
                    画面描述
                    <Textarea
                      v-model="imageGenPrompt"
                      class="min-h-[72px] resize-y text-sm"
                      placeholder="描述希望生成的画面…"
                      :disabled="!props.canEdit || saving || generatingImage || imageGenPolling"
                      maxlength="4000" />
                  </label>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">
                        参考图
                        <span class="font-normal text-muted-foreground">
                          {{ imageGenRefUrls.length }}/{{ IMAGE_GEN_REF_MAX }}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        class="h-8"
                        :disabled="!canGenerateImage"
                        @click="handleGenerateImages">
                        {{ generatingImage ? '提交中…' : imageGenPolling ? '生成中…' : '开始生成' }}
                      </Button>
                    </div>
                    <div class="flex gap-2">
                      <Input
                        v-model="imageGenRefDraft"
                        class="h-8 min-w-0 flex-1 text-sm"
                        placeholder="粘贴参考图链接"
                        :disabled="!props.canEdit || saving || generatingImage || imageGenPolling || imageGenRefUrls.length >= IMAGE_GEN_REF_MAX"
                        @keydown.enter.prevent="addImageGenRefFromDraft" />
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-8 shrink-0"
                        :disabled="!props.canEdit || !imageGenRefDraft.trim() || imageGenRefUrls.length >= IMAGE_GEN_REF_MAX || generatingImage || imageGenPolling"
                        @click="addImageGenRefFromDraft">
                        加入
                      </Button>
                    </div>
                    <div
                      v-if="imageGenRefUrls.length"
                      class="grid grid-cols-5 gap-2 sm:grid-cols-6">
                      <div
                        v-for="(refUrl, refIndex) in imageGenRefUrls"
                        :key="`ref-${refIndex}-${refUrl}`"
                        class="relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20">
                        <button
                          type="button"
                          class="absolute inset-0 block h-full w-full cursor-zoom-in"
                          title="放大"
                          @click="openImageLightbox(refUrl)">
                          <img :src="refUrl" alt="" class="h-full w-full object-cover">
                        </button>
                        <button
                          v-if="props.canEdit"
                          type="button"
                          class="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white"
                          title="移除"
                          :disabled="generatingImage || imageGenPolling"
                          @click.stop="removeImageGenRef(refIndex)">
                          <AppIcon name="x" class="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 图库 -->
                <div
                  v-if="narrationImages.length"
                  class="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  <div
                    v-for="(image, index) in narrationImages"
                    :key="String(image.id || image.attachmentId || image.imageUrl || index)"
                    class="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20"
                    :class="imageSourceMode === 'generate' && isImageGenRefSelected(String(image.imageUrl ?? ''))
                      ? 'ring-2 ring-primary/60'
                      : ''">
                    <button
                      v-if="imageSourceMode === 'generate' && image.imageUrl"
                      type="button"
                      class="absolute inset-0 block h-full w-full"
                      :disabled="!props.canEdit || generatingImage || imageGenPolling"
                      :title="isImageGenRefSelected(String(image.imageUrl)) ? '已参考' : '加入参考'"
                      @click="addImageGenRefFromExisting(image)">
                      <img
                        :src="String(image.imageUrl)"
                        :alt="`配图 ${index + 1}`"
                        class="h-full w-full object-cover">
                      <span
                        v-if="isImageGenRefSelected(String(image.imageUrl))"
                        class="absolute left-1 top-1 rounded bg-primary/90 px-1 py-0.5 text-[10px] text-primary-foreground">
                        参考
                      </span>
                    </button>
                    <template v-else>
                      <img
                        v-if="image.imageUrl"
                        :src="String(image.imageUrl)"
                        :alt="`配图 ${index + 1}`"
                        class="h-full w-full object-cover">
                      <div
                        v-else
                        class="flex h-full w-full items-center justify-center text-muted-foreground">
                        <AppIcon name="image-up" class="h-4 w-4" />
                      </div>
                    </template>

                    <button
                      v-if="image.imageUrl"
                      type="button"
                      class="absolute right-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      title="放大"
                      @click.stop.prevent="openImageLightbox(String(image.imageUrl))">
                      <AppIcon name="zoom-in" class="h-3 w-3" />
                    </button>

                    <div class="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-black/55 px-1 py-0.5">
                      <span class="truncate text-[10px] text-white/90">
                        {{ index === 0 ? '封面' : index + 1 }}
                      </span>
                      <button
                        v-if="props.canEdit"
                        type="button"
                        class="text-[10px] text-white/90 hover:text-white disabled:opacity-40"
                        :disabled="imageBusy || generatingImage || imageGenPolling"
                        @click.stop="removeNarrationImage(image)">
                        删
                      </button>
                    </div>
                  </div>
                </div>
                <p
                  v-else
                  class="text-xs text-muted-foreground">
                  暂无配图
                </p>
              </div>
            </div>
          </template>

          <template v-if="!isNarration">
            <section class="space-y-3 border-t border-border/60 pt-5">
              <label class="block space-y-1.5 text-sm font-medium">
                提示（每行一条）
                <Textarea
                  v-model="form.hintsInput"
                  class="min-h-[96px]"
                  :disabled="!props.canEdit || saving" />
              </label>
            </section>
          </template>
        </template>

        <p v-if="errorMessage" class="shrink-0 text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <p v-else-if="infoMessage" class="shrink-0 text-sm text-muted-foreground">
          {{ infoMessage }}
        </p>
      </div>

      <!-- 固定高度 footer 贴底；音频生成入口在「解说音频」区块，此处不重复 -->
      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/70 px-5">
        <Button
          variant="outline"
          type="button"
          class="h-8"
          :disabled="saving || generatingAudio || generatingImage"
          @click="closeDialog">
          取消
        </Button>
        <Button
          type="button"
          class="h-8"
          :disabled="!canSave"
          @click="handleSave">
          {{ saving ? '保存中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <GuideSelectDialog
    v-model:open="guideSelectOpen"
    :guides="guides"
    :pending="guidePending"
    :selected-id="form.guideId || null"
    @select="selectGuide"
    @search="loadGuides" />

  <!-- 配图大图预览：z 须高于 Dialog 栈（基线 1000） -->
  <Teleport to="body">
    <div
      v-if="imageLightboxUrl"
      data-image-lightbox
      class="fixed inset-0 flex items-center justify-center bg-black/85 p-4"
      style="z-index: 5000"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @click="closeImageLightbox">
      <button
        type="button"
        class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        title="关闭"
        @click.stop="closeImageLightbox">
        <AppIcon name="x" class="h-4 w-4" />
      </button>
      <img
        :src="imageLightboxUrl"
        alt="预览"
        class="max-h-[90vh] max-w-[min(96vw,1100px)] rounded-lg object-contain shadow-2xl"
        @click.stop>
    </div>
  </Teleport>
</template>