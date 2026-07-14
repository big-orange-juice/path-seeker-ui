<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bot,
  ChartColumn,
  ImageUp,
  Library,
  LibraryBig,
  LoaderCircle,
  Map,
  Megaphone,
  Puzzle,
  RefreshCw,
  Route,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-vue-next';

export type AppIconName =
  | 'arrow-down'
  | 'arrow-up'
  | 'arrow-up-down'
  | 'bar-chart-3'
  | 'bot'
  | 'image-up'
  | 'library'
  | 'library-big'
  | 'loader-circle'
  | 'map'
  | 'megaphone'
  | 'puzzle'
  | 'refresh-cw'
  | 'route'
  | 'send'
  | 'sparkles'
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
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'arrow-up-down': ArrowUpDown,
  'bar-chart-3': ChartColumn,
  bot: Bot,
  'image-up': ImageUp,
  library: Library,
  'library-big': LibraryBig,
  'loader-circle': LoaderCircle,
  map: Map,
  megaphone: Megaphone,
  puzzle: Puzzle,
  'refresh-cw': RefreshCw,
  route: Route,
  send: Send,
  sparkles: Sparkles,
  'trash-2': Trash2,
  'user-round': UserRound,
  x: X,
};

const iconComponent = computed(() => iconMap[props.name]);
</script>

<template>
  <component :is="iconComponent" :class="props.class" :stroke-width="props.strokeWidth" />
</template>
