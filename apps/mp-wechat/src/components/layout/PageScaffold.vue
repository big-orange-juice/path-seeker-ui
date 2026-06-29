<script setup lang="ts">
import { useChromeMetrics } from '@/composables/useChromeMetrics';
import MiniNavBar from '@/components/navigation/MiniNavBar.vue';
import MiniTabBar from '@/components/navigation/MiniTabBar.vue';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showTabBar?: boolean;
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  showBack: true,
  showTabBar: true
});

const { pageInsetStyle } = useChromeMetrics();
</script>

<template>
  <view class="safe-page">
    <MiniNavBar :title="title" :subtitle="subtitle" :show-back="showBack">
      <template #right>
        <slot name="nav-right"></slot>
      </template>
    </MiniNavBar>

    <view class="page-content" :style="pageInsetStyle">
      <slot></slot>
    </view>

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
</style>
