<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useChromeMetrics } from '@/composables/useChromeMetrics';
import { MINI_ROUTES } from '@/utils/navigation';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  showBack: false
});

const emit = defineEmits<{
  back: [];
}>();

const { navStyle } = useChromeMetrics();

const showSubtitle = computed(() => Boolean(props.subtitle));

function handleBack() {
  emit('back');
  const pages = getCurrentPages();

  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 });
    return;
  }

  uni.reLaunch({ url: MINI_ROUTES.home });
}
</script>

<template>
  <view class="nav-wrap" :style="navStyle">
    <view class="nav-row">
      <button v-if="showBack" class="nav-back" @click="handleBack">
        <AppIcon name="arrow-left" :size="32" class-name="nav-back-arrow" />
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
  background: linear-gradient(
    180deg,
    rgba(11, 12, 15, 0.48),
    rgba(11, 12, 15, 0.18),
    transparent
  );
  backdrop-filter: blur(48px);
  -webkit-backdrop-filter: blur(48px);
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
  width: 72rpx;
}

.nav-right {
  width: 72rpx;
  display: flex;
  justify-content: flex-end;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 64rpx;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none;
}

.nav-back::after {
  border: 0;
}

.nav-back-arrow {
  display: block;
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


