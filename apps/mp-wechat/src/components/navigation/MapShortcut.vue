<script setup lang="ts">
import { computed } from "vue"
import AppIcon from "@/components/ui/AppIcon.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"

const missionStore = useMissionStore()

const shouldShow = computed(() => {
  if (!missionStore.activeSession) {
    return false
  }

  const pages = getCurrentPages()
  const currentRoute = pages[pages.length - 1]?.route
  return currentRoute !== MINI_ROUTES.chapterMap.replace(/^\//, "")
})

function openMap() {
  if (!missionStore.activeSession) {
    return
  }

  uni.navigateTo({ url: MINI_ROUTES.chapterMap })
}
</script>

<template>
  <button v-if="shouldShow" class="map-shortcut" @click="openMap">
    <view class="map-shortcut-mark">
      <AppIcon name="map" :size="18" />
    </view>
    <text class="map-shortcut-label">地图</text>
  </button>
</template>

<style scoped lang="scss">
.map-shortcut {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 104rpx;
  min-height: 52rpx;
  padding: 0 14rpx;
  border: 1px solid rgba(209, 178, 111, 0.34);
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.13);
  color: #fff8ea;
  box-shadow: 0 8rpx 22rpx rgba(209, 178, 111, 0.14);
}

.map-shortcut-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30rpx;
  height: 30rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
}

.map-shortcut-label {
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
}
</style>