<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bot,
  BarChart3,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Ellipsis,
  ImageUp,
  Library,
  LibraryBig,
  LoaderCircle,
  Lock,
  Map,
  Megaphone,
  Puzzle,
  RefreshCw,
  Route,
  Search,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-vue-next';

export type AppIconName =
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-up-down'
  | 'bar-chart-3'
  | 'bot'
  | 'circle-alert'
  | 'circle-check'
  | 'circle-help'
  | 'ellipsis'
  | 'image-up'
  | 'library'
  | 'library-big'
  | 'loader-circle'
  | 'lock'
  | 'map'
  | 'megaphone'
  | 'puzzle'
  | 'refresh-cw'
  | 'route'
  | 'search'
  | 'send'
  | 'sparkles'
  | 'trash-2'
  | 'undo-2'
  | 'user-round'
  | 'x'
  | 'zoom-in';

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
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-down': ArrowUpDown,
  'bar-chart-3': BarChart3,
  bot: Bot,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  ellipsis: Ellipsis,
  'image-up': ImageUp,
  library: Library,
  'library-big': LibraryBig,
  'loader-circle': LoaderCircle,
  lock: Lock,
  map: Map,
  megaphone: Megaphone,
  puzzle: Puzzle,
  'refresh-cw': RefreshCw,
  route: Route,
  search: Search,
  send: Send,
  sparkles: Sparkles,
  'trash-2': Trash2,
  'undo-2': Undo2,
  'user-round': UserRound,
  x: X,
  'zoom-in': ZoomIn,
};

const iconComponent = computed(() => iconMap[props.name]);
</script>

<template>
  <component :is="iconComponent" :class="props.class" :stroke-width="props.strokeWidth" />
</template>
