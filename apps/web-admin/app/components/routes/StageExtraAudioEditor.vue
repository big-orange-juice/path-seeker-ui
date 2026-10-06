<script setup lang="ts">
/**
 * 节点额外音频编辑器（讲解前 / 讲解后）。
 *
 * 设计依据：doc/b-admin-functional-optimization-plan.md §3（节点额外音频）。
 * - 入口与 `NarrationSegmentsEditor.vue` 的讲解分段并列，挂在 `StageEditDialog.vue` 玩法 11 分区内；
 * - 增删改与排序都是即时保存（不走弹窗底部「保存」），因此每条操作后重新拉取列表；
 * - 单条时长上限由后端 list 返回的 `maxDurationSeconds` 决定（默认 60 秒）。前端在上传前用本地
 *   元数据探测时长并提前拒绝，后端仍会强制校验，前端不是唯一防线；
 * - 「试听完整节点」严格按 `前置音频 → 讲解章节 → 后置音频` 构造队列，与 C 端队列顺序一致
 *   （讲解章节复用 `useTourPreviewPlayback`，额外音频是文件音频，任何语言都直接播放文件）。
 */
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { isTourLocale, type TourLocale } from '@path-seeker/ts-shared'
import Button from '@/components/shadcn/button/Button.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { useTourPreviewPlayback } from '@/composables/useTourPreviewPlayback'
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import { isConflictError } from '@/utils/api-error'
import type { NarrationDetailResponse } from '@/types/narration'
import type {
  ExtraAudioGroupResponse,
  ExtraAudioItem,
  ExtraAudioPosition,
  UpdateExtraAudioRequest,
} from '@/types/narration-extra-audio'
import type { RouteDetailResponse } from '@/types/route'

const props = withDefaults(defineProps<{
  stageId: string
  /** 当前节点所属路线；为空表示独立素材节点，此时不展示该区域 */
  routeId?: string
  locale?: string | null
  /** 讲解详情：用于「试听完整节点」拼接讲解章节 */
  narrationDetail?: NarrationDetailResponse | null
  canEdit?: boolean
  disabled?: boolean
}>(), {
  routeId: '',
  locale: 'zh',
  narrationDetail: null,
  canEdit: true,
  disabled: false,
})

const emit = defineEmits<{
  /** 上传等耗时操作进行中，供父级禁用「保存」 */
  busy: [value: boolean]
  /** 配置发生变化，父级可据此刷新预览 */
  changed: []
}>()

const { request } = useApiClient()
const { uploadAttachment } = useUploadAttachment()
const feedback = useActionFeedback()

const loading = shallowRef(false)
const busy = shallowRef(false)
const actionError = shallowRef('')
/** 并发冲突（后端 code=10005）：需要提示「配置已被他人修改，请刷新后重试」并提供刷新入口 */
const conflictMessage = shallowRef('')
const maxDurationSeconds = shallowRef(60)
const before = shallowRef<ExtraAudioItem[]>([])
const after = shallowRef<ExtraAudioItem[]>([])
/** 正在执行单条操作（启用、移动、删除）的记录 ID，用于按钮禁用 */
const pendingId = shallowRef('')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let uploadPosition: ExtraAudioPosition = 'before'
let uploadReplaceId = ''

const groups = computed(() => [
  { key: 'before' as ExtraAudioPosition, label: '讲解前', hint: '在整段讲解之前播放', items: before.value },
  { key: 'after' as ExtraAudioPosition, label: '讲解后', hint: '在整段讲解结束之后播放', items: after.value },
])

const totalCount = computed(() => before.value.length + after.value.length)
const enabledCount = computed(() => [...before.value, ...after.value].filter(item => item.enabled === 1).length)

const previewItems = (position: ExtraAudioPosition) =>
  (position === 'before' ? before.value : after.value).filter(item => item.enabled === 1 && Boolean(item.audioUrl))

/** 讲解章节：与 OutdoorRoutePreview 保持同一取数口径 */
const narrationChunks = computed<{ text: string; audioUrl: string | null }[]>(() => {
  const detail = props.narrationDetail
  if (detail?.segments?.length) return detail.segments.map(segment => ({ text: segment.text || '', audioUrl: segment.audioUrl }))
  return [{ text: detail?.narrationText || '', audioUrl: detail?.audioUrl || null }]
})

const previewLocale = computed<TourLocale>(() => {
  // 先取局部变量再交给类型守卫：直接对 props.locale 连续读取不会被收窄
  const value = props.locale
  return isTourLocale(value) ? value : 'zh'
})

/* ------------------------------------------------------------------ 列表加载 */

async function load() {
  const stageId = props.stageId?.trim()
  if (!stageId) return
  loading.value = true
  actionError.value = ''
  try {
    const result = await request<ExtraAudioGroupResponse>('/api/narration-extra-audio/list', { query: { stageId } })
    before.value = result?.before ?? []
    after.value = result?.after ?? []
    maxDurationSeconds.value = Number(result?.maxDurationSeconds) > 0 ? Number(result.maxDurationSeconds) : 60
    conflictMessage.value = ''
  } catch (caught) {
    if (!handleConflict(caught)) actionError.value = resolveApiErrorMessage(caught, '额外音频加载失败。')
  } finally {
    loading.value = false
  }
}

/**
 * 冲突统一处理：返回 true 表示已按冲突提示处理，调用方不再展示普通错误。
 * 不自动刷新，避免把用户正在编辑的内容直接冲掉。
 */
function handleConflict(caught: unknown): boolean {
  if (!isConflictError(caught)) return false
  conflictMessage.value = '配置已被他人修改，请刷新后重试'
  return true
}

async function run<T>(id: string, task: () => Promise<T>, fallback: string): Promise<T | null> {
  pendingId.value = id
  actionError.value = ''
  try {
    const result = await task()
    await load()
    emit('changed')
    return result
  } catch (caught) {
    if (!handleConflict(caught)) actionError.value = resolveApiErrorMessage(caught, fallback)
    return null
  } finally {
    pendingId.value = ''
  }
}

/* ------------------------------------------------------------------ 上传与替换 */

function pickFile(position: ExtraAudioPosition, replaceId = '') {
  if (!props.canEdit || props.disabled || busy.value || pendingId.value) return
  uploadPosition = position
  uploadReplaceId = replaceId
  actionError.value = ''
  const input = fileInput.value
  if (!input) return
  input.accept = 'audio/*'
  input.value = ''
  input.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  emit('busy', true)
  actionError.value = ''
  try {
    if (file.type && !file.type.startsWith('audio/')) throw new Error('请选择音频文件（audio/*）。')
    // 本地元数据预检：超过上限直接拒绝，不必等后端校验（也避免产生脏附件）
    const durationSeconds = await probeDurationSeconds(file)
    if (durationSeconds != null && durationSeconds > maxDurationSeconds.value) {
      throw new Error(`单条额外音频不能超过 ${maxDurationSeconds.value} 秒，当前约 ${Math.round(durationSeconds)} 秒，请先裁剪后再上传。`)
    }

    const attachment = await uploadAttachment(file, 'file')
    const attachmentId = String(attachment?.fileId || '').trim()
    if (!attachmentId) throw new Error('附件上传失败。')

    const replaceId = uploadReplaceId
    if (replaceId) {
      await request('/api/narration-extra-audio/update', {
        method: 'POST',
        body: { id: replaceId, attachmentId } satisfies UpdateExtraAudioRequest,
      })
    } else {
      await request('/api/narration-extra-audio/create', {
        method: 'POST',
        body: { stageId: props.stageId, attachmentId, position: uploadPosition },
      })
    }
    await load()
    emit('changed')
    feedback.success(replaceId ? '音频已替换。' : '额外音频已添加。')
  } catch (caught) {
    if (!handleConflict(caught)) actionError.value = resolveApiErrorMessage(caught, '音频上传失败。')
  } finally {
    busy.value = false
    emit('busy', false)
    input.value = ''
    uploadReplaceId = ''
  }
}

/** 读取本地文件时长（秒）；无法读取时返回 null，由后端时长校验兜底 */
function probeDurationSeconds(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 8000)
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null)
    audio.onerror = () => finish(null)
    audio.preload = 'metadata'
    audio.src = url
  })
}

/* ------------------------------------------------------------------ 单条操作 */

/** 名称输入框失焦/回车时提交（空值需要 titleSpecified 才能清空） */
function onTitleChange(item: ExtraAudioItem, event: Event) {
  void saveTitle(item, (event.target as HTMLInputElement | null)?.value ?? '')
}

async function saveTitle(item: ExtraAudioItem, value: string) {
  if (!props.canEdit || props.disabled || pendingId.value) return
  const next = value.trim()
  if ((item.title || '') === next) return
  // titleSpecified 必须为 true，否则后端把空标题当作「不修改」
  await run(item.id, () => request('/api/narration-extra-audio/update', {
    method: 'POST',
    body: { id: item.id, title: next || null, titleSpecified: true, version: item.version } satisfies UpdateExtraAudioRequest,
  }), '名称保存失败。')
}

async function toggleEnabled(item: ExtraAudioItem) {
  if (!props.canEdit || props.disabled || pendingId.value) return
  const next = item.enabled === 1 ? 0 : 1
  await run(item.id, () => request('/api/narration-extra-audio/enabled', {
    method: 'POST',
    body: { id: item.id, enabled: next, version: item.version },
  }), next === 1 ? '启用失败。' : '停用失败。')
}

async function removeItem(item: ExtraAudioItem) {
  if (!props.canEdit || props.disabled || pendingId.value) return
  if (!window.confirm(`确认删除「${item.title || '未命名音频'}」？`)) return
  await run(item.id, () => request('/api/narration-extra-audio/delete', { method: 'POST', body: { id: item.id } }), '删除失败。')
}

async function moveItem(position: ExtraAudioPosition, index: number, delta: number) {
  if (!props.canEdit || props.disabled || pendingId.value) return
  const items = position === 'before' ? before.value : after.value
  const target = index + delta
  if (target < 0 || target >= items.length) return
  const next = [...items]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(target, 0, moved)
  // 以「重排后的完整顺序」提交，sortOrder 使用 0 基下标，避免出现并列值
  await run(moved.id, () => request('/api/narration-extra-audio/reorder', {
    method: 'POST',
    body: { stageId: props.stageId, position, items: next.map((item, order) => ({ id: item.id, sortOrder: order })) },
  }), '排序保存失败。')
}

const rowStatus = (item: ExtraAudioItem) => {
  if (item.enabled !== 1) return '已停用'
  if (!item.audioUrl) return '处理中'
  if (item.durationSeconds == null) return '时长待确认'
  if (item.durationSeconds > maxDurationSeconds.value) return '超出时长上限'
  return '已上传'
}

const rowStatusClass = (item: ExtraAudioItem) => {
  if (item.enabled !== 1) return 'text-muted-foreground'
  if (item.durationSeconds != null && item.durationSeconds > maxDurationSeconds.value) return 'text-destructive'
  if (!item.audioUrl || item.durationSeconds == null) return 'text-amber-300/90'
  return 'text-muted-foreground'
}

/* ------------------------------------------------------------------ 试听完整节点 */

type PreviewPhase = 'idle' | 'before' | 'narration' | 'after'

const previewPhase = shallowRef<PreviewPhase>('idle')
const previewPlaying = shallowRef(false)
const previewError = shallowRef('')
/** 单条加载失败时提示并跳过，不打断整个队列 */
const previewSkipped = shallowRef('')
let previewAudio: HTMLAudioElement | null = null
let previewGeneration = 0

const narrationPlayback = useTourPreviewPlayback(() => {
  // 讲解章节自然播完（或最后一段结束时）后继续后置音频
  if (!previewPlaying.value || previewPhase.value !== 'narration') return
  startAfterPhase(previewGeneration)
})

const phaseLabel = computed(() => {
  if (previewPhase.value === 'before') return '正在播放：讲解前音频'
  if (previewPhase.value === 'narration') return '正在播放：讲解章节'
  if (previewPhase.value === 'after') return '正在播放：讲解后音频'
  return ''
})

function releasePreviewAudio() {
  if (!previewAudio) return
  previewAudio.onended = null
  previewAudio.onerror = null
  previewAudio.pause()
  previewAudio.removeAttribute('src')
  previewAudio.load()
  previewAudio = null
}

function startFullPreview() {
  stopPreview()
  const hasContent = previewItems('before').length || previewItems('after').length || narrationChunks.value.some(chunk => chunk.text || chunk.audioUrl)
  if (!hasContent) {
    previewError.value = '当前节点还没有可试听的内容。'
    return
  }
  previewError.value = ''
  previewSkipped.value = ''
  previewGeneration += 1
  previewPlaying.value = true
  startBeforePhase(previewGeneration)
}

function playPreviewItem(item: ExtraAudioItem, token: number, onDone: () => void) {
  const url = item.audioUrl
  if (!url) { onDone(); return }
  releasePreviewAudio()
  const audio = new Audio(url)
  previewAudio = audio
  audio.onended = () => { if (token === previewGeneration) onDone() }
  audio.onerror = () => {
    if (token !== previewGeneration) return
    previewSkipped.value = `「${item.title || '未命名音频'}」加载失败，已跳过。`
    onDone()
  }
  void audio.play().catch(() => {
    if (token !== previewGeneration) return
    stopPreview()
    previewError.value = '浏览器阻止了自动播放，请再次点击「试听完整节点」。'
  })
}

function startBeforePhase(token: number) {
  if (token !== previewGeneration) return
  previewPhase.value = 'before'
  playBeforeAt(token, 0)
}

function playBeforeAt(token: number, index: number) {
  if (token !== previewGeneration) return
  const items = previewItems('before')
  const item = items[index]
  if (!item) { startNarrationPhase(token); return }
  playPreviewItem(item, token, () => playBeforeAt(token, index + 1))
}

function startNarrationPhase(token: number) {
  if (token !== previewGeneration) return
  const chunks = narrationChunks.value.filter(chunk => chunk.text || chunk.audioUrl)
  if (!chunks.length) { startAfterPhase(token); return }
  previewPhase.value = 'narration'
  narrationPlayback.play(chunks, previewLocale.value)
}

function startAfterPhase(token: number) {
  if (token !== previewGeneration) return
  previewPhase.value = 'after'
  playAfterAt(token, 0)
}

function playAfterAt(token: number, index: number) {
  if (token !== previewGeneration) return
  const items = previewItems('after')
  const item = items[index]
  if (!item) { finishPreview(); return }
  playPreviewItem(item, token, () => playAfterAt(token, index + 1))
}

function finishPreview() {
  releasePreviewAudio()
  previewPlaying.value = false
  previewPhase.value = 'idle'
}

function stopPreview() {
  previewGeneration += 1
  releasePreviewAudio()
  narrationPlayback.stop()
  previewPlaying.value = false
  previewPhase.value = 'idle'
}

/* ------------------------------------------------------------------ 复制到其他节点 */

const copyOpen = shallowRef(false)
const copyTargetId = shallowRef('')
const copyReplace = shallowRef(false)
const copyPending = shallowRef(false)
const copyError = shallowRef('')
const copyNotice = shallowRef('')
const copyOptions = shallowRef<{ value: string; label: string }[]>([])
const copyOptionsLoading = shallowRef(false)

async function openCopyPanel() {
  copyOpen.value = !copyOpen.value
  copyError.value = ''
  copyNotice.value = ''
  if (!copyOpen.value || copyOptions.value.length || copyOptionsLoading.value) return
  if (!props.routeId) return
  copyOptionsLoading.value = true
  try {
    const detail = await request<RouteDetailResponse | null>('/api/route/detail', { query: { id: props.routeId } })
    copyOptions.value = (detail?.nodes ?? [])
      .filter(node => node.stageId && String(node.stageId) !== props.stageId)
      .map((node, index) => ({
        value: String(node.stageId),
        label: `${node.stageNo || index + 1}. ${node.title || '未命名站点'}`,
      }))
  } catch (caught) {
    copyError.value = resolveApiErrorMessage(caught, '同路线节点列表加载失败。')
  } finally {
    copyOptionsLoading.value = false
  }
}

async function submitCopy() {
  const target = copyTargetId.value.trim()
  if (!target) { copyError.value = '请选择或填写目标节点 ID。'; return }
  if (target === props.stageId) { copyError.value = '目标节点不能与当前节点相同。'; return }
  copyPending.value = true
  copyError.value = ''
  copyNotice.value = ''
  try {
    const copied = await request<number>('/api/narration-extra-audio/copy', {
      method: 'POST',
      body: { sourceStageId: props.stageId, targetStageId: target, replace: copyReplace.value },
    })
    copyNotice.value = `已复制 ${Number(copied) || 0} 条配置到目标节点。`
    feedback.success(`已复制 ${Number(copied) || 0} 条额外音频配置。`)
  } catch (caught) {
    copyError.value = resolveApiErrorMessage(caught, '复制失败。')
  } finally {
    copyPending.value = false
  }
}

/* ------------------------------------------------------------------ 生命周期 */

watch(() => props.stageId, () => { stopPreview(); void load() }, { immediate: true })
watch(() => props.narrationDetail, () => {
  // 讲解内容变化时，正在进行的完整试听队列已失真，直接停止
  if (previewPhase.value === 'narration') stopPreview()
})
onBeforeUnmount(() => {
  stopPreview()
  releasePreviewAudio()
})

defineExpose({ refresh: load })
</script>

<template>
  <section class="space-y-3 border-t border-border/60 pt-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-sm font-medium">额外音频</h3>
        <p class="text-xs text-muted-foreground">
          讲解前与讲解后的文件音频，按组内顺序播放；单条不超过 {{ maxDurationSeconds }} 秒。无需填写解说词，也不参与 TTS 生成。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">{{ totalCount }} 条 · {{ enabledCount }} 条启用</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :disabled="!previewPlaying && !before.length && !after.length && !narrationChunks.some(chunk => chunk.text || chunk.audioUrl)"
          @click="previewPlaying ? stopPreview() : startFullPreview()">
          {{ previewPlaying ? '停止试听' : '试听完整节点' }}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :disabled="!props.canEdit || props.disabled || busy || !totalCount"
          @click="openCopyPanel">
          {{ copyOpen ? '收起复制' : '复制到其他节点' }}
        </Button>
        <Button type="button" size="sm" variant="ghost" :disabled="loading" @click="load">
          {{ loading ? '刷新中…' : '刷新' }}
        </Button>
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      试听顺序：讲解前音频 → 讲解章节 → 讲解后音频，与 C 端播放队列一致。
      <span v-if="phaseLabel" class="text-primary">{{ phaseLabel }}</span>
    </p>

    <!-- 并发冲突：给出明确的刷新引导，不静默失败 -->
    <div
      v-if="conflictMessage"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      <span>{{ conflictMessage }}</span>
      <Button type="button" size="sm" variant="outline" :disabled="loading" @click="load">刷新</Button>
    </div>

    <div v-if="copyOpen" class="space-y-2 rounded-lg border border-border/70 bg-secondary/10 p-3">
      <p class="text-xs text-muted-foreground">
        复制只复用同一附件，不会生成目标语言的语音；<strong>语音类音频需要人工核对目标语言适用性</strong>。
      </p>
      <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label class="grid gap-1 text-xs">
          <span class="text-muted-foreground">同路线目标节点{{ copyOptionsLoading ? '（加载中…）' : '' }}</span>
          <Select v-model="copyTargetId" :disabled="copyPending" placeholder="选择同路线的其他节点">
            <option value="">不选择</option>
            <option v-for="option in copyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </Select>
        </label>
        <label class="grid gap-1 text-xs">
          <span class="text-muted-foreground">其他语言版本 / 跨路线：手工填写目标节点 ID</span>
          <Input v-model="copyTargetId" :disabled="copyPending" placeholder="目标节点 ID（stageId）" />
        </label>
        <div class="flex items-end gap-2">
          <label class="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
            <input v-model="copyReplace" type="checkbox" :disabled="copyPending">
            覆盖目标已有配置
          </label>
          <Button type="button" size="sm" :disabled="copyPending || !props.canEdit || props.disabled" @click="submitCopy">
            {{ copyPending ? '复制中…' : '执行复制' }}
          </Button>
        </div>
      </div>
      <p v-if="copyError" class="text-xs text-destructive">{{ copyError }}</p>
      <p v-else-if="copyNotice" class="text-xs text-emerald-300/90">{{ copyNotice }}</p>
    </div>

    <p v-if="actionError" role="alert" class="text-xs text-destructive">{{ actionError }}</p>
    <p v-if="previewError" role="alert" class="text-xs text-destructive">{{ previewError }}</p>
    <p v-else-if="previewSkipped" class="text-xs text-amber-300/90">{{ previewSkipped }}</p>

    <div v-if="loading && !totalCount" class="text-xs text-muted-foreground">正在加载额外音频…</div>

    <div v-for="group in groups" :key="group.key" class="space-y-2 rounded-lg border border-border/70 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <strong class="text-xs">{{ group.label }}</strong>
          <span class="ml-2 text-xs text-muted-foreground">{{ group.hint }} · {{ group.items.length }} 条</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :disabled="!props.canEdit || props.disabled || busy || pendingId !== ''"
          @click="pickFile(group.key)">
          {{ busy && uploadPosition === group.key && !uploadReplaceId ? '上传中…' : `上传${group.label}音频` }}
        </Button>
      </div>

      <p v-if="!group.items.length" class="text-xs text-muted-foreground">
        暂无{{ group.label }}音频。{{ group.key === 'before' ? '讲解开始前' : '讲解结束后' }}会按这里的顺序播放。
      </p>

      <div v-for="(item, index) in group.items" :key="item.id" class="space-y-2 rounded-md border border-border/60 bg-background/40 p-2.5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="w-6 shrink-0 text-center text-xs text-muted-foreground">{{ index + 1 }}</span>
          <Input
            :model-value="item.title || ''"
            class="min-w-0 flex-1"
            placeholder="显示名称（可留空）"
            :disabled="!props.canEdit || props.disabled || pendingId !== ''"
            @update:model-value="item.title = $event"
            @change="onTitleChange(item, $event)" />
          <span class="shrink-0 text-xs" :class="rowStatusClass(item)">{{ rowStatus(item) }}</span>
          <span class="shrink-0 text-xs text-muted-foreground">
            {{ item.durationSeconds == null ? '时长待确认' : `${item.durationSeconds} 秒` }}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <audio
            v-if="item.audioUrl"
            :src="item.audioUrl"
            controls
            preload="none"
            class="h-8 max-w-full"
            @play="stopPreview()" />
          <span v-else class="text-xs text-muted-foreground">音频处理中，暂无可播放地址</span>
          <Button type="button" size="sm" variant="outline" :disabled="!props.canEdit || props.disabled || busy || pendingId !== ''" @click="pickFile(group.key, item.id)">
            替换
          </Button>
          <Button type="button" size="sm" variant="ghost" :disabled="!props.canEdit || props.disabled || pendingId !== ''" @click="moveItem(group.key, index, -1)" :class="index === 0 ? 'invisible' : ''">
            上移
          </Button>
          <Button type="button" size="sm" variant="ghost" :disabled="!props.canEdit || props.disabled || pendingId !== ''" @click="moveItem(group.key, index, 1)" :class="index === group.items.length - 1 ? 'invisible' : ''">
            下移
          </Button>
          <Button type="button" size="sm" variant="ghost" :disabled="!props.canEdit || props.disabled || pendingId !== ''" @click="toggleEnabled(item)">
            {{ item.enabled === 1 ? '停用' : '启用' }}
          </Button>
          <Button type="button" size="sm" variant="ghost" :disabled="!props.canEdit || props.disabled || pendingId !== ''" @click="removeItem(item)">
            删除
          </Button>
        </div>

        <p v-if="item.durationSeconds != null && item.durationSeconds > maxDurationSeconds" class="text-xs text-destructive">
          该音频约 {{ item.durationSeconds }} 秒，已超过单条 {{ maxDurationSeconds }} 秒上限，请裁剪后重新上传。
        </p>
        <p v-else-if="item.durationSeconds == null" class="text-xs text-amber-300/90">
          附件缺少时长信息，无法提前校验上限；保存时后端会再校验一次。
        </p>
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      额外音频允许没有正文，但节点仍需有讲解正文才能发布；语言转换时只复制附件关联，语音类音频请在目标语言下人工核对。
    </p>

    <input ref="fileInput" type="file" class="hidden" @change="handleFileChange">
  </section>
</template>
