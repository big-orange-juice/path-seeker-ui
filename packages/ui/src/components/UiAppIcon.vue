<script setup lang="ts">
import { computed } from "vue"
import {
  Archive,
  ArrowUpDown,
  Compass,
  Library,
  Map,
  Route,
  Search,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-vue-next"
import type { AppIconName } from "../types"

interface Props {
  name: AppIconName
  class?: string
  strokeWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  class: "",
  strokeWidth: 2,
})

const iconMap: Record<AppIconName, LucideIcon> = {
  archive: Archive,
  "arrow-up-down": ArrowUpDown,
  compass: Compass,
  library: Library,
  map: Map,
  route: Route,
  search: Search,
  sparkles: Sparkles,
  "user-round": UserRound,
}

const iconComponent = computed(() => iconMap[props.name])
</script>

<template>
  <component :is="iconComponent" :class="props.class" :stroke-width="props.strokeWidth" />
</template>
