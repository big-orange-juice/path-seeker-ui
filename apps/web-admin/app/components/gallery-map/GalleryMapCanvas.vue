<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import type {
  GalleryMapCoordinate,
  GalleryMapPointRecord,
  GalleryMapRecord,
} from '@/types/gallery-map';
import GalleryMapPointMarker from '@/components/gallery-map/GalleryMapPointMarker.vue';
import { pointToPercent } from '@/utils/gallery-map-geometry';

interface Props {
  map: GalleryMapRecord | null;
  selectedPointId?: string;
  picking?: boolean;
  pending?: boolean;
  actionPending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selectedPointId: '',
  picking: false,
  pending: false,
  actionPending: false,
});

const emit = defineEmits<{
  selectPoint: [point: GalleryMapPointRecord];
  pickPosition: [coordinate: GalleryMapCoordinate];
  movePoint: [payload: { point: GalleryMapPointRecord; coordinate: GalleryMapCoordinate }];
}>();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const BUTTON_ZOOM_STEP = 0.15;
const WHEEL_ZOOM_SENSITIVITY = 0.001;
const WHEEL_DELTA_CAP = 40;

const stageRef = useTemplateRef<HTMLDivElement>('stage');
const viewportRef = useTemplateRef<HTMLDivElement>('viewport');
const imageFailed = shallowRef(false);
const zoom = shallowRef(1);
const panning = shallowRef(false);
const panOrigin = shallowRef<{
  pointerId: number;
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
} | null>(null);

const zoomPercentLabel = computed(() => `${Math.round(zoom.value * 100)}%`);
const canZoomIn = computed(() => zoom.value < MAX_ZOOM - 1e-6);
const canZoomOut = computed(() => zoom.value > MIN_ZOOM + 1e-6);
const canResetZoom = computed(() => Math.abs(zoom.value - 1) > 1e-6);
const isZoomed = computed(() => zoom.value > 1 + 1e-6);

const stageStyle = computed(() => ({
  '--map-zoom': String(zoom.value),
}));

const viewportCanPan = () => {
  const viewport = viewportRef.value;
  if (!viewport) {
    return false;
  }

  return (
    viewport.scrollWidth > viewport.clientWidth + 1
    || viewport.scrollHeight > viewport.clientHeight + 1
  );
};

const clampZoom = (value: number) => {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  return Math.round(clamped * 1000) / 1000;
};

const normalizeWheelDelta = (event: WheelEvent) => {
  let delta = event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= 16;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportRef.value?.clientHeight || 400;
  }

  return Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, delta));
};

const applyZoom = async (nextZoom: number, origin?: { clientX: number; clientY: number }) => {
  const viewport = viewportRef.value;
  const stage = stageRef.value;
  const previous = zoom.value;
  const clamped = clampZoom(nextZoom);
  if (clamped === previous) {
    return;
  }

  if (!viewport) {
    zoom.value = clamped;
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const focusClientX = origin?.clientX ?? viewportRect.left + viewportRect.width / 2;
  const focusClientY = origin?.clientY ?? viewportRect.top + viewportRect.height / 2;

  let relativeX = 0.5;
  let relativeY = 0.5;
  if (stage) {
    const before = stage.getBoundingClientRect();
    if (before.width > 0 && before.height > 0) {
      relativeX = (focusClientX - before.left) / before.width;
      relativeY = (focusClientY - before.top) / before.height;
    }
  }

  zoom.value = clamped;
  await nextTick();

  const nextStage = stageRef.value;
  if (!nextStage) {
    return;
  }

  const after = nextStage.getBoundingClientRect();
  const projectedX = after.left + relativeX * after.width;
  const projectedY = after.top + relativeY * after.height;
  viewport.scrollLeft += projectedX - focusClientX;
  viewport.scrollTop += projectedY - focusClientY;
};

const zoomBy = (delta: number, origin?: { clientX: number; clientY: number }) => {
  void applyZoom(zoom.value + delta, origin);
};

const zoomIn = () => {
  zoomBy(BUTTON_ZOOM_STEP);
};

const zoomOut = () => {
  zoomBy(-BUTTON_ZOOM_STEP);
};

const resetZoom = () => {
  void applyZoom(1);
};

watch(
  [() => props.map?.id, () => props.map?.imageUrl],
  () => {
    imageFailed.value = false;
    zoom.value = 1;
    panning.value = false;
    panOrigin.value = null;
  },
);

const handleImageError = () => {
  imageFailed.value = true;
};

const handleWheel = (event: WheelEvent) => {
  if (!props.map?.imageUrl || imageFailed.value || props.pending) {
    return;
  }

  const delta = normalizeWheelDelta(event);
  if (delta === 0) {
    return;
  }

  const factor = Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY);
  void applyZoom(zoom.value * factor, {
    clientX: event.clientX,
    clientY: event.clientY,
  });
};

const handleStageClick = (event: MouseEvent) => {
  if (!props.picking || !stageRef.value || panning.value) {
    return;
  }

  const coordinate = pointToPercent(event.clientX, event.clientY, stageRef.value.getBoundingClientRect());
  if (coordinate) {
    emit('pickPosition', coordinate);
  }
};

const handleMarkerMove = (payload: { point: GalleryMapPointRecord; clientX: number; clientY: number }) => {
  if (!stageRef.value || props.pending || props.picking || props.actionPending) {
    return;
  }

  const coordinate = pointToPercent(
    payload.clientX,
    payload.clientY,
    stageRef.value.getBoundingClientRect(),
  );
  if (coordinate) {
    emit('movePoint', {
      point: payload.point,
      coordinate,
    });
  }
};

const handlePointerDown = (event: PointerEvent) => {
  if (
    props.picking
    || props.pending
    || !props.map?.imageUrl
    || imageFailed.value
    || event.button !== 0
    || !viewportCanPan()
  ) {
    return;
  }

  const viewport = viewportRef.value;
  if (!viewport) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  target?.setPointerCapture(event.pointerId);
  panning.value = true;
  panOrigin.value = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  };
};

const handlePointerMove = (event: PointerEvent) => {
  const origin = panOrigin.value;
  const viewport = viewportRef.value;
  if (!panning.value || !origin || !viewport || origin.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  viewport.scrollLeft = origin.scrollLeft - (event.clientX - origin.clientX);
  viewport.scrollTop = origin.scrollTop - (event.clientY - origin.clientY);
};

const endPan = (event: PointerEvent) => {
  const origin = panOrigin.value;
  if (!origin || origin.pointerId !== event.pointerId) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  if (target?.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  panning.value = false;
  panOrigin.value = null;
};
</script>

<template>
  <div class="warm-panel warm-outline relative flex h-full min-h-0 flex-col overflow-hidden rounded-[0.95rem] border border-border/70">
    <div
      ref="viewport"
      class="map-scroll-area min-h-0 flex-1 overflow-auto p-3 sm:p-4"
      :class="panning ? 'cursor-grabbing select-none' : isZoomed ? 'cursor-grab' : ''"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="endPan"
      @pointercancel="endPan">
      <div
        v-if="props.pending"
        class="flex min-h-[min(100%,280px)] h-full w-full items-center justify-center text-sm text-muted-foreground">
        正在加载地图…
      </div>

      <div
        v-else-if="!props.map"
        class="flex min-h-[min(100%,280px)] h-full w-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 text-center text-sm text-muted-foreground">
        选择一个地图后，这里会展示地图背景图和展厅位置。
      </div>

      <div
        v-else-if="!props.map.imageUrl || imageFailed"
        class="flex min-h-[min(100%,280px)] h-full w-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 text-center text-sm text-muted-foreground">
        当前地图没有可用的地图背景图。
      </div>

      <div
        v-else
        class="map-scroll-content">
        <div
          ref="stage"
          class="map-stage relative overflow-hidden rounded-lg border border-border/70 bg-secondary/20"
          :class="props.picking && 'cursor-crosshair ring-1 ring-inset ring-primary/40'"
          :style="stageStyle"
          @click="handleStageClick">
          <img
            :src="props.map.imageUrl"
            :alt="`${props.map.galleryName || '展厅'}地图背景图`"
            class="map-stage-image block select-none object-contain"
            draggable="false"
            @error="handleImageError"
            @dragstart.prevent>

          <GalleryMapPointMarker
            v-for="point in props.map.points"
            :key="point.id"
            :point="point"
            :selected="point.id === props.selectedPointId"
            :picking="props.picking"
            :draggable="point.markerType === 1 && point.exhibits.length > 0 && !props.actionPending"
            :action-pending="props.actionPending"
            @select="emit('selectPoint', $event)"
            @move="handleMarkerMove" />

          <div
            v-if="!props.map.points.length"
            class="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md border border-border/70 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground">
            当前地图还没有点位
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="props.map?.imageUrl && !imageFailed && !props.pending"
      class="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-border/70 bg-background/95 p-1 shadow-sm sm:bottom-4 sm:right-4">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="pointer-events-auto h-7 w-7 px-0 text-sm"
        :disabled="!canZoomOut"
        title="缩小"
        aria-label="缩小"
        @click="zoomOut">
        −
      </Button>
      <span class="min-w-[2.75rem] select-none text-center text-xs tabular-nums text-muted-foreground">
        {{ zoomPercentLabel }}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="pointer-events-auto h-7 w-7 px-0 text-sm"
        :disabled="!canZoomIn"
        title="放大"
        aria-label="放大"
        @click="zoomIn">
        +
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="pointer-events-auto h-7 px-2 text-xs"
        :disabled="!canResetZoom"
        title="重置缩放"
        @click="resetZoom">
        重置
      </Button>
    </div>
  </div>
</template>

<style scoped>
.map-scroll-area {
  container-type: size;
}

.map-scroll-content {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 100%;
  min-height: 100%;
  width: max-content;
  height: max-content;
}

.map-stage {
  width: fit-content;
  line-height: 0;
}

.map-stage-image {
  width: auto;
  height: auto;
  max-width: calc(100cqw * var(--map-zoom, 1));
  max-height: calc(100cqh * var(--map-zoom, 1));
}

@supports not (max-height: 100cqh) {
  .map-stage-image {
    max-width: calc(100% * var(--map-zoom, 1));
    max-height: calc((100dvh - 14rem) * var(--map-zoom, 1));
  }
}
</style>
