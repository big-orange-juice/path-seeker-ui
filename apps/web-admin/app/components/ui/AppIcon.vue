<script setup lang="ts">
import { computed } from 'vue';
import {
  ChartColumn,
  ImageUp,
  Library,
  LibraryBig,
  Map,
  Megaphone,
  Puzzle,
  Route,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-vue-next';

export type AppIconName =
  | 'bar-chart-3'
  | 'image-up'
  | 'library'
  | 'library-big'
  | 'map'
  | 'megaphone'
  | 'puzzle'
  | 'route'
  | 'trash-2'
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
  'image-up': ImageUp,
  library: Library,
  'library-big': LibraryBig,
  map: Map,
  megaphone: Megaphone,
  puzzle: Puzzle,
  route: Route,
  'trash-2': Trash2,
  'user-round': UserRound,
  x: X,
};

const iconComponent = computed(() => iconMap[props.name]);
</script>

<template>
  <component :is="iconComponent" :class="props.class" :stroke-width="props.strokeWidth" />
</template>
