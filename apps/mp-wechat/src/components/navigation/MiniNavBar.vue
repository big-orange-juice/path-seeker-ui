<script setup lang="ts">
import { computed } from "vue"
import { useChromeMetrics } from "@/composables/useChromeMetrics"

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
  backLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: "",
  showBack: false,
  backLabel: "返回",
})

const emit = defineEmits<{
  back: []
}>()

const { navStyle } = useChromeMetrics()

const showSubtitle = computed(() => Boolean(props.subtitle))

function handleBack() {
  emit("back")
  const pages = getCurrentPages()

  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }

  uni.reLaunch({ url: "/pages/shell/index" })
}
</script>

<template>
  <view class="nav-wrap" :style="navStyle">
    <view class="nav-row">
      <button v-if="showBack" class="nav-back" @click="handleBack">
        <text class="nav-back-arrow">‹</text>
        <text>{{ backLabel }}</text>
      </button>
      <view v-else class="nav-spacer"></view>

      <view class="nav-copy">
        <text class="nav-title">{{ title }}</text>
        <text v-if="showSubtitle" class="nav-subtitle">{{ subtitle }}</text>
      </view>

      <view class="nav-right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nav-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding-left: 20rpx;
  padding-right: 20rpx;
  background: linear-gradient(180deg, rgba(11, 12, 15, 0.98), rgba(11, 12, 15, 0.72), transparent);
  backdrop-filter: blur(14px);
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  gap: 10rpx;
}

.nav-back,
.nav-spacer {
  width: 112rpx;
}

.nav-right {
  width: 112rpx;
  display: flex;
  justify-content: flex-end;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4rpx;
  min-height: 68rpx;
  padding: 0 10rpx;
  border: 0;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.02);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: rgba(247, 239, 221, 0.82);
  font-size: 25rpx;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.nav-back::after {
  border: 0;
}

.nav-back-arrow {
  font-size: 42rpx;
  line-height: 1;
}

.nav-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  padding: 0 10rpx;
  text-align: center;
}

.nav-title {
  max-width: 100%;
  overflow: hidden;
  color: #fff8ea;
  font-size: 30rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-subtitle {
  max-width: 100%;
  overflow: hidden;
  color: rgba(247, 239, 221, 0.54);
  font-size: 21rpx;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
