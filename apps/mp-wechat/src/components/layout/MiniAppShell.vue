<script setup lang="ts">
import { useChromeMetrics } from "@/composables/useChromeMetrics"
import MiniNavBar from "@/components/navigation/MiniNavBar.vue"
import MiniTabBar from "@/components/navigation/MiniTabBar.vue"
import type { ShellTab } from "@/types/mission"

interface Props {
  title: string
  subtitle?: string
  tab: ShellTab
  canOpenMap?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: "",
  canOpenMap: false,
})

const emit = defineEmits<{
  "update:tab": [value: ShellTab]
  "open-map": []
}>()

const { pageInsetStyle } = useChromeMetrics()
</script>

<template>
  <view class="app-shell safe-page">
    <MiniNavBar :title="title" :subtitle="subtitle">
      <template #right>
        <slot name="nav-right"></slot>
      </template>
    </MiniNavBar>

    <scroll-view class="shell-scroll" scroll-y>
      <view class="screen" :style="pageInsetStyle">
        <slot></slot>
      </view>
    </scroll-view>

    <MiniTabBar :model-value="tab" :can-open-map="canOpenMap" @update:model-value="emit('update:tab', $event)" @open-map="emit('open-map')" />
  </view>
</template>

<style scoped lang="scss">
.shell-scroll {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: transparent;
  scrollbar-width: none;
}

.shell-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
