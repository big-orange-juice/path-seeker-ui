<script setup lang="ts">
import { computed, shallowRef } from "vue"
import type { MatchPair, MissionAnswerDraft, MissionPuzzle } from "@/types/mission"

interface Props {
  puzzle: MissionPuzzle
  modelValue: MissionAnswerDraft | null
  readonlyMode?: boolean
}

interface GridPoint {
  id: string
  x: number
  y: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

const payload = computed<any>(() => props.puzzle.questionPayload)
const draftValue = computed(() => props.modelValue?.value ?? null)
const selectedLeftId = shallowRef<string | null>(null)
const selectedSortId = shallowRef<string | null>(null)
const selectedPieceId = shallowRef<string | null>(null)

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function parsePoint(value: string): GridPoint | null {
  const [id, xText, yText] = value.split(":")
  const x = Number(xText)
  const y = Number(yText)

  return id && Number.isFinite(x) && Number.isFinite(y) ? { id, x, y } : null
}

const pickedIds = computed<string[]>(() => toStringArray(draftValue.value))
const sortOrder = computed<string[]>(() => {
  if (Array.isArray(draftValue.value)) {
    return toStringArray(draftValue.value)
  }

  return (payload.value.items || []).map((item: any) => item.id)
})
const orderedSortItems = computed<any[]>(() => {
  const itemMap = new Map((payload.value.items || []).map((item: any) => [item.id, item]))
  return sortOrder.value.map((id) => itemMap.get(id)).filter(Boolean)
})
const imageOrder = computed<string[]>(() => {
  if (Array.isArray(draftValue.value)) {
    return toStringArray(draftValue.value)
  }

  return (payload.value.pieces || []).map((item: any) => item.id)
})
const orderedImagePieces = computed<any[]>(() => {
  const itemMap = new Map((payload.value.pieces || []).map((item: any) => [item.id, item]))
  return imageOrder.value.map((id) => itemMap.get(id)).filter(Boolean)
})
const gridColumns = computed(() => {
  const cols = Number(payload.value.gridCols || payload.value.gridSize || 2)
  return Math.max(2, Math.min(4, cols || 2))
})
const matchPairs = computed<MatchPair[]>(() => {
  const value = draftValue.value
  return Array.isArray(value)
    ? (value as unknown[]).filter((item): item is MatchPair => typeof item === "object" && item !== null && "leftId" in item && "rightId" in item)
    : []
})
const codeValue = computed(() => typeof draftValue.value === "string" ? draftValue.value : "")
const requiredHits = computed(() => Math.max(1, Number(payload.value.requiredHits || payload.value.hotspots?.length || 1)))
const cluePoints = computed<GridPoint[]>(() => toStringArray(draftValue.value).map(parsePoint).filter((item): item is GridPoint => Boolean(item)))
const hasHotspots = computed(() => Array.isArray(payload.value.hotspots) && payload.value.hotspots.length > 0)
const matchProgressText = computed(() => `${matchPairs.value.length}/${Math.min(payload.value.left?.length || 0, payload.value.right?.length || 0)}`)

function update(value: MissionAnswerDraft["value"]) {
  if (props.readonlyMode) {
    return
  }

  emit("update:modelValue", {
    templateType: props.puzzle.templateType,
    value,
  })
}

function togglePicked(id: string) {
  const exists = pickedIds.value.includes(id)
  if (exists) {
    update(pickedIds.value.filter((item) => item !== id))
    return
  }

  const minPick = Math.max(1, Number(payload.value.minPick || 1))
  const maxPick = Number(payload.value.maxPick || payload.value.candidates?.length || minPick)
  if (pickedIds.value.length >= maxPick) {
    update([...pickedIds.value.slice(1), id])
    return
  }

  update([...pickedIds.value, id])
}

function swapOrder(order: string[], firstId: string, secondId: string) {
  const next = [...order]
  const firstIndex = next.indexOf(firstId)
  const secondIndex = next.indexOf(secondId)

  if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
    return next
  }

  const current = next[firstIndex]
  next[firstIndex] = next[secondIndex]
  next[secondIndex] = current
  return next
}

function toggleSortItem(id: string) {
  if (!selectedSortId.value) {
    selectedSortId.value = id
    return
  }

  if (selectedSortId.value === id) {
    selectedSortId.value = null
    return
  }

  update(swapOrder(sortOrder.value, selectedSortId.value, id))
  selectedSortId.value = null
}

function toggleImagePiece(id: string) {
  if (!selectedPieceId.value) {
    selectedPieceId.value = id
    return
  }

  if (selectedPieceId.value === id) {
    selectedPieceId.value = null
    return
  }

  update(swapOrder(imageOrder.value, selectedPieceId.value, id))
  selectedPieceId.value = null
}

function pickLeft(leftId: string) {
  selectedLeftId.value = selectedLeftId.value === leftId ? null : leftId
}

function pickRight(rightId: string) {
  if (!selectedLeftId.value) {
    return
  }

  const next = matchPairs.value.filter((pair) => pair.leftId !== selectedLeftId.value && pair.rightId !== rightId)
  update([...next, { leftId: selectedLeftId.value, rightId }])
  selectedLeftId.value = null
}

function clearPair(leftId: string) {
  update(matchPairs.value.filter((pair) => pair.leftId !== leftId))
}

function pairForLeft(leftId: string) {
  return matchPairs.value.find((item) => item.leftId === leftId) || null
}

function pairForRight(rightId: string) {
  return matchPairs.value.find((item) => item.rightId === rightId) || null
}

function pairLabel(leftId: string) {
  const pair = pairForLeft(leftId)
  const right = (payload.value.right || []).find((item: any) => item.id === pair?.rightId)
  return right?.label || "待配对"
}

function pickHotspot(id: string) {
  update(id)
}

function toggleGridPoint(row: number, col: number) {
  const cols = 3
  const x = Math.round(((col + 0.5) / cols) * 100)
  const y = Math.round(((row + 0.5) / cols) * 100)
  const id = `tap-${row + 1}-${col + 1}`
  const value = `${id}:${x}:${y}`
  const current = toStringArray(draftValue.value)
  const exists = current.some((item) => item.startsWith(`${id}:`))

  if (exists) {
    update(current.filter((item) => !item.startsWith(`${id}:`)))
    return
  }

  if (current.length >= requiredHits.value) {
    update([...current.slice(1), value])
    return
  }

  update([...current, value])
}

function updateCode(event: any) {
  update(String(event.detail?.value || ""))
}
</script>

<template>
  <view class="puzzle-renderer-host">
    <view v-if="props.puzzle.templateType === 'select'" class="mp-renderer stack">
      <view class="renderer-head">
        <text class="renderer-title">{{ payload.pickedTitle || '选择目标' }}</text>
        <text class="renderer-count">{{ pickedIds.length }}/{{ payload.maxPick || payload.candidates.length }}</text>
      </view>
      <text class="renderer-copy">请选择 {{ payload.minPick || 1 }} 项</text>
      <view v-if="payload.candidates.length" class="card-grid">
        <button
          v-for="candidate in payload.candidates"
          :key="candidate.id"
          class="choice-card"
          :class="{ 'is-active': pickedIds.includes(candidate.id) }"
          @click="togglePicked(candidate.id)">
          <image v-if="candidate.imageUrl" class="choice-image" :src="candidate.imageUrl" mode="aspectFill" />
          <view v-else class="image-fallback"><text>{{ candidate.label.slice(0, 1) }}</text></view>
          <text class="choice-title">{{ candidate.label }}</text>
        </button>
      </view>
      <view v-else class="empty-panel"><text>当前节点暂不可操作</text></view>
    </view>

    <view v-else-if="props.puzzle.templateType === 'sort'" class="mp-renderer stack">
      <view class="renderer-head">
        <text class="renderer-title">{{ payload.prompt }}</text>
        <text class="renderer-count">点两项交换</text>
      </view>
      <view class="compact-list">
        <button
          v-for="(item, index) in orderedSortItems"
          :key="item.id"
          class="sort-card"
          :class="{ 'is-active': selectedSortId === item.id }"
          @click="toggleSortItem(item.id)">
          <text class="order-badge">{{ index + 1 }}</text>
          <image v-if="item.imageUrl" class="thumb-image" :src="item.imageUrl" mode="aspectFill" />
          <text class="sort-title">{{ item.label }}</text>
        </button>
      </view>
    </view>

    <view v-else-if="props.puzzle.templateType === 'match'" class="mp-renderer stack">
      <view class="renderer-head">
        <text class="renderer-title">{{ payload.prompt }}</text>
        <text class="renderer-count">{{ matchProgressText }}</text>
      </view>
      <text class="renderer-copy">{{ selectedLeftId ? '已选左侧项目，请点右侧目标完成配对' : '先点左侧档案，再点右侧目标' }}</text>
      <view class="match-layout">
        <view class="match-column">
          <button
            v-for="item in payload.left"
            :key="item.id"
            class="match-card"
            :class="{ 'is-active': selectedLeftId === item.id, 'is-paired': pairForLeft(item.id) }"
            @click="pickLeft(item.id)">
            <image v-if="item.imageUrl" class="match-image" :src="item.imageUrl" mode="aspectFill" />
            <text class="choice-title">{{ item.label }}</text>
            <view class="pair-row">
              <text class="renderer-copy">{{ pairLabel(item.id) }}</text>
              <view v-if="pairForLeft(item.id)" class="clear-pair" @click.stop="clearPair(item.id)">改</view>
            </view>
          </button>
        </view>
        <view class="match-column">
          <button
            v-for="item in payload.right"
            :key="item.id"
            class="match-card right-card"
            :class="{ 'is-paired': pairForRight(item.id) }"
            @click="pickRight(item.id)">
            <image v-if="item.imageUrl" class="match-image" :src="item.imageUrl" mode="aspectFill" />
            <text class="choice-title">{{ item.label }}</text>
          </button>
        </view>
      </view>
    </view>

    <view v-else-if="props.puzzle.templateType === 'image_puzzle'" class="mp-renderer stack">
      <view class="renderer-head">
        <text class="renderer-title">{{ payload.trayTitle || payload.prompt }}</text>
        <text class="renderer-count">点两片交换</text>
      </view>
      <image v-if="payload.imageUrl" class="reference-image" :src="payload.imageUrl" mode="aspectFit" />
      <view class="piece-grid" :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }">
        <button
          v-for="(piece, index) in orderedImagePieces"
          :key="piece.id"
          class="piece-card"
          :class="{ 'is-active': selectedPieceId === piece.id }"
          @click="toggleImagePiece(piece.id)">
          <text class="piece-index">{{ index + 1 }}</text>
          <image v-if="piece.imageUrl" class="piece-image" :src="piece.imageUrl" mode="aspectFill" />
          <view v-else class="piece-fallback"><text>{{ piece.label.slice(0, 1) }}</text></view>
        </button>
      </view>
    </view>

    <view v-else-if="props.puzzle.templateType === 'clue_find'" class="mp-renderer stack">
      <view class="renderer-head">
        <text class="renderer-title">{{ payload.targetDescription || payload.prompt }}</text>
        <text v-if="!hasHotspots" class="renderer-count">{{ cluePoints.length }}/{{ requiredHits }}</text>
      </view>
      <view v-if="payload.imageUrl" class="spot-stage">
        <image class="spot-image" :src="payload.imageUrl" mode="widthFix" />
        <view v-if="hasHotspots" class="hotspot-layer">
          <button
            v-for="hotspot in payload.hotspots"
            :key="hotspot.id"
            class="hotspot-button"
            :style="{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, width: `${hotspot.width}%`, height: `${hotspot.height}%` }"
            @click="pickHotspot(hotspot.id)">
            <text>{{ hotspot.label || '' }}</text>
          </button>
        </view>
        <view v-else class="tap-grid">
          <view v-for="row in 3" :key="`row-${row}`" class="tap-row">
            <button
              v-for="col in 3"
              :key="`cell-${row}-${col}`"
              class="tap-cell"
              @click.stop="toggleGridPoint(row - 1, col - 1)" />
          </view>
          <view
            v-for="point in cluePoints"
            :key="point.id"
            class="spot-marker"
            :style="{ left: `${point.x}%`, top: `${point.y}%` }">
            <text>{{ cluePoints.findIndex((item) => item.id === point.id) + 1 }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-panel"><text>当前节点暂不可操作</text></view>
    </view>

    <view v-else-if="props.puzzle.templateType === 'code_break'" class="mp-renderer stack">
      <text class="renderer-title">{{ payload.prompt }}</text>
      <input class="code-input" :maxlength="payload.codeLength" :value="codeValue" placeholder="输入答案" @input="updateCode" />
      <text v-if="payload.clueSourceTitle" class="renderer-copy">{{ payload.clueSourceTitle }}</text>
      <view v-if="payload.clueFragments?.length" class="chip-row-local">
        <text v-for="item in payload.clueFragments" :key="item" class="local-chip">{{ item }}</text>
      </view>
    </view>

    <view v-else class="mp-renderer stack">
      <text class="renderer-title">{{ payload.prompt || props.puzzle.prompt }}</text>
      <view v-if="payload.options?.length" class="list-stack">
        <button v-for="option in payload.options" :key="option.id" class="match-card" @click="update(option.id)">
          <text class="choice-title">{{ option.label }}</text>
          <text v-if="option.description" class="renderer-copy">{{ option.description }}</text>
        </button>
      </view>
      <view v-else class="empty-panel"><text>当前节点暂不可操作</text></view>
    </view>
  </view>
</template>

<style scoped>
.puzzle-renderer-host,
.mp-renderer {
  display: block;
  width: 100%;
  min-height: 1rpx;
}

.stack,
.list-stack,
.match-column,
.compact-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.renderer-head,
.chip-row-local,
.match-layout,
.pair-row {
  display: flex;
  gap: 12rpx;
}

.renderer-head,
.pair-row {
  align-items: center;
  justify-content: space-between;
}

.renderer-title,
.choice-title,
.sort-title {
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.35;
}

.renderer-count,
.local-chip,
.order-badge,
.piece-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42rpx;
  min-height: 42rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #f3d99d;
  font-size: 21rpx;
  font-weight: 900;
}

.renderer-copy {
  color: rgba(247, 239, 221, 0.62);
  font-size: 22rpx;
  line-height: 1.42;
}

.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.choice-card,
.match-card,
.sort-card,
.piece-card,
.empty-panel {
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.045);
  color: #fff8ea;
  text-align: left;
}

.choice-card {
  flex: 0 0 calc(50% - 7rpx);
  padding: 16rpx;
}

.choice-card.is-active,
.match-card.is-active,
.sort-card.is-active,
.piece-card.is-active {
  border-color: rgba(209, 178, 111, 0.72);
  background: rgba(209, 178, 111, 0.16);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.34);
}

.match-card.is-paired {
  border-color: rgba(129, 199, 132, 0.38);
}

.choice-image,
.image-fallback {
  width: 100%;
  height: 178rpx;
  margin-bottom: 12rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.18);
}

.image-fallback,
.piece-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1b26f;
  font-weight: 900;
}

.image-fallback {
  font-size: 42rpx;
}

.reference-image,
.spot-image {
  width: 100%;
  border-radius: 20rpx;
  background: rgba(0, 0, 0, 0.18);
}

.reference-image {
  max-height: 300rpx;
}

.compact-list {
  gap: 12rpx;
}

.sort-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 96rpx;
  padding: 12rpx;
}

.thumb-image {
  width: 86rpx;
  height: 72rpx;
  flex: 0 0 86rpx;
  border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.18);
}

.sort-title {
  flex: 1;
  min-width: 0;
}

.match-layout {
  align-items: stretch;
}

.match-column {
  flex: 1;
  min-width: 0;
  gap: 12rpx;
}

.match-card {
  width: 100%;
  padding: 14rpx;
}

.right-card {
  min-height: 112rpx;
}

.match-image {
  width: 100%;
  height: 104rpx;
  margin-bottom: 8rpx;
  border-radius: 14rpx;
  background: rgba(0, 0, 0, 0.18);
}

.clear-pair {
  min-width: 46rpx;
  min-height: 40rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
  font-size: 20rpx;
  font-weight: 900;
}

.piece-grid {
  display: grid;
  gap: 10rpx;
}

.piece-card {
  position: relative;
  overflow: hidden;
  min-height: 150rpx;
  padding: 0;
}

.piece-index {
  position: absolute;
  z-index: 2;
  left: 8rpx;
  top: 8rpx;
  min-width: 38rpx;
  min-height: 38rpx;
  padding: 0;
  background: rgba(13, 14, 17, 0.76);
}

.piece-image,
.piece-fallback {
  width: 100%;
  height: 150rpx;
  background: rgba(0, 0, 0, 0.18);
}

.piece-fallback {
  font-size: 34rpx;
}

.spot-stage {
  position: relative;
  overflow: hidden;
  border-radius: 20rpx;
  background: rgba(0, 0, 0, 0.18);
}

.hotspot-layer,
.tap-grid {
  position: absolute;
  inset: 0;
}

.hotspot-button {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 2rpx solid rgba(243, 217, 157, 0.8);
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.18);
}

.tap-grid {
  display: flex;
  flex-direction: column;
}

.tap-row {
  display: flex;
  flex: 1;
  min-height: 1rpx;
}

.tap-cell {
  flex: 1;
  min-width: 1rpx;
  min-height: 1rpx;
}

.spot-marker {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46rpx;
  height: 46rpx;
  margin-left: -23rpx;
  margin-top: -23rpx;
  border: 3rpx solid #f3d99d;
  border-radius: 999rpx;
  background: rgba(13, 14, 17, 0.66);
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}

.code-input {
  min-height: 86rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.07);
  color: #fff8ea;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-panel {
  padding: 16rpx;
  color: rgba(247, 239, 221, 0.62);
  font-size: 23rpx;
}
</style>
