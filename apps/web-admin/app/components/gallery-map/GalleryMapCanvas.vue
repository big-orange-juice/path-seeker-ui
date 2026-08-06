<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue';
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

const stageRef = useTemplateRef<HTMLDivElement>('stage');
const imageFailed = shallowRef(false);

watch(
  [() => props.map?.id, () => props.map?.imageUrl],
  () => {
    imageFailed.value = false;
  },
);

const handleImageError = () => {
  imageFailed.value = true;
};

const handleStageClick = (event: MouseEvent) => {
  if (!props.picking || !stageRef.value) {
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
</script>

<template>
  <div class="warm-panel warm-outline flex h-full min-h-0 flex-col overflow-hidden rounded-[0.95rem] border border-border/70">
    <div class="map-scroll-area flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
      <div
        v-if="props.pending"
        class="flex min-h-[280px] w-full flex-1 items-center justify-center text-sm text-muted-foreground">
        正在加载地图…
      </div>

      <div
        v-else-if="!props.map"
        class="flex min-h-[280px] w-full flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 text-center text-sm text-muted-foreground">
        选择一个地图后，这里会展示地图背景图和展厅位置。
      </div>

      <div
        v-else-if="!props.map.imageUrl || imageFailed"
        class="flex min-h-[280px] w-full flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 text-center text-sm text-muted-foreground">
        当前地图没有可用的地图背景图。
      </div>

      <div
        v-else
        ref="stage"
        class="map-stage relative overflow-hidden rounded-lg border border-border/70 bg-secondary/20"
        :class="props.picking && 'cursor-crosshair ring-1 ring-inset ring-primary/40'"
        @click="handleStageClick">
        <img
          :src="props.map.imageUrl"
          :alt="`${props.map.galleryName || '展厅'}地图背景图`"
          class="map-stage-image block select-none object-contain"
          draggable="false"
          @error="handleImageError">

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
</template>

<style scoped>
.map-scroll-area {
  container-type: size;
}

.map-stage {
  width: fit-content;
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
}

.map-stage-image {
  width: auto;
  height: auto;
  max-width: 100cqw;
  max-height: 100cqh;
}

@supports not (max-height: 100cqh) {
  .map-stage-image {
    max-width: 100%;
    max-height: calc(100dvh - 14rem);
  }
}
</style>
