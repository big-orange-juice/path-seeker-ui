<script setup lang="ts">
import { computed, reactive, useTemplateRef } from 'vue';
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
  updateVenuePoint: [payload: { targetId: string; point: { x: number; y: number } }];
}>();

const previewRef = useTemplateRef<HTMLDivElement>('previewRef');
const dragState = reactive<{
  pointerId: number | null;
  targetId: string;
  mode: 'venue' | 'draft' | null;
}>({
  pointerId: null,
  targetId: '',
  mode: null,
});

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
    return `正在取点：${activeVenue.value?.name || '未命名展厅'}`;
  }

  return activeVenue.value?.name || '选择展厅';
});

const resolvePointFromEvent = (event: PointerEvent | MouseEvent) => {
  const target = previewRef.value;
  if (!target) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  const x = Math.round(Math.min(Math.max(event.clientX - rect.left, 0), rect.width));
  const y = Math.round(Math.min(Math.max(event.clientY - rect.top, 0), rect.height));
  return { x, y };
};

const handleMapClick = (event: MouseEvent) => {
  if (!props.mapImage || !props.pickingVenueId) {
    return;
  }

  const point = resolvePointFromEvent(event);
  if (!point) {
    return;
  }

  emit('capturePoint', point);
};

const startVenueDrag = (event: PointerEvent, targetId: string) => {
  if (!props.mapImage) {
    return;
  }

  const point = resolvePointFromEvent(event);
  if (!point) {
    return;
  }

  dragState.pointerId = event.pointerId;
  dragState.targetId = targetId;
  dragState.mode = 'venue';
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  emit('selectVenue', targetId);
  emit('updateVenuePoint', { targetId, point });
};

const startDraftDrag = (event: PointerEvent) => {
  if (!props.mapImage || !props.pickingVenueId) {
    return;
  }

  const point = resolvePointFromEvent(event);
  if (!point) {
    return;
  }

  dragState.pointerId = event.pointerId;
  dragState.targetId = props.pickingVenueId;
  dragState.mode = 'draft';
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  emit('capturePoint', point);
};

const handlePointerMove = (event: PointerEvent) => {
  if (!props.mapImage || dragState.pointerId !== event.pointerId) {
    return;
  }

  const point = resolvePointFromEvent(event);
  if (!point) {
    return;
  }

  if (dragState.mode === 'venue' && dragState.targetId) {
    emit('updateVenuePoint', {
      targetId: dragState.targetId,
      point,
    });
    return;
  }

  if (dragState.mode === 'draft') {
    emit('capturePoint', point);
  }
};

const stopDragging = () => {
  dragState.pointerId = null;
  dragState.targetId = '';
  dragState.mode = null;
};
</script>

<template>
  <section class="space-y-3 rounded-[0.95rem] bg-[#0f1114] p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-foreground">模拟预览</h3>
        <p class="text-xs text-muted-foreground">
          支持点击取点，也支持拖拽点位微调。
        </p>
      </div>
      <div
        class="rounded-full bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
        {{ previewHeaderText }}
      </div>
    </div>

    <div class="rounded-[1rem] bg-[#14161a] p-3">
      <div
        class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ isPicking ? '点击画面获取坐标' : '选择展厅后可取点' }}</span>
        <span v-if="props.draftPoint">
          草稿：{{ props.draftPoint.x }}, {{ props.draftPoint.y }}
        </span>
      </div>

      <div
        ref="previewRef"
        class="relative aspect-[9/19.5] overflow-hidden rounded-[2.9rem] transition"
        :class="[
          props.mapImage
            ? 'cursor-crosshair bg-[#0f1115]'
            : 'cursor-not-allowed bg-[#0f1115]',
          isPicking ? 'ring-2 ring-primary/25' : 'ring-1 ring-white/8'
        ]"
        @click.stop="handleMapClick($event)"
        @pointermove="handlePointerMove"
        @pointerup="stopDragging"
        @pointercancel="stopDragging"
        @pointerleave="stopDragging">
        <img
          v-if="props.mapImage"
          :src="props.mapImage"
          alt="手机地图预览"
          class="absolute inset-0 h-full w-full object-cover">
        <div
          class="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/48" />

        <template v-if="props.mapImage">
          <button
            v-for="venue in positionedVenues"
            :key="`${venue.id}-marker`"
            type="button"
            class="absolute -translate-x-1/2 -translate-y-1/2"
            :style="{ left: `${venue.x}px`, top: `${venue.y}px` }"
            @click.stop="emit('selectVenue', venue.id)"
            @pointerdown.stop="startVenueDrag($event, venue.id)">
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
            }"
            @pointerdown.stop="startDraftDrag($event)">
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
          <p class="text-sm font-medium">请先上传地图</p>
        </div>
      </div>
    </div>
  </section>
</template>
