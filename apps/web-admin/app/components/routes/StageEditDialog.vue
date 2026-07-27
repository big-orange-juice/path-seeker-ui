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
import { IMAGE_LIGHTBOX_Z_INDEX } from '@/components/shadcn/dialog/layer'
import Input from '@/components/shadcn/input/Input.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  getInteractionTypeMeta,
  isSupportedInteractionType,
  parseJsonValue,
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

/** 拼图碎片行：对齐 config.pieces[]（id/key/label/hint/image_url/correct_row/col） */
interface PuzzlePieceRow {
  id: string
  label: string
  hint: string
  /** 预裁切碎片图；每片独立上传，对应 pieces[].image_url */
  imageUrl: string
  /** 正解行列（0 基）；编辑时由列表顺序回算 */
  correctRow: number | null
  correctCol: number | null
}

interface StageFormState {
  title: string
  subtitle: string
  prompt: string
  choiceOptions: ChoiceOptionRow[]
  correctOptionId: string
  hintsInput: string
  imageUrl: string
  /** 网格行数（对齐后端 config.grid_rows） */
  gridRows: string
  /** 网格列数（对齐后端 config.grid_cols） */
  gridCols: string
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
/** 手动刷新音频状态中 */
const refreshingAudio = ref(false)
const imageBusy = ref(false)
/** 配图来源：手动上传 / AI 生成（二选一交互） */
const imageSourceMode = ref<'upload' | 'generate'>('upload')
/** AI 配图：画面描述 */
const imageGenPrompt = ref('')
/** AI 配图：上传得到的参考图 URL（最多 5，与下方已有配图勾选合计） */
const imageGenRefUrls = ref<string[]>([])
/** AI 配图：从已有配图勾选的参考 URL（不写入上方上传列表，避免重复） */
const imageGenSelectedExistingUrls = ref<string[]>([])
/** 大图预览（参考图 / 已有配图） */
const imageLightboxUrl = ref('')
const generatingImage = ref(false)
/** 手动刷新配图列表中 */
const refreshingImages = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const narrationDetail = ref<NarrationDetailResponse | null>(null)
const IMAGE_GEN_REF_MAX = 5
/** 音频 / AI 配图已提交、等待用户手动刷新时的提示 */
const PENDING_GEN_TIP = '已提交生成，完成后请点击刷新查看。'
/** 解说配图本地列表；与 detail.images 同步，增删走 NarrationImage API */
const narrationImages = shallowRef<RouteStageNarrationImageResponse[]>([])
const imageInputRef = useTemplateRef<HTMLInputElement>('imageInput')
const imageGenRefInputRef = useTemplateRef<HTMLInputElement>('imageGenRefInput')
const pieceImageInputRef = useTemplateRef<HTMLInputElement>('pieceImageInput')
const videoInputRef = useTemplateRef<HTMLInputElement>('videoInput')
const baseConfig = ref<Record<string, unknown>>({})
const guideSelectOpen = ref(false)
const guidePending = ref(false)
const guides = ref<GuideRecord[]>([])
const mediaUploading = ref(false)
const showMediaAdvanced = ref(false)
/** 当前正在上传碎片图的格子下标 */
const pieceUploadIndex = ref<number | null>(null)
/** 拼图编辑网格：拖动交换起点 / 悬停目标 */
const pieceDragFrom = ref<number | null>(null)
const pieceDragOver = ref<number | null>(null)
let pieceDragPointerId: number | null = null
const form = reactive<StageFormState>({
  title: '', subtitle: '', prompt: '', choiceOptions: [], correctOptionId: '', hintsInput: '',
  imageUrl: '', gridRows: '3', gridCols: '3', puzzlePieces: [], correctOrderIds: [], clueText: '', location: '', videoUrl: '',
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
  && !refreshingAudio.value,
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
  && !imageBusy.value
  && !refreshingImages.value
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
const readText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** 兼容数组 / JSON 字符串 / .NET $values，与 adaptStage.asArray 对齐 */
const asConfigArray = (value: unknown): unknown[] => {
  const parsed = parseJsonValue(value)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const values = (parsed as { $values?: unknown }).$values
    if (Array.isArray(values)) return values
  }
  return []
}

const readRecordText = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const text = readText(record[key])
    if (text) return text
  }
  return ''
}

const toLines = (value: unknown, mapper: (item: Record<string, unknown>, index: number) => string) =>
  asConfigArray(value).map((item, index) => mapper(item as Record<string, unknown>, index)).join('\n')

const createOptionId = (index: number) => `option-${index + 1}`
const createPieceId = (index: number) => `piece-${index + 1}`

/**
 * 解析线性答题选项。
 * 兼容：对象数组、纯字符串数组、JSON 字符串、$values，以及 label/text/title/content/value 等别名。
 */
const parseChoiceOptions = (value: unknown): ChoiceOptionRow[] => {
  const rows = asConfigArray(value).map((item, index) => {
    // 纯字符串选项：["两种", "三种"]
    if (typeof item === 'string' || typeof item === 'number') {
      const label = readText(item)
      return { id: createOptionId(index), label }
    }
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    // id 只用标识字段；value 更常见作文案，留给 label
    const id = readRecordText(record, 'id', 'Id', 'key', 'Key') || createOptionId(index)
    const label = readRecordText(
      record,
      'label', 'Label',
      'text', 'Text',
      'title', 'Title',
      'content', 'Content',
      'name', 'Name',
      'option', 'Option',
      'value', 'Value',
    )
    return { id, label }
  }).filter((item) => Boolean(item.label.trim()))

  if (rows.length >= 2) {
    return rows
  }

  // 不足两项时补空行，便于编辑；已有一项则保留
  if (rows.length === 1) {
    return [...rows, { id: createOptionId(1), label: '' }]
  }

  return [
    { id: 'option-1', label: '' },
    { id: 'option-2', label: '' },
  ]
}

const readNumberOrNull = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

const emptyPieceRow = (index: number): PuzzlePieceRow => ({
  id: createPieceId(index),
  label: '',
  hint: '',
  imageUrl: '',
  correctRow: null,
  correctCol: null,
})

/**
 * 解析拼图碎片（对齐 config.pieces[]）：
 * id / key / label / hint / image_url / correct_row / correct_col
 */
const parsePuzzlePieces = (value: unknown): PuzzlePieceRow[] => {
  const rows = asConfigArray(value).map((item, index) => {
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const id = readRecordText(record, 'id', 'Id', 'key', 'Key', 'value', 'Value') || createPieceId(index)
    const label = readRecordText(record, 'label', 'Label', 'text', 'Text', 'title', 'Title', 'name', 'Name')
      || `碎片 ${index + 1}`
    return {
      id,
      label,
      hint: readRecordText(record, 'hint', 'Hint', 'description', 'Description'),
      imageUrl: readRecordText(record, 'image_url', 'imageUrl', 'ImageUrl', 'url', 'Url'),
      correctRow: readNumberOrNull(record.correct_row, record.correctRow, record.row, record.Row),
      correctCol: readNumberOrNull(record.correct_col, record.correctCol, record.col, record.Col),
    }
  }).filter((item) => Boolean(item.id.trim() || item.imageUrl.trim() || item.label.trim()))

  if (rows.length) {
    return rows
  }

  return [emptyPieceRow(0), emptyPieceRow(1)]
}

/**
 * 列表顺序 = 正确拼合顺序（行优先）。
 * 优先 config.correct_order；否则按 correct_row/col 排序；再否则保持原序。
 */
const orderPuzzlePieces = (pieces: PuzzlePieceRow[], orderSource: unknown, cols: number): PuzzlePieceRow[] => {
  if (!pieces.length) return pieces
  const byId = new Map(pieces.map((item) => [item.id, item]))
  const fromConfig = asConfigArray(orderSource)
    .map((item) => String(item).trim())
    .map((id) => byId.get(id))
    .filter((item): item is PuzzlePieceRow => Boolean(item))

  if (fromConfig.length === pieces.length) {
    return fromConfig
  }
  if (fromConfig.length) {
    const used = new Set(fromConfig.map((item) => item.id))
    return [...fromConfig, ...pieces.filter((item) => !used.has(item.id))]
  }

  const positioned = pieces.filter((item) => item.correctRow != null && item.correctCol != null)
  if (positioned.length === pieces.length) {
    const span = Math.max(1, cols)
    return [...pieces].sort(
      (left, right) =>
        (Number(left.correctRow) * span + Number(left.correctCol))
        - (Number(right.correctRow) * span + Number(right.correctCol)),
    )
  }

  return pieces
}

const syncCorrectOrderFromPieces = () => {
  form.correctOrderIds = form.puzzlePieces.map((item) => item.id)
}

/** 编辑网格行列（与渲染端 grid_rows / grid_cols 一致） */
const clampGridDim = (value: string, fallback = 3) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue)
    ? Math.min(12, Math.max(1, Math.round(numberValue)))
    : fallback
}
const puzzleGridRows = computed(() => clampGridDim(form.gridRows))
const puzzleGridCols = computed(() => clampGridDim(form.gridCols))
const puzzleSlotCount = computed(() => puzzleGridRows.value * puzzleGridCols.value)
/** 编辑盘面：单格约 144px，整体不超过 560px（相对上一版 ×2，保证换图/删除可点） */
const puzzleGridStyle = computed(() => {
  const cols = puzzleGridCols.value
  const rows = puzzleGridRows.value
  const maxBoard = 560
  const cell = Math.max(80, Math.min(144, Math.floor(maxBoard / Math.max(cols, rows))))
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    width: `${cell * cols}px`,
    height: `${cell * rows}px`,
  }
})

/**
 * 按当前行列对齐碎片槽位数：多裁少补。
 * 编辑态固定 rows×cols 格，与渲染盘面一致。
 */
const ensurePuzzleGridSize = () => {
  const count = Math.max(1, puzzleSlotCount.value)
  const usedIds = new Set(form.puzzlePieces.map((item) => item.id))
  while (form.puzzlePieces.length < count) {
    const index = form.puzzlePieces.length
    let next = index + 1
    let id = createPieceId(next)
    while (usedIds.has(id)) {
      next += 1
      id = createPieceId(next)
    }
    usedIds.add(id)
    form.puzzlePieces.push({
      ...emptyPieceRow(index),
      id,
      label: `碎片 ${index + 1}`,
    })
  }
  if (form.puzzlePieces.length > count) {
    form.puzzlePieces.splice(count)
  }
  // 空名称按槽位补默认名，便于保存
  form.puzzlePieces.forEach((piece, index) => {
    if (!piece.label.trim()) {
      piece.label = `碎片 ${index + 1}`
    }
  })
  syncCorrectOrderFromPieces()
}

const resetForm = () => {
  const node = props.node
  const config = node ? parseStageConfig(node.config) as Record<string, unknown> : {}
  baseConfig.value = { ...config }
  // 答案扩展：可能嵌在 config.answer_extra（JSON 字符串或对象），与 C 端 StagePlay.answerExtra 同源字段
  const answerExtra = parseStageConfig(
    config.answer_extra ?? config.answerExtra ?? config.AnswerExtra,
  ) as Record<string, unknown>

  form.title = node?.title || ''
  form.subtitle = node?.subtitle || ''
  form.prompt = readText(config.content)
    || readText(config.Content)
    || readText(config.prompt)
    || readText(config.Prompt)
  form.choiceOptions = parseChoiceOptions(
    config.options
    ?? config.Options
    ?? config.choices
    ?? config.Choices
    ?? answerExtra.options
    ?? answerExtra.Options
    ?? answerExtra.choices,
  )
  form.correctOptionId = readText(config.correct_option_id)
    || readText(config.correctOptionId)
    || readText(config.CorrectOptionId)
    || readText(config.answer)
    || readText(answerExtra.correct_option_id)
    || readText(answerExtra.correctOptionId)
    || readText(answerExtra.answer)
    || readText(answerExtra.correct_answer)
  if (!form.choiceOptions.some((item) => item.id === form.correctOptionId)) {
    form.correctOptionId = form.choiceOptions[0]?.id || ''
  }
  form.hintsInput = toLines(config.hints, (item) => readText(item.content) || readText(item.text))
  form.imageUrl = readText(config.base_image_url)
    || readText(config.baseImageUrl)
    || readText(config.image_url)
    || readText(config.imageUrl)
  // 行列：显式优先；仅有旧 grid_size 时按正方形回填
  const legacyGridSize = readNumberOrNull(config.grid_size, config.gridSize)
  form.gridRows = String(readNumberOrNull(config.grid_rows, config.gridRows) ?? legacyGridSize ?? 3)
  form.gridCols = String(readNumberOrNull(config.grid_cols, config.gridCols) ?? legacyGridSize ?? 3)
  const cols = Number(form.gridCols) || 3
  form.puzzlePieces = orderPuzzlePieces(
    parsePuzzlePieces(config.pieces ?? config.Pieces ?? config.items ?? config.fragments ?? config.peace),
    config.correct_order ?? config.correctOrder ?? answerExtra.correct_order ?? answerExtra.correctOrder,
    cols,
  )
  // 按行列铺满网格槽位，与渲染盘面一致
  ensurePuzzleGridSize()
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
  pieceUploadIndex.value = null
  resetPieceDrag()
  imageSourceMode.value = 'upload'
  imageGenPrompt.value = ''
  imageGenRefUrls.value = []
  imageGenSelectedExistingUrls.value = []
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

/** 交换两格碎片（正解位置随槽位变） */
const swapPuzzlePieces = (from: number, to: number) => {
  if (from === to || from < 0 || to < 0) return
  const list = form.puzzlePieces
  if (from >= list.length || to >= list.length) return
  const left = list[from]
  const right = list[to]
  if (left === undefined || right === undefined) return
  list[from] = right
  list[to] = left
  syncCorrectOrderFromPieces()
}

const openPieceImagePicker = (index: number) => {
  if (!props.canEdit || mediaUploading.value || saving.value) return
  pieceUploadIndex.value = index
  pieceImageInputRef.value?.click()
}

const openVideoPicker = () => {
  if (!props.canEdit || mediaUploading.value || saving.value) return
  videoInputRef.value?.click()
}

const handlePieceImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  const index = pieceUploadIndex.value
  if (!file || index == null || index < 0 || index >= form.puzzlePieces.length) {
    pieceUploadIndex.value = null
    return
  }

  mediaUploading.value = true
  errorMessage.value = ''
  try {
    const uploaded = await uploadAttachment(file, 'image')
    const url = String(uploaded?.fileUrl ?? '').trim()
    if (!url) {
      throw new Error('上传成功但未返回图片地址。')
    }
    const piece = form.puzzlePieces[index]
    if (piece) {
      piece.imageUrl = url
      if (!piece.label.trim()) {
        piece.label = `碎片 ${index + 1}`
      }
    }
    // 兼容字段：首片图同步到 base_image_url（部分旧预览仍读底图）
    if (index === 0 || !form.imageUrl.trim()) {
      form.imageUrl = url
    }
    infoMessage.value = `第 ${index + 1} 格碎片已上传。`
  } catch (error) {
    errorMessage.value = resolveError(error, '碎片图片上传失败。')
  } finally {
    mediaUploading.value = false
    pieceUploadIndex.value = null
  }
}

/** 清除格内碎片图（槽位保留，对齐固定行列网格） */
const clearPieceImage = (index: number) => {
  const piece = form.puzzlePieces[index]
  if (!piece) return
  piece.imageUrl = ''
}

const resetPieceDrag = () => {
  pieceDragFrom.value = null
  pieceDragOver.value = null
  pieceDragPointerId = null
}

const pieceSlotFromPoint = (clientX: number, clientY: number): number | null => {
  if (typeof document === 'undefined') return null
  const el = document.elementFromPoint(clientX, clientY)
  const cell = el?.closest?.('[data-puzzle-slot]') as HTMLElement | null
  if (!cell) return null
  const slot = Number(cell.dataset.puzzleSlot)
  return Number.isFinite(slot) ? slot : null
}

/** 与渲染端一致：拖到另一格松开即交换 */
const onPiecePointerDown = (index: number, event: PointerEvent) => {
  if (!props.canEdit || mediaUploading.value || saving.value) return
  // 点在操作按钮上不进入拖动
  const target = event.target as HTMLElement | null
  if (target?.closest?.('[data-piece-action]')) return

  pieceDragPointerId = event.pointerId
  pieceDragFrom.value = index
  pieceDragOver.value = index
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  } catch {
    // ignore
  }
}

const onPiecePointerMove = (event: PointerEvent) => {
  if (pieceDragFrom.value === null || pieceDragPointerId !== event.pointerId) return
  const slot = pieceSlotFromPoint(event.clientX, event.clientY)
  if (slot !== null) {
    pieceDragOver.value = slot
  }
}

const onPiecePointerUp = (event: PointerEvent) => {
  if (pieceDragFrom.value === null || pieceDragPointerId !== event.pointerId) return
  const from = pieceDragFrom.value
  const to = pieceSlotFromPoint(event.clientX, event.clientY)
  resetPieceDrag()
  if (to == null || to === from) return
  swapPuzzlePieces(from, to)
}

const onPiecePointerCancel = (event: PointerEvent) => {
  if (pieceDragPointerId !== null && event.pointerId !== pieceDragPointerId) return
  resetPieceDrag()
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

/** 仅刷新音频相关字段，避免冲掉表单未保存编辑 */
const refreshNarrationAudioMeta = async () => {
  if (!stageId.value) return
  const detail = await request<NarrationDetailResponse | null>('/api/narration/detail', {
    method: 'GET',
    query: { stageId: stageId.value },
  })
  if (!detail) return
  const draftText = form.narrationText.trim()
  narrationDetail.value = {
    ...(narrationDetail.value ?? {}),
    ...detail,
    // 表单正文优先，避免刷新冲掉未保存编辑
    narrationText: draftText || detail.narrationText,
  }
}

/** 根据最新 audioStatus 给出反馈；已有可播放音频时不叠「等待生成」提示 */
const applyAudioStatusFeedback = () => {
  const status = audioStatus.value
  if (status === NARRATION_AUDIO_STATUS.Completed) {
    errorMessage.value = ''
    if (infoMessage.value === PENDING_GEN_TIP) {
      infoMessage.value = ''
    }
    return
  }
  if (status === NARRATION_AUDIO_STATUS.Failed) {
    errorMessage.value = '音频生成失败，请稍后重试。'
    infoMessage.value = ''
    return
  }
  if (status === NARRATION_AUDIO_STATUS.Stale) {
    infoMessage.value = '解说词已变更，请重新生成音频。'
    return
  }
  if (isAudioPendingStatus(status) && !audioUrl.value) {
    infoMessage.value = PENDING_GEN_TIP
  }
}

/** 手动刷新音频状态（不轮询） */
const handleRefreshAudio = async () => {
  if (!stageId.value || refreshingAudio.value || generatingAudio.value) return
  refreshingAudio.value = true
  errorMessage.value = ''
  try {
    await refreshNarrationAudioMeta()
    applyAudioStatusFeedback()
    emit('preview-refresh')
  } catch (error) {
    errorMessage.value = resolveError(error, '刷新音频状态失败。')
  } finally {
    refreshingAudio.value = false
  }
}

const openImagePicker = () => {
  if (!props.canEdit || imageBusy.value || saving.value || generatingImage.value) return
  imageInputRef.value?.click()
}

/** 当前列表中的附件 ID（有序），供 update-stage.attachmentIds 全量同步 */
const collectAttachmentIds = () =>
  narrationImages.value
    .map((item) => String(item.attachmentId ?? '').trim())
    .filter(Boolean)

/** 仅刷新配图列表，保留表单未保存正文 */
const refreshNarrationImagesMeta = async () => {
  if (!stageId.value) return
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
  if (narrationImages.value.length > 0 && infoMessage.value === PENDING_GEN_TIP) {
    infoMessage.value = ''
  }
}

/** 手动刷新配图（AI 生成不轮询） */
const handleRefreshNarrationImages = async () => {
  if (!stageId.value || refreshingImages.value || generatingImage.value || imageBusy.value) return
  refreshingImages.value = true
  errorMessage.value = ''
  try {
    await refreshNarrationImagesMeta()
    emit('preview-refresh')
  } catch (error) {
    errorMessage.value = resolveError(error, '刷新配图失败。')
  } finally {
    refreshingImages.value = false
  }
}

const normalizeImageUrl = (value: string) => value.trim()

/** 上传参考 + 已有配图勾选合计数量 */
const imageGenRefTotalCount = computed(
  () => imageGenRefUrls.value.length + imageGenSelectedExistingUrls.value.length,
)

const isImageGenRefSelected = (url: string) => {
  const target = normalizeImageUrl(url)
  if (!target) return false
  return imageGenSelectedExistingUrls.value.some((item) => normalizeImageUrl(item) === target)
    || imageGenRefUrls.value.some((item) => normalizeImageUrl(item) === target)
}

/** 写入上传参考图；满员 / 重复时提示 */
const pushImageGenRef = (url: string, options?: { silent?: boolean }) => {
  const nextUrl = normalizeImageUrl(url)
  if (!nextUrl || !isPreviewableImageUrl(nextUrl)) {
    if (!options?.silent) {
      errorMessage.value = '请使用可公开访问的 http(s) 图片地址。'
    }
    return false
  }
  if (imageGenRefUrls.value.some((item) => normalizeImageUrl(item) === nextUrl)) {
    return false
  }
  if (imageGenRefTotalCount.value >= IMAGE_GEN_REF_MAX) {
    if (!options?.silent) {
      errorMessage.value = `参考图最多 ${IMAGE_GEN_REF_MAX} 张。`
    }
    return false
  }
  imageGenRefUrls.value = [...imageGenRefUrls.value, nextUrl]
  errorMessage.value = ''
  return true
}

const openImageGenRefPicker = () => imageGenRefInputRef.value?.click()

const handleImageGenRefUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length || generatingImage.value) return

  try {
    for (const file of files) {
      if (imageGenRefTotalCount.value >= IMAGE_GEN_REF_MAX) {
        errorMessage.value = `参考图最多 ${IMAGE_GEN_REF_MAX} 张。`
        break
      }
      const uploaded = await uploadAttachment(file, 'image')
      pushImageGenRef(String(uploaded?.fileUrl ?? ''))
    }
  } catch (error) {
    errorMessage.value = resolveError(error, '参考图上传失败。')
  }
}

/** 已有配图：只在图库勾选（边框反馈），不写入上方上传列表 */
const toggleImageGenRefFromExisting = (image: RouteStageNarrationImageResponse) => {
  if (!props.canEdit || generatingImage.value) return
  const url = normalizeImageUrl(String(image.imageUrl ?? ''))
  if (!url) {
    errorMessage.value = '该配图暂无可用地址，无法作为参考。'
    return
  }
  if (isImageGenRefSelected(url) && imageGenSelectedExistingUrls.value.some((item) => normalizeImageUrl(item) === url)) {
    imageGenSelectedExistingUrls.value = imageGenSelectedExistingUrls.value
      .filter((item) => normalizeImageUrl(item) !== url)
    return
  }
  // 已在上传列表中的同一 URL，不再重复勾选
  if (imageGenRefUrls.value.some((item) => normalizeImageUrl(item) === url)) {
    return
  }
  if (imageGenRefTotalCount.value >= IMAGE_GEN_REF_MAX) {
    errorMessage.value = `参考图最多 ${IMAGE_GEN_REF_MAX} 张。`
    return
  }
  imageGenSelectedExistingUrls.value = [...imageGenSelectedExistingUrls.value, url]
  errorMessage.value = ''
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

  const referenceImageUrls = [...imageGenRefUrls.value, ...imageGenSelectedExistingUrls.value]
    .map((item) => normalizeImageUrl(item))
    .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index)
    .slice(0, IMAGE_GEN_REF_MAX)

  const invalidRef = referenceImageUrls.find((url) => !isPreviewableImageUrl(url))
  if (invalidRef) {
    errorMessage.value = '参考图请使用可公开访问的 http(s) 链接。'
    return
  }

  generatingImage.value = true
  errorMessage.value = ''
  infoMessage.value = ''

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
    // 不轮询：提交后提示用户手动刷新配图列表
    infoMessage.value = PENDING_GEN_TIP
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
    if (isNarration.value && props.open) {
      void loadNarrationDetail()
      return
    }
    narrationDetail.value = null
    resetForm()
  },
  { immediate: true },
)

/** 改行列时同步网格槽位，保持与渲染盘面一致 */
watch(
  () => [form.gridRows, form.gridCols, isImagePuzzle.value] as const,
  () => {
    if (!isImagePuzzle.value) return
    ensurePuzzleGridSize()
  },
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

interface PuzzlePieceConfig {
  id: string
  key: string
  label: string
  hint: string | null
  image_url: string | null
  correct_row: number | null
  correct_col: number | null
}

/**
 * 碎片落库：列表顺序即正解（行优先），回写 correct_row / correct_col。
 * 每片必须自带 image_url（预裁切碎片图），不再用整张底图回退。
 */
const parsePiecesForSave = (cols: number): PuzzlePieceConfig[] => {
  const span = Math.max(1, cols)
  // 以当前列表顺序为准
  syncCorrectOrderFromPieces()

  return form.puzzlePieces
    .map((item, index): PuzzlePieceConfig | null => {
      const imageUrl = item.imageUrl.trim()
      if (!imageUrl) return null
      const id = item.id.trim() || createPieceId(index)
      const label = item.label.trim() || `碎片 ${index + 1}`
      return {
        id,
        // 后端 config 用 key 标识碎片，与 id 同值便于双向读取
        key: id,
        label,
        hint: item.hint.trim() || null,
        image_url: imageUrl,
        correct_row: Math.floor(index / span),
        correct_col: index % span,
      }
    })
    .filter((item): item is PuzzlePieceConfig => item !== null)
}

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
    // 同步 answer_extra，避免 C 端只读答案扩展时丢失选项/正解
    const prevExtra = parseStageConfig(
      config.answer_extra ?? config.answerExtra,
    ) as Record<string, unknown>
    config.answer_extra = {
      ...prevExtra,
      options,
      correct_option_id: correctId,
    }
    delete config.answerExtra
  } else if (isImagePuzzle.value) {
    ensurePuzzleGridSize()
    const rows = puzzleGridRows.value
    const cols = puzzleGridCols.value
    const pieces = parsePiecesForSave(cols)
    const correctOrder = pieces.map((item) => item.id)
    if (!form.prompt.trim()) {
      errorMessage.value = '请填写题干。'
      return null
    }
    if (form.puzzlePieces.some((item) => !item.imageUrl.trim())) {
      errorMessage.value = '请为网格中每一格上传碎片图片。'
      return null
    }
    if (pieces.length !== rows * cols || pieces.length < 2) {
      errorMessage.value = `请按 ${rows} × ${cols} 网格上传全部碎片（至少 2 格）。`
      return null
    }
    config.content = form.prompt.trim()
    // 底图可选：取首片图作兼容字段；游玩端以 pieces[].image_url 为准
    const firstPieceUrl = pieces[0]?.image_url ?? null
    config.base_image_url = form.imageUrl.trim() || firstPieceUrl
    config.image_url = form.imageUrl.trim() || firstPieceUrl
    config.grid_rows = rows
    config.grid_cols = cols
    delete config.grid_size
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
    // 不轮询：提交后提示用户手动刷新音频状态
    try {
      await refreshNarrationAudioMeta()
      emit('preview-refresh')
    } catch {
      // 状态刷新失败不阻断；仍提示手动刷新
    }
    if (audioStatus.value === NARRATION_AUDIO_STATUS.Completed) {
      infoMessage.value = ''
    } else if (audioStatus.value === NARRATION_AUDIO_STATUS.Failed) {
      errorMessage.value = '音频生成失败，请稍后重试。'
      infoMessage.value = ''
    } else if (audioStatus.value === NARRATION_AUDIO_STATUS.Stale) {
      infoMessage.value = '解说词已变更，请重新生成音频。'
    } else {
      infoMessage.value = PENDING_GEN_TIP
    }
  } catch (error) {
    errorMessage.value = resolveError(error, '音频生成任务提交失败。')
  } finally {
    generatingAudio.value = false
  }
}

const closeDialog = () => {
  if (saving.value || generatingAudio.value || imageBusy.value || generatingImage.value) return
  closeImageLightbox()
  isOpen.value = false
}

onBeforeUnmount(() => {
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

              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    网格尺寸
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ puzzleGridRows }} × {{ puzzleGridCols }} = {{ puzzleSlotCount }} 格
                  </p>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                  <label class="block space-y-1 text-xs text-muted-foreground">
                    行数
                    <Input
                      v-model="form.gridRows"
                      type="number"
                      min="1"
                      max="12"
                      :disabled="!props.canEdit || saving" />
                  </label>
                  <label class="block space-y-1 text-xs text-muted-foreground">
                    列数
                    <Input
                      v-model="form.gridCols"
                      type="number"
                      min="1"
                      max="12"
                      :disabled="!props.canEdit || saving" />
                  </label>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    拼图盘面
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    空格点击上传 · 拖动交换 · 悬停清除
                  </p>
                </div>
                <input
                  ref="pieceImageInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handlePieceImageUpload">
                <div
                  class="mx-auto gap-0.5 overflow-hidden rounded-lg border border-border/60 bg-black/40"
                  :style="puzzleGridStyle">
                  <div
                    v-for="(piece, index) in form.puzzlePieces"
                    :key="piece.id"
                    class="group relative min-h-0 min-w-0 touch-none select-none bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    :class="{
                      'cursor-grab': props.canEdit && Boolean(piece.imageUrl) && !saving && !mediaUploading,
                      'opacity-80 ring-1 ring-amber-300/50': pieceDragFrom === index,
                      'ring-1 ring-amber-300/60 bg-amber-500/10': pieceDragOver === index && pieceDragFrom !== null && pieceDragFrom !== index,
                      'bg-black/25': Boolean(piece.imageUrl),
                    }"
                    :data-puzzle-slot="index"
                    :style="piece.imageUrl
                      ? {
                        backgroundImage: `url(${JSON.stringify(piece.imageUrl)})`,
                        backgroundSize: '100% 100%',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }
                      : undefined"
                    @pointerdown="onPiecePointerDown(index, $event)"
                    @pointermove="onPiecePointerMove"
                    @pointerup="onPiecePointerUp"
                    @pointercancel="onPiecePointerCancel">
                    <span class="pointer-events-none absolute left-1 top-1 z-[1] rounded bg-black/55 px-1 py-px text-[10px] font-medium text-white/80">
                      {{ index + 1 }}
                    </span>

                    <button
                      v-if="!piece.imageUrl"
                      type="button"
                      data-piece-action="upload"
                      class="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-0.5 bg-white/[0.04] text-[11px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
                      :disabled="!props.canEdit || saving || mediaUploading"
                      @click="openPieceImagePicker(index)">
                      <span>{{ mediaUploading && pieceUploadIndex === index ? '上传中…' : '上传碎片' }}</span>
                    </button>

                    <div
                      v-if="piece.imageUrl && props.canEdit"
                      class="absolute inset-x-0 bottom-0 z-[2] flex justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent px-1 pb-1 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        data-piece-action="replace"
                        class="h-6 rounded border border-white/20 bg-black/50 px-1.5 text-[10px] text-white/90 hover:bg-black/70 disabled:opacity-40"
                        :disabled="saving || mediaUploading"
                        @click="openPieceImagePicker(index)">
                        换图
                      </button>
                      <button
                        type="button"
                        data-piece-action="clear"
                        class="h-6 rounded border border-white/20 bg-black/50 px-1.5 text-[10px] text-white/90 hover:bg-black/70 disabled:opacity-40"
                        :disabled="saving || mediaUploading"
                        @click="clearPieceImage(index)">
                        删除
                      </button>
                    </div>
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
                      <div class="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          type="button"
                          size="sm"
                          class="h-7 px-2 text-xs"
                          :disabled="!stageId || refreshingAudio || generatingAudio"
                          @click="handleRefreshAudio">
                          <AppIcon
                            name="refresh-cw"
                            class="mr-1 h-3.5 w-3.5"
                            :class="refreshingAudio ? 'animate-spin' : ''" />
                          刷新
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          size="sm"
                          class="h-7 shrink-0 px-2.5 text-xs"
                          :disabled="!canGenerateAudio"
                          @click="handleGenerateAudio">
                          {{ generatingAudio ? '提交中…' : '生成' }}
                        </Button>
                      </div>
                    </div>
                    <p
                      v-if="infoMessage === PENDING_GEN_TIP && !audioUrl"
                      class="text-xs text-sky-200/90">
                      {{ infoMessage }}
                    </p>
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
                  <div class="flex items-center gap-2">
                    <span class="form-label text-sm font-medium">配图</span>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      class="h-7 px-2 text-xs"
                      :disabled="!stageId || refreshingImages || generatingImage || imageBusy"
                      @click="handleRefreshNarrationImages">
                      <AppIcon
                        name="refresh-cw"
                        class="mr-1 h-3.5 w-3.5"
                        :class="refreshingImages ? 'animate-spin' : ''" />
                      刷新
                    </Button>
                  </div>
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
                      :disabled="!props.canEdit || generatingImage"
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
                    :disabled="!props.canEdit || saving || imageBusy || generatingImage || !stageId"
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
                      :disabled="!props.canEdit || saving || generatingImage"
                      maxlength="4000" />
                  </label>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">
                        参考图
                        <span class="font-normal text-muted-foreground">
                          {{ imageGenRefTotalCount }}/{{ IMAGE_GEN_REF_MAX }}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        class="h-8"
                        :disabled="!canGenerateImage"
                        @click="handleGenerateImages">
                        {{ generatingImage ? '提交中…' : '开始生成' }}
                      </Button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-8"
                        :disabled="!props.canEdit || saving || generatingImage || imageGenRefTotalCount >= IMAGE_GEN_REF_MAX"
                        @click="openImageGenRefPicker">
                        <AppIcon name="image-up" class="mr-1.5 h-3.5 w-3.5" />
                        上传参考图
                      </Button>
                      <input
                        ref="imageGenRefInput"
                        type="file"
                        accept="image/*"
                        multiple
                        class="hidden"
                        @change="handleImageGenRefUpload">
                      <span class="text-xs text-muted-foreground">
                        也可在下方已有配图中勾选
                      </span>
                    </div>
                    <div
                      v-if="imageGenRefUrls.length"
                      class="grid grid-cols-5 gap-2 sm:grid-cols-6">
                      <div
                        v-for="(refUrl, refIndex) in imageGenRefUrls"
                        :key="`ref-${refIndex}-${refUrl}`"
                        class="relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20">
                        <img :src="refUrl" alt="" class="h-full w-full object-cover">
                        <button
                          type="button"
                          class="absolute left-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white"
                          title="查看大图"
                          @click="openImageLightbox(refUrl)">
                          <AppIcon name="zoom-in" class="h-3 w-3" />
                        </button>
                        <button
                          v-if="props.canEdit"
                          type="button"
                          class="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white"
                          title="移除"
                          :disabled="generatingImage"
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
                    class="group relative aspect-square overflow-hidden rounded-md border bg-muted/20"
                    :class="imageSourceMode === 'generate' && isImageGenRefSelected(String(image.imageUrl ?? ''))
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-border/60'">
                    <button
                      v-if="imageSourceMode === 'generate' && image.imageUrl"
                      type="button"
                      class="absolute inset-0 block h-full w-full"
                      :disabled="!props.canEdit || generatingImage"
                      :title="isImageGenRefSelected(String(image.imageUrl)) ? '取消选择' : '选为参考'"
                      @click="toggleImageGenRefFromExisting(image)">
                      <img
                        :src="String(image.imageUrl)"
                        :alt="`配图 ${index + 1}`"
                        class="h-full w-full object-cover">
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
                      class="absolute right-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded bg-black/65 text-white opacity-90 transition-opacity hover:bg-black/80"
                      title="查看大图"
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
                        :disabled="imageBusy || generatingImage"
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
        <!-- 等待生成提示在音频/配图区块内展示；其它 info 放底部 -->
        <p
          v-else-if="infoMessage && infoMessage !== PENDING_GEN_TIP"
          class="shrink-0 text-sm text-muted-foreground">
          {{ infoMessage }}
        </p>
        <p
          v-else-if="infoMessage === PENDING_GEN_TIP && imageSourceMode === 'generate' && narrationImages.length === 0"
          class="shrink-0 text-sm text-sky-200/90">
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

  <!-- 配图大图预览：z 须高于 Dialog 栈 -->
  <Teleport to="body">
    <div
      v-if="imageLightboxUrl"
      data-image-lightbox
      class="fixed inset-0 flex items-center justify-center bg-black/85 p-4"
      :style="{ zIndex: IMAGE_LIGHTBOX_Z_INDEX }"
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