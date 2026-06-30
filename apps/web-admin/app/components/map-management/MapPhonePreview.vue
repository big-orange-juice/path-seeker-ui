<script setup lang="ts">
import { computed } from 'vue';
import type { VenueDraft } from '@/types/map-management';

interface Props {
  venues: VenueDraft[];
  activeVenueId: string;
  pickingVenueId: string;
  draftPoint: { x: number; y: number } | null;
  mapImage?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  selectVenue: [targetId: string];
  capturePoint: [payload: { x: number; y: number }];
}>();

const activeVenue = computed(
  () =>
    props.venues.find((venue) => venue.id === props.activeVenueId) ??
    props.venues[0] ??
    null
);
const positionedVenues = computed(() =>
  props.venues.filter((venue) => venue.x !== null && venue.y !== null)
);
const isPicking = computed(() => Boolean(props.pickingVenueId));
const previewHeaderText = computed(() => {
  if (props.pickingVenueId) {
    return `正在取点：${activeVenue.value?.name || '未命名场馆'}`;
  }

  return activeVenue.value?.name || '选择场馆';
});

const handleMapClick = (event: MouseEvent) => {
  if (!props.mapImage || !props.pickingVenueId) {
    return;
  }

  const target = event.currentTarget as HTMLDivElement | null;
  if (!target) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return;
  }

  emit('capturePoint', { x: Math.round(x), y: Math.round(y) });
};
</script>

<template>
  <section class="space-y-4 rounded-[1.25rem] bg-[#0f1114] p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-foreground">模拟预览</h3>
        <p class="text-xs text-muted-foreground">
          先点“点击获取”，再在画面内落点。
        </p>
      </div>
      <div
        class="rounded-full bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
        {{ previewHeaderText }}
      </div>
    </div>

    <div class="rounded-[1.4rem] bg-[#14161a] p-3">
      <div
        class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ isPicking ? '点击画面获取坐标' : '选择场馆后可取点' }}</span>
        <span v-if="props.draftPoint">
          草稿：{{ props.draftPoint.x }}, {{ props.draftPoint.y }}
        </span>
      </div>

      <div
        class="relative aspect-[9/19.5] overflow-hidden rounded-[2.9rem] transition"
        :class="[
          props.mapImage
            ? 'cursor-crosshair bg-[#0f1115]'
            : 'cursor-not-allowed bg-[#0f1115]',
          isPicking ? 'ring-2 ring-primary/25' : 'ring-1 ring-white/8'
        ]"
        @click.stop="handleMapClick($event)">
        <img
          v-if="props.mapImage"
          :src="props.mapImage"
          alt="手机地图预览"
          class="absolute inset-0 h-full w-full object-cover" />
        <div
          class="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/48" />

        <template v-if="props.mapImage">
          <button
            v-for="venue in positionedVenues"
            :key="`${venue.id}-marker`"
            type="button"
            class="absolute -translate-x-1/2 -translate-y-1/2"
            :style="{ left: `${venue.x}px`, top: `${venue.y}px` }"
            @click.stop="emit('selectVenue', venue.id)">
            <span
              class="flex h-4 w-4 items-center justify-center rounded-full border border-white/70"
              :class="
                props.activeVenueId === venue.id
                  ? 'bg-primary shadow-[0_0_0_8px_rgba(209,178,111,0.18)]'
                  : 'bg-white/90'
              " />
          </button>

          <div
            v-if="props.draftPoint"
            class="absolute -translate-x-1/2 -translate-y-1/2"
            :style="{
              left: `${props.draftPoint.x}px`,
              top: `${props.draftPoint.y}px`
            }">
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full border border-primary bg-primary shadow-[0_0_0_8px_rgba(209,178,111,0.18)]" />
          </div>
        </template>

        <div
          class="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
          <div
            class="rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/92">
            {{ previewHeaderText }}
          </div>
        </div>

        <div
          v-if="!props.mapImage"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <UiAppIcon name="map" class="h-7 w-7 text-primary/80" />
          <p class="text-sm font-medium text-foreground">请先上传地图</p>
        </div>
      </div>
    </div>
  </section>
</template>
