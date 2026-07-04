<script setup lang="ts">
import { computed } from 'vue';
import { useChromeMetrics } from '@/composables/useChromeMetrics';
import MiniNavBar from '@/components/navigation/MiniNavBar.vue';
import MiniTabBar from '@/components/navigation/MiniTabBar.vue';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showTabBar?: boolean;
  overlayNav?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  showBack: true,
  showTabBar: true,
  overlayNav: false
});

const { metrics, pageInsetStyle } = useChromeMetrics();

const contentStyle = computed(() => ({
  ...pageInsetStyle.value,
  paddingTop: props.overlayNav ? 0 : `${metrics.value.navHeight}px`
}));
</script>

<template>
  <view class="safe-page">
    <MiniNavBar :title="title" :subtitle="subtitle" :show-back="showBack">
      <template #right>
        <slot name="nav-right"></slot>
      </template>
    </MiniNavBar>

    <scroll-view class="page-content" :style="contentStyle" scroll-y enable-flex>
      <view class="page-inner">
        <slot></slot>
      </view>
    </scroll-view>

    <MiniTabBar v-if="showTabBar" />
  </view>
</template>

<style scoped lang="scss">
.page-content {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: transparent;
}

.page-inner {
  min-height: 100%;
  padding: 16rpx 20rpx 176rpx;
}
</style>
