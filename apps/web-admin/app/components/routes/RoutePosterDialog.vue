<script setup lang="ts">
/**
 * 路线海报管理：从节点图库选参考图 / 贴外链，提交 AI 生成，轮询列表同步。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  isNarrationStage,
  parseStageConfig,
} from '@path-seeker/game-renderer'
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
import type {
  GenerateRoutePosterResponse,
  RoutePosterCandidateImage,
  RoutePosterResponse,
} from '@/types/poster'
import type { NarrationDetailResponse } from '@/types/narration'
import type { RouteDetailResponse, RouteRecord } from '@/types/route'

interface Props {
  open: boolean
  record: RouteRecord | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { request } = useApiClient()

const REF_MAX = 5
const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 48

const bootstrapping = ref(false)
const loadingNodeImages = ref(false)
const generating = ref(false)
const polling = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const prompt = ref('')
const refDraft = ref('')
const refUrls = ref<string[]>([])
/** 是否启用节点可用图：默认关闭，勾选后再拉取当前路线 nodes 图片 */
const useNodeImages = ref(false)
const candidates = ref<RoutePosterCandidateImage[]>([])
const posters = ref<RoutePosterResponse[]>([])
const lightboxUrl = ref('')
/** 缓存详情，避免反复勾选时重复请求路线详情 */
const cachedDetail = ref<RouteDetailResponse | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollAttempts = 0
let lightboxEscHandler: ((event: KeyboardEvent) => void) | null = null

const routeId = computed(() => String(props.record?.id ?? '').trim())
const routeTitle = computed(
  () => props.record?.title || props.record?.routeCode || routeId.value || '路线',
)

const canGenerate = computed(
  () => Boolean(routeId.value)
    && Boolean(prompt.value.trim())
    && !bootstrapping.value
    && !generating.value
    && !polling.value,
)

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

const normalizeUrl = (value: string) => value.trim()

const resolveError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.statusMessage === 'string' && record.statusMessage) return record.statusMessage
    if (typeof record.message === 'string' && record.message) return record.message
  }
  return fallback
}

const isRefSelected = (url: string) => {
  const target = normalizeUrl(url)
  if (!target) return false
  return refUrls.value.some((item) => normalizeUrl(item) === target)
}

const pushRef = (url: string, options?: { silent?: boolean }) => {
  const nextUrl = normalizeUrl(url)
  if (!nextUrl || !isPreviewableImageUrl(nextUrl)) {
    if (!options?.silent) {
      errorMessage.value = '请使用可公开访问的图片地址。'
    }
    return false
  }
  if (isRefSelected(nextUrl)) return false
  if (refUrls.value.length >= REF_MAX) {
    if (!options?.silent) {
      errorMessage.value = `参考图最多 ${REF_MAX} 张。`
    }
    return false
  }
  refUrls.value = [...refUrls.value, nextUrl]
  errorMessage.value = ''
  return true
}

const addRefFromDraft = () => {
  if (generating.value || polling.value) return
  if (pushRef(refDraft.value)) {
    refDraft.value = ''
  }
}

const addRefFromCandidate = (item: RoutePosterCandidateImage) => {
  if (generating.value || polling.value) return
  pushRef(item.url, { silent: true })
}

const removeRef = (index: number) => {
  refUrls.value = refUrls.value.filter((_, i) => i !== index)
}

const collectPosterIds = () =>
  posters.value
    .map((item) => String(item.id ?? item.attachmentId ?? item.imageUrl ?? '').trim())
    .filter(Boolean)

const readConfigText = (config: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/** 从详情节点 config / 封面提取静态候选图 */
const collectStaticCandidates = (detail: RouteDetailResponse | null): RoutePosterCandidateImage[] => {
  const list: RoutePosterCandidateImage[] = []
  const seen = new Set<string>()

  const push = (
    url: string,
    label: string,
    source: RoutePosterCandidateImage['source'],
    stageId?: string | null,
  ) => {
    const next = normalizeUrl(url)
    if (!next || seen.has(next)) return
    if (!isPreviewableImageUrl(next)) return
    seen.add(next)
    list.push({ url: next, label, source, stageId: stageId || null })
  }

  const cover = String(detail?.route?.coverImageUrl ?? props.record?.coverImageUrl ?? '').trim()
  if (cover) {
    push(cover, '路线封面', 'cover')
  }

  const nodes = detail?.nodes ?? []
  nodes.forEach((node, index) => {
    const stageNo = node.stageNo || node.sortOrder || index + 1
    const title = String(node.title || `第 ${stageNo} 站`).trim()
    const stageId = String(node.stageId ?? '').trim() || null
    const config = parseStageConfig(node.config) as Record<string, unknown>
    const imageUrl = readConfigText(config, 'image_url', 'imageUrl', 'cover_image_url', 'coverImageUrl')
    if (imageUrl) {
      push(imageUrl, `${title} · 节点图`, 'node', stageId)
    }
  })

  return list
}

/** 解说节点配图异步补齐 */
const collectNarrationCandidates = async (
  detail: RouteDetailResponse | null,
): Promise<RoutePosterCandidateImage[]> => {
  const nodes = (detail?.nodes ?? []).filter((node) => isNarrationStage(node.interactionType))
  if (!nodes.length) return []

  const results = await Promise.allSettled(
    nodes.map(async (node) => {
      const stageId = String(node.stageId ?? '').trim()
      if (!stageId) return [] as RoutePosterCandidateImage[]
      const stageNo = node.stageNo || node.sortOrder || 0
      const title = String(node.title || `第 ${stageNo} 站`).trim()
      const detailRes = await request<NarrationDetailResponse | null>('/api/narration/detail', {
        method: 'GET',
        query: { stageId },
      })
      const images = detailRes?.images ?? []
      return images
        .map((image, imageIndex) => {
          const url = String(image.imageUrl ?? '').trim()
          if (!url || !isPreviewableImageUrl(url)) return null
          return {
            url,
            label: `${title} · 配图 ${imageIndex + 1}`,
            source: 'narration' as const,
            stageId,
          }
        })
        .filter((item): item is RoutePosterCandidateImage => Boolean(item))
    }),
  )

  const list: RoutePosterCandidateImage[] = []
  const seen = new Set<string>()
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return
    result.value.forEach((item) => {
      if (seen.has(item.url)) return
      seen.add(item.url)
      list.push(item)
    })
  })
  return list
}

const loadPosters = async () => {
  if (!routeId.value) {
    posters.value = []
    return
  }
  const list = await request<RoutePosterResponse[]>('/api/poster/list', {
    method: 'GET',
    query: { routeId: routeId.value },
  })
  posters.value = Array.isArray(list) ? list : []
}

const stopPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  pollAttempts = 0
  polling.value = false
}

const startPoll = (baselineIds: Set<string>) => {
  stopPoll()
  polling.value = true
  pollAttempts = 0
  infoMessage.value = '海报生成中，完成后将自动加入列表…'

  const tick = async () => {
    pollAttempts += 1
    try {
      await loadPosters()
    } catch {
      // 轮询失败不中断，继续尝试
    }

    const hasNew = collectPosterIds().some((id) => !baselineIds.has(id))
    if (hasNew) {
      infoMessage.value = '海报已生成并加入列表。'
      errorMessage.value = ''
      stopPoll()
      return
    }

    if (pollAttempts >= POLL_MAX_ATTEMPTS) {
      infoMessage.value = '海报仍在生成，可稍后重新打开查看。'
      stopPoll()
    }
  }

  void tick()
  pollTimer = setInterval(() => {
    void tick()
  }, POLL_INTERVAL_MS)
}

/** 打开弹窗时只拉已生成海报；节点图按勾选再取 */
const bootstrap = async () => {
  if (!routeId.value) return

  bootstrapping.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  useNodeImages.value = false
  candidates.value = []
  cachedDetail.value = null
  stopPoll()

  try {
    await loadPosters()
  } catch (error) {
    errorMessage.value = resolveError(error, '加载海报列表失败。')
    posters.value = []
  } finally {
    bootstrapping.value = false
  }
}

/** 勾选启用后：拉取当前路线所有 nodes 图片（含封面、节点图、解说配图） */
const loadNodeCandidates = async () => {
  if (!routeId.value) {
    candidates.value = []
    return
  }

  loadingNodeImages.value = true
  errorMessage.value = ''

  try {
    let detail = cachedDetail.value
    if (!detail) {
      detail = await request<RouteDetailResponse | null>('/api/route/detail', {
        method: 'GET',
        query: { id: routeId.value },
      })
      cachedDetail.value = detail
    }

    const staticCandidates = collectStaticCandidates(detail)
    let narrationCandidates: RoutePosterCandidateImage[] = []
    try {
      narrationCandidates = await collectNarrationCandidates(detail)
    } catch {
      // 解说配图失败不影响主流程
    }

    const merged: RoutePosterCandidateImage[] = []
    const seen = new Set<string>()
    ;[...staticCandidates, ...narrationCandidates].forEach((item) => {
      if (seen.has(item.url)) return
      seen.add(item.url)
      merged.push(item)
    })
    candidates.value = merged
  } catch (error) {
    errorMessage.value = resolveError(error, '加载节点图片失败。')
    candidates.value = []
  } finally {
    loadingNodeImages.value = false
  }
}

const onUseNodeImagesChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false
  useNodeImages.value = checked
  if (!checked) {
    candidates.value = []
    return
  }
  void loadNodeCandidates()
}

const handleGenerate = async () => {
  if (!canGenerate.value || !routeId.value) return

  const nextPrompt = prompt.value.trim()
  if (!nextPrompt) {
    errorMessage.value = '请填写画面描述。'
    return
  }

  const referenceImageUrls = refUrls.value.map((item) => normalizeUrl(item)).filter(Boolean)
  const invalidRef = referenceImageUrls.find((url) => !isPreviewableImageUrl(url))
  if (invalidRef) {
    errorMessage.value = '参考图请使用可公开访问的链接。'
    return
  }

  generating.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  const baseline = new Set(collectPosterIds())

  try {
    await request<GenerateRoutePosterResponse | null>('/api/poster/generate', {
      method: 'POST',
      body: {
        routeId: routeId.value,
        prompt: nextPrompt,
        ...(referenceImageUrls.length ? { referenceImageUrls } : {}),
      },
    })
    startPoll(baseline)
  } catch (error) {
    errorMessage.value = resolveError(error, '海报生成提交失败。')
  } finally {
    generating.value = false
  }
}

const bindLightboxEsc = () => {
  if (lightboxEscHandler || typeof window === 'undefined') return
  lightboxEscHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !lightboxUrl.value) return
    event.preventDefault()
    event.stopPropagation()
    closeLightbox()
  }
  window.addEventListener('keydown', lightboxEscHandler, true)
}

const unbindLightboxEsc = () => {
  if (!lightboxEscHandler || typeof window === 'undefined') return
  window.removeEventListener('keydown', lightboxEscHandler, true)
  lightboxEscHandler = null
}

const openLightbox = (url: string) => {
  const next = normalizeUrl(url)
  if (!next) return
  lightboxUrl.value = next
  bindLightboxEsc()
}

const closeLightbox = () => {
  lightboxUrl.value = ''
  unbindLightboxEsc()
}

const resetState = () => {
  stopPoll()
  closeLightbox()
  bootstrapping.value = false
  loadingNodeImages.value = false
  generating.value = false
  errorMessage.value = ''
  infoMessage.value = ''
  prompt.value = ''
  refDraft.value = ''
  refUrls.value = []
  useNodeImages.value = false
  candidates.value = []
  posters.value = []
  cachedDetail.value = null
}

const onOpenChange = (value: boolean) => {
  emit('update:open', value)
  if (!value) {
    resetState()
  }
}

watch(
  () => [props.open, routeId.value] as const,
  ([open]) => {
    if (!open) return
    void bootstrap()
  },
)

onBeforeUnmount(() => {
  stopPoll()
  unbindLightboxEsc()
})
</script>

<template>
  <Dialog :open="props.open" @update:open="onOpenChange">
    <DialogContent
      class="flex h-[min(90vh,40rem)] max-w-[min(96vw,40rem)] flex-col gap-0 overflow-hidden rounded-[1rem] border border-border bg-[#15171b] p-0 text-left"
    >
      <DialogHeader class="shrink-0 space-y-1.5 border-b border-border/60 px-5 py-4">
        <DialogTitle>海报管理</DialogTitle>
        <DialogDescription>
          {{ routeTitle }} · 可粘贴外链参考；需要时再启用节点图片
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div
          v-if="bootstrapping"
          class="rounded-lg border border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground"
        >
          正在加载海报…
        </div>

        <template v-else>
          <label class="block space-y-1.5 text-sm font-medium">
            画面描述
            <Textarea
              v-model="prompt"
              class="min-h-[80px] resize-y text-sm"
              placeholder="描述希望生成的海报画面…"
              :disabled="generating || polling"
              maxlength="4000"
            />
          </label>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium">
                参考图
                <span class="font-normal text-muted-foreground">
                  {{ refUrls.length }}/{{ REF_MAX }}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                class="h-8"
                :disabled="!canGenerate"
                @click="handleGenerate"
              >
                {{ generating ? '提交中…' : polling ? '生成中…' : '开始生成' }}
              </Button>
            </div>

            <div class="flex gap-2">
              <Input
                v-model="refDraft"
                class="h-8 min-w-0 flex-1 text-sm"
                placeholder="粘贴参考图外链"
                :disabled="generating || polling || refUrls.length >= REF_MAX"
                @keydown.enter.prevent="addRefFromDraft"
              />
              <Button
                variant="outline"
                type="button"
                size="sm"
                class="h-8 shrink-0"
                :disabled="!refDraft.trim() || refUrls.length >= REF_MAX || generating || polling"
                @click="addRefFromDraft"
              >
                加入
              </Button>
            </div>

            <div
              v-if="refUrls.length"
              class="grid grid-cols-5 gap-2 sm:grid-cols-6"
            >
              <div
                v-for="(refUrl, refIndex) in refUrls"
                :key="`ref-${refIndex}-${refUrl}`"
                class="relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20"
              >
                <button
                  type="button"
                  class="absolute inset-0 block h-full w-full cursor-zoom-in"
                  title="放大"
                  @click="openLightbox(refUrl)"
                >
                  <img :src="refUrl" alt="" class="h-full w-full object-cover">
                </button>
                <button
                  type="button"
                  class="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white"
                  title="移除"
                  :disabled="generating || polling"
                  @click.stop="removeRef(refIndex)"
                >
                  <AppIcon name="x" class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-border accent-primary"
                :checked="useNodeImages"
                :disabled="generating || polling || loadingNodeImages"
                @change="onUseNodeImagesChange"
              >
              <span>启用节点可用图</span>
              <span class="font-normal text-muted-foreground">勾选后加载本路线节点图片</span>
            </label>

            <div
              v-if="useNodeImages && loadingNodeImages"
              class="rounded-lg border border-border/60 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              正在获取节点图片…
            </div>

            <div
              v-else-if="useNodeImages && candidates.length"
              class="grid grid-cols-4 gap-2 sm:grid-cols-5"
            >
              <button
                v-for="item in candidates"
                :key="`${item.source}-${item.url}`"
                type="button"
                class="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20 text-left"
                :class="isRefSelected(item.url) ? 'ring-2 ring-primary/60' : ''"
                :disabled="generating || polling"
                :title="isRefSelected(item.url) ? '已参考' : item.label"
                @click="addRefFromCandidate(item)"
              >
                <img :src="item.url" :alt="item.label" class="h-full w-full object-cover">
                <span
                  class="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-[10px] text-white"
                >
                  {{ item.label }}
                </span>
                <span
                  v-if="isRefSelected(item.url)"
                  class="absolute left-1 top-1 rounded bg-primary/90 px-1 py-0.5 text-[10px] text-primary-foreground"
                >
                  参考
                </span>
              </button>
            </div>

            <p
              v-else-if="useNodeImages && !loadingNodeImages"
              class="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              当前路线节点暂无可用图片，可粘贴外链作参考。
            </p>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">已生成海报</p>
              <Button
                variant="ghost"
                type="button"
                size="sm"
                class="h-7 px-2 text-xs"
                :disabled="bootstrapping || generating"
                @click="loadPosters()"
              >
                <AppIcon name="refresh-cw" class="mr-1 h-3.5 w-3.5" :class="polling ? 'animate-spin' : ''" />
                刷新
              </Button>
            </div>
            <div
              v-if="posters.length"
              class="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              <button
                v-for="(poster, index) in posters"
                :key="String(poster.id || poster.attachmentId || poster.imageUrl || index)"
                type="button"
                class="relative aspect-[3/4] overflow-hidden rounded-md border border-border/60 bg-muted/20"
                title="放大预览"
                @click="poster.imageUrl && openLightbox(String(poster.imageUrl))"
              >
                <img
                  v-if="poster.imageUrl"
                  :src="String(poster.imageUrl)"
                  :alt="poster.title || `海报 ${index + 1}`"
                  class="h-full w-full object-cover"
                >
                <div
                  v-else
                  class="flex h-full items-center justify-center text-[11px] text-muted-foreground"
                >
                  无预览
                </div>
              </button>
            </div>
            <p
              v-else
              class="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              暂无海报，填写描述后开始生成。
            </p>
          </div>

          <p v-if="infoMessage" class="text-xs text-sky-200/90">
            {{ infoMessage }}
          </p>
          <p v-if="errorMessage" class="text-xs text-destructive">
            {{ errorMessage }}
          </p>
        </template>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button variant="outline" type="button" class="h-8" @click="onOpenChange(false)">
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 大图预览 -->
  <Teleport to="body">
    <div
      v-if="lightboxUrl"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      @click.self="closeLightbox"
    >
      <button
        type="button"
        class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
        title="关闭"
        @click="closeLightbox"
      >
        <AppIcon name="x" class="h-4 w-4" />
      </button>
      <img
        :src="lightboxUrl"
        alt=""
        class="max-h-[90vh] max-w-[min(96vw,48rem)] rounded-lg object-contain shadow-2xl"
      >
    </div>
  </Teleport>
</template>
