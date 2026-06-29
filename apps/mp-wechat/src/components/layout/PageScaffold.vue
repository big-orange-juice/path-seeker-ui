<script setup lang="ts">
import { useChromeMetrics } from "@/composables/useChromeMetrics"
import MiniNavBar from "@/components/navigation/MiniNavBar.vue"
import MiniTabBar from "@/components/navigation/MiniTabBar.vue"

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
  showTabBar?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: "",
  showBack: true,
  showTabBar: true,
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

    <MiniTabBar v-if="showTabBar" />
  </view>
</template>

<style scoped lang="scss">
.page-scroll {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: transparent;
  scrollbar-width: none;
}

.page-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
