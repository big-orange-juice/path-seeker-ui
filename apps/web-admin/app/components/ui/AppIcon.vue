<script setup lang="ts">
import { computed } from 'vue';
import {
  ChartColumn,
  Library,
  LibraryBig,
  Megaphone,
  Puzzle,
  Route,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-vue-next';

export type AppIconName =
  | 'bar-chart-3'
  | 'library'
  | 'library-big'
  | 'megaphone'
  | 'puzzle'
  | 'route'
  | 'user-round'
  | 'x';

interface Props {
  name: AppIconName;
  class?: string;
  strokeWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
  strokeWidth: 2,
});

const iconMap: Record<AppIconName, LucideIcon> = {
  'bar-chart-3': ChartColumn,
  library: Library,
  'library-big': LibraryBig,
  megaphone: Megaphone,
  puzzle: Puzzle,
  route: Route,
  'user-round': UserRound,
  x: X,
};

const iconComponent = computed(() => iconMap[props.name]);
</script>

<template>
  <component :is="iconComponent" :class="props.class" :stroke-width="props.strokeWidth" />
</template>