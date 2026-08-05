<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import Select from '@/components/shadcn/select/Select.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import GalleryMapCanvas from '@/components/gallery-map/GalleryMapCanvas.vue';
import GalleryMapPointDetail from '@/components/gallery-map/GalleryMapPointDetail.vue';
import GalleryMapSelector from '@/components/gallery-map/GalleryMapSelector.vue';
import type {
  GalleryMapCoordinate,
  GalleryMapGalleryOption,
  GalleryMapPointRecord,
  GalleryMapRecord,
  GalleryMapSummary,
} from '@/types/gallery-map';

interface MuseumOption {
  value: string;
  label: string;
}

interface Props {
  museumOptions?: MuseumOption[];
  museumId: string;
  museumPending?: boolean;
  galleries: GalleryMapGalleryOption[];
  maps: GalleryMapSummary[];
  galleryId: string;
  mapId: string;
  map: GalleryMapRecord | null;
  selectedPoint: GalleryMapPointRecord | null;
  galleryPending?: boolean;
  listPending?: boolean;
  detailPending?: boolean;
  picking?: boolean;
  pointActionPending?: boolean;
  canUndo?: boolean;
  undoPending?: boolean;
  undoLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  museumOptions: () => [],
  museumPending: false,
  galleryPending: false,
  listPending: false,
  detailPending: false,
  picking: false,
  pointActionPending: false,
  canUndo: false,
  undoPending: false,
  undoLabel: '撤销',
});

const emit = defineEmits<{
  'update:museumId': [value: string];
  'update:galleryId': [value: string];
  'update:mapId': [value: string];
  refresh: [];
  undo: [];
  startAdd: [];
  cancelPick: [];
  selectPoint: [point: GalleryMapPointRecord];
  pickPosition: [coordinate: GalleryMapCoordinate];
  movePoint: [payload: { point: GalleryMapPointRecord; coordinate: GalleryMapCoordinate }];
  editPoint: [point: GalleryMapPointRecord];
  removePoint: [point: GalleryMapPointRecord];
}>();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <section class="warm-panel warm-outline shrink-0 rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[240px] space-y-2 sm:w-[280px]">
          <label class="text-sm font-medium">所属博物馆</label>
          <Select
            :model-value="props.museumId"
            :disabled="props.museumPending || !props.museumOptions.length"
            @update:model-value="emit('update:museumId', $event)">
            <option v-if="!props.museumOptions.length" value="">暂无博物馆</option>
            <option v-for="option in props.museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>

        <GalleryMapSelector
          :galleries="props.galleries"
          :maps="props.maps"
          :gallery-id="props.galleryId"
          :map-id="props.mapId"
          :gallery-pending="props.galleryPending || props.museumPending || !props.museumId"
          :map-pending="props.listPending"
          @update:gallery-id="emit('update:galleryId', $event)"
          @update:map-id="emit('update:mapId', $event)" />

        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button
            v-if="!props.picking"
            :disabled="!props.map || !props.map.imageUrl || props.detailPending"
            @click="emit('startAdd')">
            <AppIcon name="map" class="h-4 w-4" />
            新增点位
          </Button>
          <Button v-else variant="secondary" @click="emit('cancelPick')">
            退出取点
          </Button>
          <Button
            variant="outline"
            :disabled="!props.canUndo || props.undoPending || props.pointActionPending || props.detailPending"
            :title="props.canUndo ? props.undoLabel : '暂无可撤销操作'"
            @click="emit('undo')">
            <AppIcon name="undo-2" class="h-4 w-4" />
            撤销
          </Button>
          <Button
            variant="outline"
            :disabled="props.listPending || props.detailPending"
            @click="emit('refresh')">
            刷新
          </Button>
        </div>
      </div>
    </section>

    <section class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="flex shrink-0 items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          <template v-if="props.map">
            {{ props.map.galleryName || '未命名展厅' }}
            · {{ props.map.pointCount }} 个点位
            <template v-if="props.map.imageWidth && props.map.imageHeight">
              · {{ props.map.imageWidth }} × {{ props.map.imageHeight }}
            </template>
          </template>
          <template v-else-if="props.galleryPending || props.listPending || props.detailPending">
            正在加载地图…
          </template>
          <template v-else-if="!props.galleries.length">
            暂无展厅
          </template>
          <template v-else-if="!props.maps.length">
            当前展厅暂无地图
          </template>
          <template v-else>
            请选择地图
          </template>
        </div>
        <span
          v-if="props.picking"
          class="shrink-0 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          点击底图取点
        </span>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <GalleryMapCanvas
          :map="props.map"
          :selected-point-id="props.selectedPoint?.id || ''"
          :picking="props.picking"
          :pending="props.detailPending"
          :action-pending="props.pointActionPending"
          @select-point="emit('selectPoint', $event)"
          @pick-position="emit('pickPosition', $event)"
          @move-point="emit('movePoint', $event)" />

        <GalleryMapPointDetail
          class="h-full min-h-0"
          :point="props.selectedPoint"
          :can-edit="props.selectedPoint?.markerType === 1"
          :action-pending="props.pointActionPending"
          @edit="emit('editPoint', $event)"
          @remove="emit('removePoint', $event)" />
      </div>
    </section>
  </div>
</template>
