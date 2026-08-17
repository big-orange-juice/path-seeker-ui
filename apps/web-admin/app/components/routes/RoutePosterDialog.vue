<script setup lang="ts">
/**
 * 路线海报管理：上传参考图 / 勾选节点图，提交 AI 生成；结果靠手动刷新同步。
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
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import { IMAGE_LIGHTBOX_Z_INDEX } from '@/components/shadcn/dialog/layer'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiImageUpload from '@/components/ui/ImageUpload.vue'
import type { ChatAttachmentReference } from '@/types/chat'
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
  reference: [attachment: ChatAttachmentReference]
}>()

const { request } = useApiClient()

const REF_MAX = 5
/** 生成已提交、等待用户手动刷新时的提示（有海报列表时不展示） */
const PENDING_GENERATE_TIP = '已提交生成，完成后请点击刷新查看。'

const bootstrapping = ref(false)
const loadingNodeImages = ref(false)
const generating = ref(false)
const refreshingPosters = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const prompt = ref('')
const refUrls = ref<string[]>([])
const selectedCandidateUrls = ref<string[]>([])
/** 是否启用节点可用图：默认关闭，勾选后再拉取当前路线 nodes 图片 */
const useNodeImages = ref(false)
const candidates = ref<RoutePosterCandidateImage[]>([])
const posters = ref<RoutePosterResponse[]>([])
const lightboxUrl = ref('')
/** 缓存详情，避免反复勾选时重复请求路线详情 */
const cachedDetail = ref<RouteDetailResponse | null>(null)

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
    && !refreshingPosters.value,
)

/** 生成提示与已生成海报互斥：有海报时只看列表 */
const showGenerateTip = computed(
  () => Boolean(infoMessage.value) && posters.value.length === 0,
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

/** 与上传组件双向同步，始终钳制在上限内（不走外链粘贴） */
const onRefUrlsUpdate = (urls: string[]) => {
  const next: string[] = []
  const seen = new Set<string>()
  let hitLimit = false
  for (const raw of urls) {
    const url = normalizeUrl(raw)
    if (!url || seen.has(url) || !isPreviewableImageUrl(url)) continue
    if (next.length >= REF_MAX) {
      hitLimit = true
      break
    }
    seen.add(url)
    next.push(url)
  }
  refUrls.value = next
  if (hitLimit) {
    errorMessage.value = `参考图最多 ${REF_MAX} 张。`
  } else if (errorMessage.value.startsWith('参考图最多')) {
    errorMessage.value = ''
  }
}

const isCandidateSelected = (url: string) => selectedCandidateUrls.value.includes(normalizeUrl(url))

const toggleCandidate = (item: RoutePosterCandidateImage) => {
  if (generating.value) return
  const url = normalizeUrl(item.url)
  // 节点图只在候选区勾选，不写入上方参考图列表，避免重复
  selectedCandidateUrls.value = isCandidateSelected(url)
    ? selectedCandidateUrls.value.filter((value) => value !== url)
    : [...selectedCandidateUrls.value, url]
}

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
      push(imageUrl, `${title} · 站点配图`, 'node', stageId)
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

const loadPosters = async (options?: { silent?: boolean }) => {
  if (!routeId.value) {
    posters.value = []
    return
  }
  if (!options?.silent) {
    refreshingPosters.value = true
  }
  try {
    const list = await request<RoutePosterResponse[]>('/api/poster/list', {
      method: 'GET',
      query: { routeId: routeId.value },
    })
    const posterList = Array.isArray(list) ? list : []
    const details = await Promise.all(
      posterList.map(async (poster) => {
        const id = String(poster.id ?? '').trim()
        if (!id) return poster
        return await request<RoutePosterResponse | null>('/api/poster/get', {
          method: 'GET',
          query: { id },
        }) ?? poster
      }),
    )
    posters.value = details
    // 有海报时清掉「等待生成」提示，避免与列表同时出现
    if (details.length > 0 && infoMessage.value === PENDING_GENERATE_TIP) {
      infoMessage.value = ''
    }
  } finally {
    if (!options?.silent) {
      refreshingPosters.value = false
    }
  }
}

/** 打开弹窗时只拉已生成海报；节点图按勾选再取 */
const bootstrap = async () => {
  if (!routeId.value) return

  bootstrapping.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  useNodeImages.value = false
  candidates.value = []
  selectedCandidateUrls.value = []
  cachedDetail.value = null

  try {
    await loadPosters({ silent: true })
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
    selectedCandidateUrls.value = merged.map((item) => item.url)
  } catch (error) {
    errorMessage.value = resolveError(error, '加载站点配图失败。')
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
    selectedCandidateUrls.value = []
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

  // 上传参考 + 节点勾选合计，去重后截断到接口上限
  const referenceImageUrls = [...refUrls.value, ...selectedCandidateUrls.value]
    .map((item) => normalizeUrl(item))
    .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index)
    .slice(0, REF_MAX)
  const invalidRef = referenceImageUrls.find((url) => !isPreviewableImageUrl(url))
  if (invalidRef) {
    errorMessage.value = '参考图请使用可公开访问的链接。'
    return
  }

  generating.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    await request<GenerateRoutePosterResponse | null>('/api/poster/generate', {
      method: 'POST',
      body: {
        routeId: routeId.value,
        prompt: nextPrompt,
        ...(referenceImageUrls.length ? { referenceImageUrls } : {}),
      },
    })
    // 不轮询：有海报时提示不展示，空列表时提示用户手动刷新
    infoMessage.value = PENDING_GENERATE_TIP
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
  closeLightbox()
  bootstrapping.value = false
  loadingNodeImages.value = false
  generating.value = false
  refreshingPosters.value = false
  errorMessage.value = ''
  infoMessage.value = ''
  prompt.value = ''
  refUrls.value = []
  selectedCandidateUrls.value = []
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

const handleRefreshPosters = async () => {
  if (bootstrapping.value || generating.value || refreshingPosters.value) return
  errorMessage.value = ''
  try {
    await loadPosters()
  } catch (error) {
    errorMessage.value = resolveError(error, '刷新海报失败。')
  }
}

const referencePoster = (poster: RoutePosterResponse, index: number) => {
  const attachmentId = String(poster.attachmentId ?? '').trim()
  const imageUrl = String(poster.imageUrl ?? '').trim()
  if (!attachmentId || !imageUrl) return

  emit('reference', {
    attachmentId,
    imageUrl,
    label: String(poster.title ?? '').trim() || `海报 ${index + 1}`,
    source: 'poster',
  })
}

// v-if 挂载时 open 已为 true，必须 immediate，否则不会拉现有海报
watch(
  () => [props.open, routeId.value] as const,
  ([open]) => {
    if (!open || !routeId.value) return
    void bootstrap()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
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
          {{ routeTitle }} · 上传参考图；需要时再启用站点配图
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
              :disabled="generating"
              maxlength="4000"
            />
          </label>

          <div class="space-y-2">
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
                {{ generating ? '提交中…' : '开始生成' }}
              </Button>
            </div>

            <UiImageUpload
              :model-value="refUrls"
              label="上传参考图"
              hint="通过图片上传添加参考，最多 5 张；站点配图请在下方单独勾选。"
              button-text="选择图片"
              button-subtext="支持多图"
              item-label="参考图"
              primary-hint="将作为参考"
              secondary-hint="将作为参考"
              set-primary-text="置顶"
              remove-text="移除"
              :multiple="true"
              upload-target="image"
              @update:model-value="onRefUrlsUpdate"
            />
          </div>

          <div class="space-y-1.5">
            <label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-border accent-primary"
                :checked="useNodeImages"
                :disabled="generating || loadingNodeImages"
                @change="onUseNodeImagesChange"
              >
              <span>启用站点可用图</span>
              <span class="font-normal text-muted-foreground">勾选后加载并默认全选</span>
            </label>

            <div
              v-if="useNodeImages && loadingNodeImages"
              class="rounded-lg border border-border/60 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              正在获取站点配图…
            </div>

            <div
              v-else-if="useNodeImages && candidates.length"
              class="grid grid-cols-4 gap-2 sm:grid-cols-5"
            >
              <div
                v-for="item in candidates"
                :key="`${item.source}-${item.url}`"
                class="group relative aspect-square overflow-hidden rounded-md border bg-muted/20"
                :class="isCandidateSelected(item.url)
                  ? 'border-primary ring-2 ring-primary/50'
                  : 'border-border/60'"
              >
                <button
                  type="button"
                  class="absolute inset-0 block h-full w-full text-left"
                  :disabled="generating"
                  :title="isCandidateSelected(item.url) ? '取消选择' : `选择 · ${item.label}`"
                  @click="toggleCandidate(item)"
                >
                  <img :src="item.url" :alt="item.label" class="h-full w-full object-cover">
                  <span
                    class="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-[10px] text-white"
                  >
                    {{ item.label }}
                  </span>
                </button>
                <button
                  type="button"
                  class="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/65 text-white opacity-90 transition hover:bg-black/80"
                  title="查看大图"
                  @click.stop="openLightbox(item.url)"
                >
                  <AppIcon name="zoom-in" class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p
              v-else-if="useNodeImages && !loadingNodeImages"
              class="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              当前路线站点暂无可用图片，可上传参考图。
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
                :disabled="bootstrapping || generating || refreshingPosters"
                @click="handleRefreshPosters"
              >
                <AppIcon
                  name="refresh-cw"
                  class="mr-1 h-3.5 w-3.5"
                  :class="refreshingPosters ? 'animate-spin' : ''"
                />
                刷新
              </Button>
            </div>
            <div
              v-if="posters.length"
              class="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              <div
                v-for="(poster, index) in posters"
                :key="String(poster.id || poster.attachmentId || poster.imageUrl || index)"
                class="group relative aspect-[3/4] overflow-hidden rounded-md border border-border/60 bg-muted/20"
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
                <button
                  v-if="poster.imageUrl"
                  type="button"
                  class="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/65 text-white opacity-90 transition hover:bg-black/80"
                  title="查看大图"
                  @click="openLightbox(String(poster.imageUrl))"
                >
                  <AppIcon name="zoom-in" class="h-3.5 w-3.5" />
                </button>
                <button
                  v-if="poster.attachmentId && poster.imageUrl"
                  type="button"
                  class="absolute inset-x-1 bottom-1 z-10 h-7 rounded-md bg-black/70 text-xs font-medium text-white transition hover:bg-black/85"
                  @click="referencePoster(poster, index)"
                >
                  引用
                </button>
              </div>
            </div>
            <p
              v-else-if="showGenerateTip"
              class="rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-4 text-center text-xs text-sky-200/90"
            >
              {{ infoMessage }}
            </p>
            <p
              v-else
              class="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground"
            >
              暂无海报，填写描述后开始生成。
            </p>
          </div>

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

  <!-- 大图预览：须压过 Dialog 栈 -->
  <Teleport to="body">
    <div
      v-if="lightboxUrl"
      data-image-lightbox
      class="fixed inset-0 flex items-center justify-center bg-black/80 p-4"
      :style="{ zIndex: IMAGE_LIGHTBOX_Z_INDEX }"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
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
        @click.stop
      >
    </div>
  </Teleport>
</template>
