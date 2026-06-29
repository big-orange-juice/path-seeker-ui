<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ClueFindPuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: ClueFindPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({
    defaults: {
      ease: "power2.out",
    },
  })

  tl.from(".board", {
    autoAlpha: 0,
    scale: 0.98,
    duration: 0.3,
  }).from(
    ".hotspot",
    {
      autoAlpha: 0,
      scale: 0.78,
      duration: 0.28,
      stagger: 0.05,
    },
    "-=0.12",
  )
})

const boardSurfaceStyle = computed(() =>
  props.puzzle.questionPayload.imageUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(14, 16, 20, 0.12), rgba(14, 16, 20, 0.12)), url(${props.puzzle.questionPayload.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : null,
)

function selectHotspot(hotspotId: string) {
  emit("update:modelValue", {
    templateType: "clue_find",
    value: hotspotId,
  })
}

watch(
  () => props.modelValue?.value,
  async (value) => {
    if (typeof value !== "string") {
      return
    }

    await nextTick()
    animateSelector(
      ".hotspot.is-active",
      { scale: 0.86, backgroundColor: "rgba(209, 178, 111, 0.35)" },
      { scale: 1, backgroundColor: "rgba(209, 178, 111, 0.22)", duration: 0.32, ease: "back.out(1.7)" },
    )
  },
)
</script>

<template>
  <view ref="root" class="find-stack">
    <view v-if="puzzle.questionPayload.targetDescription" class="target-chip">找：{{ puzzle.questionPayload.targetDescription }}</view>

    <view class="board">
      <view class="board-surface" :style="boardSurfaceStyle">
        <button
          v-for="hotspot in puzzle.questionPayload.hotspots"
          :key="hotspot.id"
          class="hotspot"
          :class="{ 'is-active': modelValue?.value === hotspot.id }"
          :style="{
            left: `${hotspot.x}%`,
            top: `${hotspot.y}%`,
            width: `${hotspot.width}%`,
            height: `${hotspot.height}%`,
          }"
          :disabled="readonlyMode"
          @click="selectHotspot(hotspot.id)"
        >
          <text v-if="hotspot.label" class="hotspot-label">{{ hotspot.label }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.find-stack {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.target-chip {
  align-self: flex-start;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #fff8ea;
  font-size: 23rpx;
  font-weight: 800;
}

.board {
  padding: 14rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.045);
}

.board-surface {
  position: relative;
  height: 360rpx;
  overflow: hidden;
  border-radius: 22rpx;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(209, 178, 111, 0.12), transparent 42%),
    linear-gradient(135deg, rgba(36, 39, 46, 0.98), rgba(15, 17, 22, 0.98));
  background-size: 56rpx 56rpx, 56rpx 56rpx, auto, auto;
}

.hotspot {
  position: absolute;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 8rpx;
  border-radius: 18rpx;
  border: 1px dashed rgba(247, 239, 221, 0.22);
  background: rgba(255, 255, 255, 0.035);
  text-align: left;
}

.hotspot.is-active {
  border-style: solid;
  border-color: rgba(209, 178, 111, 0.72);
  background: rgba(209, 178, 111, 0.22);
}

.hotspot-label {
  color: #fff8ea;
  font-size: 20rpx;
  font-weight: 800;
}
</style>
