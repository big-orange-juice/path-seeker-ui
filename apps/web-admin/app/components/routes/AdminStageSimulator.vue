<script setup lang="ts">
import { StagePlaySurface, type GameplayPreviewStage } from '@path-seeker/game-renderer'

const props = defineProps<{ stage: GameplayPreviewStage | null }>()
</script>

<template>
  <div class="route-device__chrome min-h-0 flex-1">
    <div class="route-device__screen">
      <div class="route-device__status" aria-hidden="true">
        <span class="route-device__time">9:41</span>
        <span class="route-device__island" />
        <span class="route-device__signal"><i /><i /><i /></span>
      </div>

      <div class="route-device__viewport">
        <StagePlaySurface
          v-if="props.stage"
          class="min-h-0"
          :stage="props.stage"
          :can-submit="false" />
        <div
          v-else
          class="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-white/45">
          点击左侧节点预览
        </div>
      </div>
    </div>

    <div class="route-device__home" aria-hidden="true" />
  </div>
</template>

<style scoped>
.route-device__chrome {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 2rem;
  border: 1px solid rgb(255 255 255 / 10%);
  background: linear-gradient(165deg, #2a2d34 0%, #14161b 42%, #0c0d10 100%);
  box-shadow: 0 12px 28px rgb(0 0 0 / 28%), inset 0 1px 0 rgb(255 255 255 / 8%), inset 0 0 0 1px rgb(0 0 0 / 35%);
  padding: 8px 8px 10px;
}

.route-device__screen {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.35rem;
  border: 1px solid rgb(255 255 255 / 6%);
  background: #0a0908;
}

.route-device__status {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 34px;
  padding: 8px 16px 0;
  color: rgb(255 255 255 / 78%);
  font-size: 11px;
  pointer-events: none;
}

.route-device__time { justify-self: start; font-weight: 600; }
.route-device__island { width: 86px; height: 22px; border-radius: 999px; background: #050506; }
.route-device__signal { display: flex; align-items: flex-end; justify-self: end; gap: 2px; height: 10px; }
.route-device__signal i { display: block; width: 3px; border-radius: 1px; background: rgb(255 255 255 / 72%); }
.route-device__signal i:nth-child(1) { height: 4px; }
.route-device__signal i:nth-child(2) { height: 6px; }
.route-device__signal i:nth-child(3) { height: 9px; }
.route-device__viewport {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 36px 14px 12px;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.route-device__viewport :deep(.stage-play) {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  flex: 0 0 auto;
  height: auto;
  overflow: visible;
}
.route-device__viewport :deep(.stage-play.is-narration) {
  min-height: max-content;
  flex: 0 0 auto;
  height: auto;
  max-height: none;
  overflow: visible;
}
.route-device__viewport :deep(.narration-shell),
.route-device__viewport :deep(.nr) {
  min-width: 0;
  flex: 0 0 auto;
}
.route-device__home {
  flex-shrink: 0;
  width: 96px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
}
</style>
