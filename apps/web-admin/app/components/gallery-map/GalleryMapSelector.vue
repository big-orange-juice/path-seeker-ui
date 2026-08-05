<script setup lang="ts">
import type {
  GalleryMapGalleryOption,
  GalleryMapSummary,
} from '@/types/gallery-map';
import Select from '@/components/shadcn/select/Select.vue';

interface Props {
  galleries: GalleryMapGalleryOption[];
  maps: GalleryMapSummary[];
  galleryId: string;
  mapId: string;
  galleryPending?: boolean;
  mapPending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  galleryPending: false,
  mapPending: false,
});

const emit = defineEmits<{
  'update:galleryId': [value: string];
  'update:mapId': [value: string];
}>();
</script>

<template>
  <div class="contents">
    <div class="min-w-[240px] flex-1 space-y-2 sm:min-w-[280px]">
      <label class="text-sm font-medium">展厅</label>
      <Select
        :model-value="props.galleryId"
        :disabled="props.galleryPending"
        searchable
        search-placeholder="搜索展厅"
        empty-text="没有可用展厅"
        @update:model-value="emit('update:galleryId', $event)">
        <option value="">请选择展厅</option>
        <option v-for="gallery in props.galleries" :key="gallery.value" :value="gallery.value">
          {{ gallery.label }}
        </option>
      </Select>
    </div>

    <div class="min-w-[240px] flex-1 space-y-2 sm:min-w-[280px]">
      <label class="text-sm font-medium">地图</label>
      <Select
        :model-value="props.mapId"
        :disabled="props.mapPending || !props.galleryId"
        @update:model-value="emit('update:mapId', $event)">
        <option value="">请选择地图</option>
        <option
          v-for="map in props.maps"
          :key="map.id"
          :value="map.id">
          {{ map.sourceArticleCode || `地图 ${map.mapIndex}` }}{{ map.pointCount ? ` · ${map.pointCount} 个点位` : '' }}
        </option>
      </Select>
    </div>
  </div>
</template>
