<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue"

export type FindScanStatus = "idle" | "scanning" | "success" | "failed"

interface Props {
  /** 目标展品/节点标题 */
  title?: string | null
  /** 展厅位置等副文案 */
  location?: string | null
  /** 线索提示（可选） */
  clueText?: string | null
  /** 预览图 URL */
  previewUrl?: string | null
  /**
   * 受控状态；不传则组件内部维护（拍照后本地模拟扫描动画）。
   * 管理端预览建议传 idle / success 静态态。
   */
  status?: FindScanStatus
  /** 仅展示扫描框与文案，隐藏操作按钮 */
  previewMode?: boolean
  /** 是否展示「跳过识别」 */
  allowSkip?: boolean
  /** 禁用全部操作 */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  location: "",
  clueText: "",
  previewUrl: null,
  status: undefined,
  previewMode: false,
  allowSkip: true,
  disabled: false,
})

const emit = defineEmits<{
  skip: []
  "file-selected": [file: File]
  "update:status": [status: FindScanStatus]
  "update:previewUrl": [url: string | null]
}>()

const fileInputRef = useTemplateRef<HTMLInputElement>("fileInput")
const internalStatus = ref<FindScanStatus>("idle")
const internalPreviewUrl = ref<string | null>(null)
let scanTimer: ReturnType<typeof setTimeout> | null = null

const resolvedStatus = computed(() => props.status ?? internalStatus.value)
const resolvedPreviewUrl = computed(() => props.previewUrl ?? internalPreviewUrl.value)

const statusText = computed(() => {
  switch (resolvedStatus.value) {
    case "scanning":
      return "看一看…"
    case "success":
      return "找到了"
    case "failed":
      return "再靠近一点试试"
    default:
      return "轻轻对准"
  }
})

const placeholderText = computed(() => {
  switch (resolvedStatus.value) {
    case "scanning":
      return "识别中"
    case "success":
      return "已锁定"
    case "failed":
      return "未对上"
    default:
      return "把展品放进框里"
  }
})

const toolsAway = computed(() => resolvedStatus.value === "success")
const isBusy = computed(() => props.disabled || resolvedStatus.value === "scanning" || resolvedStatus.value === "success")

const setStatus = (next: FindScanStatus) => {
  if (props.status === undefined) {
    internalStatus.value = next
  }
  emit("update:status", next)
}

const setPreviewUrl = (url: string | null) => {
  if (props.previewUrl === undefined || props.previewUrl === null) {
    internalPreviewUrl.value = url
  }
  emit("update:previewUrl", url)
}

const clearScanTimer = () => {
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }
}

const openCamera = () => {
  if (isBusy.value || props.previewMode) {
    return
  }
  fileInputRef.value?.click()
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""

  if (!file || isBusy.value) {
    return
  }

  const url = URL.createObjectURL(file)
  setPreviewUrl(url)
  emit("file-selected", file)

  // 本地扫描反馈；真实识物由宿主在 file-selected 后接管。
  if (props.status !== undefined) {
    return
  }

  clearScanTimer()
  setStatus("scanning")
  scanTimer = setTimeout(() => {
    scanTimer = null
    setStatus("success")
  }, 1100)
}

const onSkip = () => {
  if (isBusy.value || props.previewMode) {
    return
  }
  emit("skip")
}

watch(
  () => props.status,
  (value) => {
    if (value === undefined) {
      return
    }
    // 受控模式下同步失败抖动后由宿主决定是否复位
  },
)

watch(
  () => [props.previewMode, props.title] as const,
  () => {
    if (!props.previewMode) {
      return
    }
    clearScanTimer()
    if (props.status === undefined) {
      internalStatus.value = "idle"
    }
  },
)
</script>

<template>
  <div class="find-scan" :class="{ 'is-preview': previewMode }">
    <p class="scan-caption">
      <strong>{{ title || "目标展品" }}</strong>
      <span v-if="location">{{ location }}</span>
      <span v-else-if="clueText" class="scan-clue">{{ clueText }}</span>
    </p>

    <div
      class="scan-hud"
      :class="{
        scanning: resolvedStatus === 'scanning',
        success: resolvedStatus === 'success',
        failed: resolvedStatus === 'failed',
        'lock-burst': resolvedStatus === 'success',
      }">
      <div class="viewport">
        <img
          v-if="resolvedPreviewUrl"
          class="preview"
          :src="resolvedPreviewUrl"
          alt="扫描预览" />
        <div v-else class="placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 8V6a2 2 0 0 1 2-2h2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v2" />
            <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
            <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
          <span class="tiny">{{ placeholderText }}</span>
        </div>
      </div>

      <div class="scan-reticle" aria-hidden="true">
        <span class="c tl" />
        <span class="c tr" />
        <span class="c bl" />
        <span class="c br" />
      </div>
      <div class="scan-beam" aria-hidden="true" />
      <div class="scan-lock" aria-hidden="true" />
      <div class="scan-foot">
        {{ statusText }}
      </div>
    </div>

    <p v-if="clueText && location" class="scan-clue-block">
      {{ clueText }}
    </p>

    <template v-if="!previewMode">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden-file"
        @change="onFileChange" />

      <div class="scan-tools" :class="{ 'is-away': toolsAway }">
        <button type="button" class="tool" :disabled="isBusy" @click="openCamera">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
          <span>拍照</span>
        </button>
        <button
          v-if="allowSkip"
          type="button"
          class="tool tool-primary"
          :disabled="isBusy"
          @click="onSkip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
          <span>跳过识别</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.find-scan {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: #fff8ea;
}

.find-scan.is-preview {
  gap: 0.65rem;
}

.scan-caption {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
}

.scan-caption strong {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
  color: #fff8ea;
}

.scan-caption span {
  font-size: 0.78rem;
  color: rgb(247 239 221 / 58%);
  line-height: 1.4;
}

.scan-clue {
  color: rgb(209 178 111 / 82%) !important;
}

.scan-hud {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 1.1rem;
  border: 1px solid rgb(255 255 255 / 8%);
  background: #080706;
  box-shadow: 0 0 60px rgb(209 178 111 / 6%);
}

.viewport {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.88;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  color: rgb(247 239 221 / 48%);
  text-align: center;
}

.placeholder svg {
  width: 2.2rem;
  height: 2.2rem;
  opacity: 0.65;
}

.placeholder .tiny {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}

.scan-reticle {
  position: absolute;
  inset: 14% 12%;
  border: 1px solid rgb(209 178 111 / 32%);
  border-radius: 0.55rem;
  box-shadow: 0 0 0 999px rgb(0 0 0 / 42%);
  pointer-events: none;
}

.scan-reticle .c {
  position: absolute;
  width: 1.35rem;
  height: 1.35rem;
  border: 2.5px solid #d1b26f;
}

.scan-reticle .c.tl {
  top: -1px;
  left: -1px;
  border-right: 0;
  border-bottom: 0;
}

.scan-reticle .c.tr {
  top: -1px;
  right: -1px;
  border-left: 0;
  border-bottom: 0;
}

.scan-reticle .c.bl {
  bottom: -1px;
  left: -1px;
  border-right: 0;
  border-top: 0;
}

.scan-reticle .c.br {
  right: -1px;
  bottom: -1px;
  border-left: 0;
  border-top: 0;
}

.scan-beam {
  position: absolute;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #f3d99d, transparent);
  box-shadow: 0 0 18px rgb(209 178 111 / 45%);
  opacity: 0;
  pointer-events: none;
}

.scan-hud.scanning .scan-beam {
  opacity: 1;
  animation: find-scan-beam 1.8s ease-in-out infinite;
}

@keyframes find-scan-beam {
  0% {
    top: 16%;
    opacity: 0;
  }

  12% {
    opacity: 1;
  }

  88% {
    opacity: 1;
  }

  100% {
    top: 80%;
    opacity: 0;
  }
}

.scan-hud.success .scan-reticle {
  border-color: rgb(111 191 138 / 55%);
}

.scan-hud.success .scan-reticle .c {
  border-color: #6fbf8a;
}

.scan-hud.failed {
  animation: find-scan-shake 0.35s ease;
}

.scan-hud.failed .scan-reticle .c {
  border-color: #e07070;
}

@keyframes find-scan-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
}

.scan-hud.lock-burst {
  animation: find-scan-lock-pulse 0.7s ease;
}

.scan-hud.lock-burst .scan-reticle {
  border-color: rgb(111 191 138 / 70%);
  box-shadow:
    0 0 0 999px rgb(0 0 0 / 50%),
    inset 0 0 60px rgb(111 191 138 / 18%),
    0 0 40px rgb(209 178 111 / 35%);
}

.scan-lock {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgb(209 178 111 / 22%), transparent 55%);
  opacity: 0;
  pointer-events: none;
}

.scan-hud.lock-burst .scan-lock {
  animation: find-scan-lock-flash 0.7s ease;
}

@keyframes find-scan-lock-pulse {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.02);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes find-scan-lock-flash {
  0% {
    opacity: 0;
  }

  35% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

.scan-foot {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0.9rem;
  background: linear-gradient(to top, rgb(0 0 0 / 80%), transparent);
  color: #d1b26f;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-align: center;
}

.scan-clue-block {
  margin: 0;
  border-radius: 0.85rem;
  border: 1px solid rgb(255 255 255 / 6%);
  padding: 0.7rem 0.85rem;
  background: rgb(255 255 255 / 4%);
  color: rgb(247 239 221 / 72%);
  font-size: 0.8rem;
  line-height: 1.5;
}

.hidden-file {
  display: none;
}

.scan-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
  transition:
    opacity 0.35s ease,
    transform 0.4s ease;
}

.scan-tools.is-away {
  opacity: 0;
  pointer-events: none;
  transform: translateY(12px);
}

.tool {
  display: flex;
  min-height: 3.4rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 0.85rem;
  background: rgb(255 255 255 / 3%);
  color: rgb(247 239 221 / 78%);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.tool svg {
  width: 1.15rem;
  height: 1.15rem;
  opacity: 0.85;
}

.tool:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.tool-primary {
  border-color: rgb(209 178 111 / 35%);
  background: rgb(209 178 111 / 12%);
  color: #f3d99d;
}

@media (prefers-reduced-motion: reduce) {
  .scan-hud.scanning .scan-beam,
  .scan-hud.failed,
  .scan-hud.lock-burst,
  .scan-hud.lock-burst .scan-lock {
    animation: none;
  }
}
</style>
