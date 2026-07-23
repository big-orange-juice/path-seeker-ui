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
const errorMessage = ref('')
const infoMessage = ref('')
const narrationDetail = ref<NarrationDetailResponse | null>(null)
let audioPollTimer: ReturnType<typeof setInterval> | null = null
let audioPollAttempts = 0
const AUDIO_POLL_INTERVAL_MS = 2500
const AUDIO_POLL_MAX_ATTEMPTS = 48
/** 解说配图本地列表；与 detail.images 同步，增删走 NarrationImage API */
const narrationImages = shallowRef<RouteStageNarrationImageResponse[]>([])
const imageInputRef = useTemplateRef<HTMLInputElement>('imageInput')
const baseConfig = ref<Record<string, unknown>>({})
const guideSelectOpen = ref(false)
const guidePending = ref(false)
const guides = ref<GuideRecord[]>([])
const form = reactive<StageFormState>({
  title: '', subtitle: '', prompt: '', optionsInput: '', correctOptionId: '', hintsInput: '',
  imageUrl: '', gridSize: '3', piecesInput: '', correctOrderInput: '', clueText: '', location: '', videoUrl: '',
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
const nodeTitle = computed(() => props.node?.title || '未命名节点')
const interactionTypeLabel = computed(
  () => getInteractionTypeMeta(interactionType.value)?.label || `类型 ${interactionType.value}`,
)
const headerDescription = computed(() => `${nodeTitle.value} · ${interactionTypeLabel.value}`)
const selectedGuideLabel = computed(() => form.guideName || (form.guideId ? '已选择导游' : '未选择导游'))
const canSave = computed(() => Boolean(
  props.canEdit && isSupported.value && stageId.value && props.routeId && !saving.value,
))
/** 解说节点编辑弹窗更宽，便于主编辑区排版 */
const dialogContentClass = computed(() =>
  isNarration.value
    ? 'flex h-[90vh] max-w-[min(96vw,1080px)] flex-col overflow-hidden p-0'
    : 'flex h-[90vh] max-w-[min(92vw,760px)] flex-col overflow-hidden p-0',
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
const audioStatusLabel = computed(() => {
  switch (audioStatus.value) {
    case NARRATION_AUDIO_STATUS.Queued:
      return '排队中'
    case NARRATION_AUDIO_STATUS.Generating:
      return '生成中'
    case NARRATION_AUDIO_STATUS.Completed:
      return audioDurationLabel.value ? `已生成 · ${audioDurationLabel.value}` : '已生成'
    case NARRATION_AUDIO_STATUS.Failed:
      return '生成失败'
    case NARRATION_AUDIO_STATUS.Stale:
      return '正文已变更，需重新生成'
    default:
      return '尚未生成'
  }
})
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
  syncNarrationImages(narrationDetail.value)
  errorMessage.value = ''
  infoMessage.value = ''
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
    infoMessage.value = '正文已变更，请重新生成音频。'
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
  if (!props.canEdit || imageBusy.value || saving.value) return
  imageInputRef.value?.click()
}

/** 当前列表中的附件 ID（有序），供 update-stage.attachmentIds 全量同步 */
const collectAttachmentIds = () =>
  narrationImages.value
    .map((item) => String(item.attachmentId ?? '').trim())
    .filter(Boolean)

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

/*
 * AI 生成配图（暂不开放）
 * 接口：POST /api/narration-image/generate
 * 异步任务，提交后需轮询或刷新 detail.images。
 *
 * const handleGenerateImages = async () => {
 *   await request('/api/narration-image/generate', {
 *     method: 'POST',
 *     body: {
 *       stageId: stageId.value,
 *       prompt: form.sceneContext || form.narrationText,
 *       idempotencyKey: `${stageId.value}-${Date.now()}`,
 *     },
 *   })
 *   // TODO: 轮询任务状态，完成后 loadNarrationDetail()
 * }
 */

watch(
  () => [props.open, stageId.value, props.node?.config, props.node?.title, props.node?.subtitle],
  () => {
    stopAudioPoll()
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
  if (saving.value || generatingAudio.value || imageBusy.value) return
  stopAudioPoll()
  isOpen.value = false
}

onBeforeUnmount(() => {
  stopAudioPoll()
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
      <!-- 统一头：标题 + 右上角关闭 -->
      <div class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5">
        <DialogHeader class="min-w-0 space-y-0.5 text-left">
          <DialogTitle class="truncate text-base">
            编辑节点
          </DialogTitle>
          <DialogDescription class="truncate text-xs">
            {{ headerDescription }}
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          title="关闭"
          class="shrink-0"
          :disabled="saving || generatingAudio || imageBusy"
          @click="closeDialog">
          <AppIcon name="x" class="h-4 w-4" />
        </Button>
      </div>

      <!-- 可滚动内容区：解说节点用 flex 列，主编辑区吃满高度 -->
      <div
        class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        :class="isNarration ? 'flex flex-col gap-3' : 'space-y-4'">
        <div
          v-if="!isSupported"
          class="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          此节点类型已不再支持编辑。
        </div>

        <template v-else>
          <!-- 基础信息（各类型共用） -->
          <section class="shrink-0 space-y-2">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="space-y-1 text-sm font-medium">
                节点名称
                <Input v-model="form.title" :disabled="!props.canEdit || saving" />
              </label>
              <label class="space-y-1 text-sm font-medium">
                节点副标题
                <Input v-model="form.subtitle" :disabled="!props.canEdit || saving" />
              </label>
            </div>
          </section>

          <template v-if="isObserveChoice">
            <section class="space-y-3 border-t border-border/50 pt-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                题目内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                题干
                <Textarea
                  v-model="form.prompt"
                  class="min-h-[88px]"
                  :disabled="!props.canEdit || saving" />
              </label>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5 text-sm font-medium">
                  选项（每行：标识 | 文案）
                  <Textarea
                    v-model="form.optionsInput"
                    class="min-h-[132px]"
                    :disabled="!props.canEdit || saving" />
                </label>
                <label class="space-y-1.5 text-sm font-medium">
                  正确项标识
                  <Input v-model="form.correctOptionId" :disabled="!props.canEdit || saving" />
                </label>
              </div>
            </section>
          </template>

          <template v-else-if="isImagePuzzle">
            <section class="space-y-3 border-t border-border/50 pt-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                拼图内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                题干
                <Textarea
                  v-model="form.prompt"
                  class="min-h-[88px]"
                  :disabled="!props.canEdit || saving" />
              </label>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5 text-sm font-medium">
                  拼图图片地址
                  <Input v-model="form.imageUrl" :disabled="!props.canEdit || saving" />
                </label>
                <label class="space-y-1.5 text-sm font-medium">
                  网格尺寸
                  <Input
                    v-model="form.gridSize"
                    type="number"
                    min="1"
                    max="12"
                    :disabled="!props.canEdit || saving" />
                </label>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5 text-sm font-medium">
                  碎片（每行：标识 | 文案 | 提示）
                  <Textarea
                    v-model="form.piecesInput"
                    class="min-h-[132px]"
                    :disabled="!props.canEdit || saving" />
                </label>
                <label class="space-y-1.5 text-sm font-medium">
                  正确顺序（每行一个碎片标识）
                  <Textarea
                    v-model="form.correctOrderInput"
                    class="min-h-[132px]"
                    :disabled="!props.canEdit || saving" />
                </label>
              </div>
            </section>
          </template>

          <template v-else-if="isFindScan">
            <section class="space-y-3 border-t border-border/50 pt-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                寻访内容
              </p>
              <label class="block space-y-1.5 text-sm font-medium">
                寻找线索
                <Textarea
                  v-model="form.clueText"
                  class="min-h-[112px]"
                  :disabled="!props.canEdit || saving" />
              </label>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5 text-sm font-medium">
                  目标位置
                  <Input v-model="form.location" :disabled="!props.canEdit || saving" />
                </label>
                <label class="space-y-1.5 text-sm font-medium">
                  观展短片地址
                  <Input v-model="form.videoUrl" :disabled="!props.canEdit || saving" />
                </label>
              </div>
            </section>
          </template>

          <!-- type 11：上排解说词+设置/音频；配图整行另起 -->
          <template v-else-if="isNarration">
            <div class="flex min-h-0 flex-1 flex-col gap-3">
              <div class="grid min-h-0 shrink-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
                <!-- 左：解说词主区 -->
                <section class="flex min-h-[260px] flex-col gap-2 lg:min-h-[360px]">
                  <div class="flex shrink-0 items-baseline justify-between gap-2">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      解说词
                    </p>
                    <p class="text-[11px] text-muted-foreground">
                      保存写入节点；生成音频会先同步正文
                    </p>
                  </div>
                  <Textarea
                    v-model="form.narrationText"
                    class="min-h-[240px] flex-1 resize-y text-[15px] leading-7 lg:min-h-[340px]"
                    placeholder="请输入或粘贴解说词正文…"
                    :disabled="!props.canEdit || saving" />
                </section>

                <!-- 右：设置 / 音频 -->
                <div class="flex min-h-0 flex-col gap-3">
                  <section class="space-y-2 rounded-lg border border-border/70 bg-background/25 p-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      讲解设置
                    </p>
                    <div class="flex items-center gap-2">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium">
                          {{ selectedGuideLabel }}
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                          讲解导游
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-8 shrink-0"
                        :disabled="!props.canEdit || saving"
                        @click="openGuideSelector">
                        选择
                      </Button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="space-y-1 text-xs font-medium">
                        风格
                        <Input
                          v-model="form.userStyleInput"
                          class="h-8"
                          placeholder="沉稳 / 科普"
                          :disabled="!props.canEdit || saving" />
                      </label>
                      <label class="space-y-1 text-xs font-medium">
                        时长(秒)
                        <Input
                          v-model="form.targetDurationSeconds"
                          class="h-8"
                          type="number"
                          min="10"
                          max="600"
                          :disabled="!props.canEdit || saving" />
                      </label>
                    </div>
                    <label class="block space-y-1 text-xs font-medium">
                      场景说明
                      <Textarea
                        v-model="form.sceneContext"
                        class="min-h-[64px] text-sm"
                        placeholder="展品/场景上下文（可选）"
                        :disabled="!props.canEdit || saving" />
                    </label>
                  </section>

                  <section class="space-y-2 rounded-lg border border-border/70 bg-background/25 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          解说音频
                        </p>
                        <p class="mt-0.5 truncate text-xs text-muted-foreground">
                          {{ audioStatusLabel }}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        class="h-8 shrink-0"
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
                    <p
                      v-else-if="!form.narrationText.trim()"
                      class="text-[11px] text-muted-foreground">
                      填写解说词后可生成音频
                    </p>
                    <p
                      v-else-if="audioPolling"
                      class="text-[11px] text-muted-foreground">
                      正在同步生成状态…
                    </p>
                  </section>
                </div>
              </div>

              <!-- 配图整行：多图时更好操作 -->
              <section class="shrink-0 space-y-2 rounded-lg border border-border/70 bg-background/25 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      解说配图
                    </p>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      支持多图；首张为封面，其余进入轮播
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    class="h-8 shrink-0"
                    :disabled="!props.canEdit || saving || imageBusy || !stageId"
                    @click="openImagePicker">
                    <AppIcon name="image-up" class="mr-1.5 h-3.5 w-3.5" />
                    {{ imageBusy ? '处理中…' : '上传图片' }}
                  </Button>
                </div>

                <input
                  ref="imageInput"
                  type="file"
                  accept="image/*"
                  multiple
                  class="hidden"
                  @change="handleImageFiles">

                <div
                  v-if="narrationImages.length"
                  class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  <div
                    v-for="(image, index) in narrationImages"
                    :key="String(image.id || image.attachmentId || image.imageUrl || index)"
                    class="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-[#0d0f12]">
                    <img
                      v-if="image.imageUrl"
                      :src="String(image.imageUrl)"
                      :alt="`配图 ${index + 1}`"
                      class="h-full w-full object-cover">
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center text-muted-foreground">
                      <AppIcon name="image-up" class="h-5 w-5" />
                    </div>
                    <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1">
                      <span class="truncate text-[10px] text-white/90">
                        {{ index === 0 ? '封面' : `图 ${index + 1}` }}
                      </span>
                      <button
                        v-if="props.canEdit"
                        type="button"
                        class="rounded px-1 text-[10px] text-white/90 hover:bg-white/15 disabled:opacity-40"
                        :disabled="imageBusy"
                        @click="removeNarrationImage(image)">
                        删除
                      </button>
                    </div>
                  </div>
                </div>
                <p v-else class="text-xs text-muted-foreground">
                  暂无配图，可点击上传
                </p>
              </section>
            </div>
          </template>

          <template v-if="!isNarration">
            <section class="space-y-3 border-t border-border/50 pt-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                提示
              </p>
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

      <!-- 固定高度 footer 贴底 -->
      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/70 px-5">
        <Button
          v-if="isNarration && props.canEdit"
          variant="outline"
          type="button"
          class="mr-auto h-8"
          :disabled="!canGenerateAudio"
          @click="handleGenerateAudio">
          {{ generatingAudio ? '提交中…' : audioPolling ? '同步中…' : '生成音频' }}
        </Button>
        <Button
          variant="outline"
          type="button"
          class="h-8"
          :disabled="saving || generatingAudio"
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
</template>