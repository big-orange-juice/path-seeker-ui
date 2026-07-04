<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { PuzzleAnswerDraft, SelectPuzzleDefinition } from "../../contracts"

interface Props {
  puzzle: SelectPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".select-brief", {
    autoAlpha: 0,
    y: 12,
    duration: 0.28,
  }).from(
    ".select-card",
    {
      autoAlpha: 0,
      y: 18,
      duration: 0.32,
      stagger: 0.05,
    },
    "-=0.1",
  )
})

const pickedIds = computed<string[]>(() => {
  const value = props.modelValue?.value
  return Array.isArray(value) ? (value as unknown[]).filter((item): item is string => typeof item === "string") : []
})

const minPick = computed(() => Math.max(1, props.puzzle.questionPayload.minPick || 1))
const maxPick = computed(() => {
  const max = props.puzzle.questionPayload.maxPick
  return typeof max === "number" && max > 0 ? max : props.puzzle.questionPayload.candidates.length
})

const pickCopy = computed(() => {
  if (minPick.value === maxPick.value) {
    return `请选择 ${minPick.value} 项`
  }

  return `请选择 ${minPick.value}-${maxPick.value} 项`
})

function updatePicked(nextPickedIds: string[]) {
  emit("update:modelValue", {
    templateType: "select",
    value: nextPickedIds,
  })
}

async function toggleCandidate(candidateId: string) {
  if (props.readonlyMode) {
    return
  }

  const exists = pickedIds.value.includes(candidateId)
  if (exists) {
    updatePicked(pickedIds.value.filter((id) => id !== candidateId))
    return
  }

  if (pickedIds.value.length >= maxPick.value) {
    const [, ...rest] = pickedIds.value
    updatePicked([...rest, candidateId])
  } else {
    updatePicked([...pickedIds.value, candidateId])
  }

  await nextTick()
  animateSelector(
    ".select-card.is-active",
    { scale: 0.96, y: 8 },
    { scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" },
  )
}

watch(
  () => props.modelValue?.value,
  async (value) => {
    if (!Array.isArray(value)) {
      return
    }

    await nextTick()
    animateSelector(
      ".select-count",
      { scale: 0.92 },
      { scale: 1, duration: 0.24, ease: "back.out(1.6)" },
    )
  },
)
</script>

<template>
  <view ref="root" class="select-lab">
    <view class="select-brief">
      <view>
        <text class="select-label">{{ puzzle.questionPayload.pickedTitle || "选择目标" }}</text>
        <text v-if="puzzle.questionPayload.theme" class="select-theme">{{ puzzle.questionPayload.theme }}</text>
      </view>
      <text class="select-count">{{ pickedIds.length }}/{{ maxPick }}</text>
    </view>

    <text class="select-rule">{{ pickCopy }}</text>

    <view class="select-grid">
      <button
        v-for="candidate in puzzle.questionPayload.candidates"
        :key="candidate.id"
        class="select-card"
        :class="{ 'is-active': pickedIds.includes(candidate.id) }"
        :disabled="readonlyMode"
        @click="toggleCandidate(candidate.id)"
      >
        <view class="select-image-wrap">
          <image
            v-if="candidate.imageUrl"
            class="select-image"
            :src="candidate.imageUrl"
            mode="aspectFill"
          />
          <text v-else class="select-image-fallback">{{ candidate.label.slice(0, 1) }}</text>
          <text class="select-check">{{ pickedIds.includes(candidate.id) ? "已选" : "选择" }}</text>
        </view>
        <text class="select-title">{{ candidate.label }}</text>
        <text v-if="candidate.description" class="select-desc">{{ candidate.description }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.select-lab {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.select-brief {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 18rpx;
  border: 1px solid rgba(209, 178, 111, 0.22);
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 92% 18%, rgba(209, 178, 111, 0.18), transparent 26%),
    rgba(209, 178, 111, 0.08);
}

.select-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.select-theme,
.select-rule,
.select-desc {
  display: block;
  color: rgba(247, 239, 221, 0.62);
  font-size: 22rpx;
  line-height: 1.4;
}

.select-theme {
  margin-top: 8rpx;
}

.select-count {
  flex: 0 0 auto;
  min-width: 72rpx;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(247, 239, 221, 0.08);
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
  text-align: center;
}

.select-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.select-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-height: 292rpx;
  padding: 12rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.select-card.is-active {
  background: rgba(209, 178, 111, 0.14);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.42);
}

.select-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1.12;
  overflow: hidden;
  border-radius: 18rpx;
  background:
    linear-gradient(135deg, rgba(209, 178, 111, 0.16), rgba(255, 255, 255, 0.04)),
    rgba(0, 0, 0, 0.16);
}

.select-image {
  width: 100%;
  height: 100%;
}

.select-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #d1b26f;
  font-size: 46rpx;
  font-weight: 900;
}

.select-check {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(14, 16, 20, 0.72);
  color: #f1d89c;
  font-size: 18rpx;
  font-weight: 900;
}

.select-title {
  color: #fff8ea;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.3;
}

.select-desc {
  margin-top: -4rpx;
  font-size: 20rpx;
}
</style>
