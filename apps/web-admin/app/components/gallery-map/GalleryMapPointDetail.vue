<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import type {
  GalleryMapPointExhibitRecord,
  GalleryMapPointRecord,
} from '@/types/gallery-map';

interface Props {
  point: GalleryMapPointRecord | null;
  canEdit?: boolean;
  actionPending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: false,
  actionPending: false,
});

const emit = defineEmits<{
  edit: [point: GalleryMapPointRecord];
  remove: [point: GalleryMapPointRecord];
  openExhibit: [exhibit: GalleryMapPointExhibitRecord];
}>();

const canOpenExhibit = (exhibit: GalleryMapPointExhibitRecord) =>
  Boolean(String(exhibit.exhibitId || '').trim());

const markerTypeLabel = (markerType: number) => {
  if (markerType === 1) {
    return '文物点位';
  }

  if (markerType === 2) {
    return '展览说明';
  }

  return '未知点位';
};
</script>

<template>
  <aside class="warm-panel warm-outline flex h-full min-h-0 flex-col overflow-hidden rounded-[0.95rem] border border-border/70">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
      <p class="text-sm font-medium text-foreground">点位详情</p>
      <div v-if="props.point" class="flex shrink-0 items-center gap-1.5">
        <Button
          v-if="props.canEdit"
          type="button"
          size="sm"
          variant="ghost"
          :disabled="props.actionPending"
          @click="emit('edit', props.point)">
          编辑
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          class="text-destructive hover:text-destructive"
          :disabled="props.actionPending"
          @click="emit('remove', props.point)">
          {{ props.actionPending ? '处理中…' : '删除' }}
        </Button>
      </div>
    </div>

    <div
      v-if="!props.point"
      class="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      点击地图上的点位查看详情。
    </div>

    <div v-else class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {{ markerTypeLabel(props.point.markerType) }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ props.point.xPercent.toFixed(2) }}%, {{ props.point.yPercent.toFixed(2) }}%
            </span>
          </div>
          <h3 class="mt-2 text-base font-semibold tracking-tight text-foreground">
            {{ props.point.title || '未命名点位' }}
          </h3>
        </div>
      </div>

      <p class="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {{ props.point.description || '暂无点位说明。' }}
      </p>

      <div class="border-t border-border/70 pt-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-foreground">关联文物</p>
          <span class="rounded-full bg-secondary/70 px-2.5 py-0.5 text-xs text-muted-foreground">
            {{ props.point.exhibits.length }} 件
          </span>
        </div>

        <div v-if="props.point.exhibits.length" class="mt-3 space-y-2">
          <button
            v-for="exhibit in props.point.exhibits"
            :key="exhibit.id || `${exhibit.sourceExhibitCode}-${exhibit.sortOrder}`"
            type="button"
            class="flex w-full gap-3 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5 text-left transition-colors"
            :class="
              canOpenExhibit(exhibit)
                ? 'hover:border-primary/40 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : 'cursor-default opacity-90'
            "
            :title="canOpenExhibit(exhibit) ? '查看馆藏详情' : '尚未匹配馆藏，无法打开详情'"
            :disabled="!canOpenExhibit(exhibit)"
            @click="canOpenExhibit(exhibit) && emit('openExhibit', exhibit)">
            <img
              v-if="exhibit.sourceImageUrl"
              :src="exhibit.sourceImageUrl"
              :alt="exhibit.sourceExhibitName || '文物图片'"
              class="h-11 w-11 shrink-0 rounded-md object-cover"
              loading="lazy">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-foreground">
                {{ exhibit.exhibitName || exhibit.sourceExhibitName || '未命名文物' }}
              </p>
              <p class="mt-1 truncate text-xs text-muted-foreground">
                {{ exhibit.sourceExhibitCode || '未填写来源编码' }}
              </p>
              <p
                v-if="canOpenExhibit(exhibit)"
                class="mt-1 text-[11px] text-primary/90">
                点击查看详情
              </p>
              <p
                v-else
                class="mt-1 text-[11px] text-muted-foreground">
                未匹配馆藏
              </p>
            </div>
          </button>
        </div>

        <p v-else class="mt-3 text-sm text-muted-foreground">暂无关联文物。</p>
      </div>
    </div>
  </aside>
</template>
