<script setup lang="ts">
import html2canvas from "html2canvas"
import { computed, shallowRef, useTemplateRef } from "vue"
import { Download } from "lucide-vue-next"
import { Button, Dialog, DialogContent } from "@path-seeker/ui"
import type { MissionShareCard } from "@/types/mission"

interface Props { open: boolean; card: MissionShareCard | null | undefined; coverImageUrl?: string }
const props = defineProps<Props>()
const emit = defineEmits<{ "update:open": [value: boolean]; exported: []; exportError: [] }>()
const cardRef = useTemplateRef<HTMLElement>("card")
const exporting = shallowRef(false)
const completedLabel = computed(() => {
  if (!props.card?.completedAt) return ""
  const date = new Date(props.card.completedAt)
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date)
})
const coverStyle = computed(() => {
  const imageUrl = String(props.coverImageUrl || "").trim()
  return imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, "\\\"")}")` } : undefined
})
async function exportCard() {
  const element = cardRef.value
  if (!element || exporting.value) return
  exporting.value = true
  try {
    const canvas = await html2canvas(element, { backgroundColor: "#17130f", scale: 2, useCORS: true, logging: false })
    const link = document.createElement("a")
    link.download = `${props.card?.routeTitle?.trim() || "纪念卡"}-分享卡.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    emit("exported")
  } catch { emit("exportError") } finally { exporting.value = false }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent :show-close="false" class="share-dialog-content border-0 bg-transparent p-0 shadow-none sm:max-w-md">
      <div class="share-dialog-shell">
        <article ref="card" class="share-card" :style="coverStyle">
          <div class="share-card-cover" /><div class="share-card-grain" />
          <div class="share-card-content">
            <div class="share-card-masthead"><span>时光印记</span><span>MEMORY ARCHIVE</span></div>
            <div class="share-card-issue"><span>特别留存</span><span v-if="completedLabel">{{ completedLabel }}</span></div>
            <div class="share-card-headline"><p v-if="props.card?.theme" class="share-card-theme">{{ props.card.theme }}</p><h2 class="share-card-title">{{ props.card?.routeTitle || "此刻留影" }}</h2><p v-if="props.card?.rewardTitle" class="share-card-reward">{{ props.card.rewardTitle }}</p></div>
            <div class="share-card-footer"><p class="share-card-byline">{{ props.card?.nickname || "探寻者" }} 的此刻留影</p><div class="share-card-stats"><span>记录 {{ props.card?.solvedCount || 0 }}/{{ props.card?.puzzleCount || 0 }}</span><span v-if="props.card?.noCluePerfect">完整留存</span></div></div>
          </div>
        </article>
        <Button class="share-dialog-export" :disabled="exporting" @click="exportCard"><Download :size="17" aria-hidden="true" />{{ exporting ? "正在生成..." : "保存截图" }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.share-dialog-content { width: min(calc(100vw - 2rem), 25rem); }
.share-dialog-shell { position: relative; display: grid; gap: 0.8rem; }
.share-card { position: relative; isolation: isolate; overflow: hidden; aspect-ratio: 0.72; border: 1px solid rgba(232, 201, 138, 0.58); background-color: #17130f; background-position: center; background-size: cover; box-shadow: 0 24px 54px rgba(0, 0, 0, 0.48); }
.share-card-cover, .share-card-grain { position: absolute; inset: 0; pointer-events: none; }
.share-card-cover { z-index: -1; background: linear-gradient(180deg, rgba(9, 8, 6, 0.3) 0%, rgba(10, 8, 6, 0.1) 36%, rgba(11, 9, 7, 0.88) 100%), linear-gradient(90deg, rgba(8, 7, 5, 0.35), transparent 34%, rgba(8, 7, 5, 0.26)); }
.share-card-grain { z-index: -1; opacity: 0.34; background-image: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.028) 0 1px, transparent 1px 3px); mix-blend-mode: overlay; }
.share-card-content { display: flex; height: 100%; flex-direction: column; padding: 1.2rem 1.2rem 1rem; color: #fff6df; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7); }
.share-card-masthead, .share-card-issue, .share-card-stats { display: flex; justify-content: space-between; gap: 0.75rem; }
.share-card-masthead { padding-bottom: 0.55rem; border-bottom: 1px solid rgba(255, 246, 223, 0.58); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.12em; }
.share-card-issue { margin-top: 0.52rem; color: rgba(255, 246, 223, 0.76); font-size: 0.58rem; font-weight: 700; letter-spacing: 0.09em; }
.share-card-headline { margin-top: auto; padding-top: 5.25rem; }
.share-card-theme, .share-card-reward, .share-card-byline { margin: 0; }
.share-card-theme { color: #efd391; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em; }
.share-card-title { margin: 0.38rem 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 9vw, 3.05rem); font-weight: 700; line-height: 0.98; letter-spacing: 0; overflow-wrap: anywhere; }
.share-card-reward { margin-top: 0.7rem; max-width: 82%; color: #f6dfaa; font-family: Georgia, "Times New Roman", serif; font-size: 1.03rem; font-style: italic; line-height: 1.3; }
.share-card-footer { margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 246, 223, 0.52); }
.share-card-byline { font-size: 0.73rem; font-weight: 700; letter-spacing: 0.04em; }
.share-card-stats { margin-top: 0.42rem; color: rgba(255, 246, 223, 0.74); font-size: 0.62rem; font-weight: 650; letter-spacing: 0.04em; }
.share-dialog-export { width: 100%; }
@media (max-width: 380px) { .share-card-content { padding: 1rem; } .share-card-title { font-size: 2rem; } }
</style>
