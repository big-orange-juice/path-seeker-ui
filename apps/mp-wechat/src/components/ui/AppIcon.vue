<script setup lang="ts">
import { computed } from "vue"

type AppIconName = "archive" | "arrow-left" | "map" | "marker" | "route"

interface Props {
  name: AppIconName
  size?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  className: "",
})

const iconPathMap: Record<AppIconName, string> = {
  archive: "/static/lucide/archive.svg",
  "arrow-left": "/static/lucide/arrow-left.svg",
  map: "/static/lucide/map.svg",
  marker: "/static/lucide/marker.svg",
  route: "/static/lucide/route.svg",
}

const iconStyle = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
}))

const iconSrc = computed(() => iconPathMap[props.name])
</script>

<template>
  <image
    :src="iconSrc"
    :class="['app-icon', props.className]"
    :style="iconStyle"
    mode="aspectFit" />
</template>

<style scoped lang="scss">
.app-icon {
  display: block;
}
</style>
