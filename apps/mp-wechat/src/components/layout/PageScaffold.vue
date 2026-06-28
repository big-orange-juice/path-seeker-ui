<script setup lang="ts">
import { useChromeMetrics } from "@/composables/useChromeMetrics"
import MiniNavBar from "@/components/navigation/MiniNavBar.vue"

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: "",
  showBack: true,
})

const { pageInsetStyle } = useChromeMetrics()
</script>

<template>
  <view class="safe-page">
    <MiniNavBar :title="title" :subtitle="subtitle" :show-back="showBack">
      <template #right>
        <slot name="nav-right"></slot>
      </template>
    </MiniNavBar>

    <scroll-view class="page-scroll" scroll-y>
      <view class="screen" :style="pageInsetStyle">
        <slot></slot>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.page-scroll {
  position: absolute;
  inset: 0;
  height: 100%;
  overflow: hidden;
}
</style>
