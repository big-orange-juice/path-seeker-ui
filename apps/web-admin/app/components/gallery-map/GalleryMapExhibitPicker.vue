<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useApiClient } from '@/composables/useApiClient';
import type { GalleryMapExhibitSelection } from '@/types/gallery-map';
import type {
  ExhibitResponse,
  ExhibitResponseListTotalPageResult,
} from '@/types/museum';

interface Props {
  museumId: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const selected = defineModel<GalleryMapExhibitSelection[]>({ default: () => [] });
const { request } = useApiClient();
const keyword = shallowRef('');
const results = shallowRef<GalleryMapExhibitSelection[]>([]);
const pending = shallowRef(false);
const error = shallowRef<Error | null>(null);

const selectedIds = computed(() => new Set(selected.value.map((item) => item.id)));
const selectedCodes = computed(() => new Set(selected.value.map((item) => item.exhibitCode)));

const normalizeCandidate = (item: ExhibitResponse): GalleryMapExhibitSelection | null => {
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  const exhibitCode = String(item.exhibitCode ?? '').trim();
  if (!id || !name || !exhibitCode) {
    return null;
  }

  return {
    id,
    exhibitId: id,
    name,
    exhibitCode,
    imageUrl: item.imageUrl ?? null,
    galleryId: item.galleryId ?? null,
    sourceExhibitName: name,
    sourceImageUrl: item.imageUrl ?? null,
    matchStatus: 1,
    matchMethod: 'manual',
  };
};

const searchExhibits = async () => {
  if (props.disabled || !props.museumId || pending.value) {
    return;
  }

  pending.value = true;
  error.value = null;

  try {
    const response = await request<ExhibitResponseListTotalPageResult<ExhibitResponse>>('/api/exhibit/query', {
      method: 'POST',
      body: {
        pageIndex: 1,
        pageSize: 20,
        museumId: props.museumId,
        galleryId: null,
        dynasty: null,
        isHighlight: null,
        keyword: keyword.value.trim() || null,
      },
    });

    results.value = (response.list ?? [])
      .map(normalizeCandidate)
      .filter((item): item is GalleryMapExhibitSelection => Boolean(item));
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError : new Error('文物搜索失败。');
  } finally {
    pending.value = false;
  }
};

const toggleSelection = (candidate: GalleryMapExhibitSelection) => {
  if (props.disabled) {
    return;
  }

  if (selectedIds.value.has(candidate.id)) {
    selected.value = selected.value.filter((item) => item.id !== candidate.id);
    return;
  }

  if (selectedCodes.value.has(candidate.exhibitCode)) {
    return;
  }

  selected.value = [...selected.value, candidate];
};

const removeSelection = (id: string) => {
  if (props.disabled) {
    return;
  }

  selected.value = selected.value.filter((item) => item.id !== id);
};
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1 space-y-1.5">
        <label class="text-xs font-medium">搜索系统文物</label>
        <Input
          v-model="keyword"
          :disabled="props.disabled"
          placeholder="输入文物名称或编码"
          @keydown.enter.prevent="searchExhibits" />
      </div>
      <Button
        type="button"
        variant="outline"
        :disabled="props.disabled || pending"
        @click="searchExhibits">
        <AppIcon v-if="pending" name="loader-circle" class="h-4 w-4 animate-spin" />
        <AppIcon v-else name="search" class="h-4 w-4" />
        搜索
      </Button>
    </div>

    <p v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {{ error.message || '文物搜索失败。' }}
    </p>

    <div v-if="selected.length" class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium text-primary/90">已选择文物</p>
        <span class="text-xs text-muted-foreground">{{ selected.length }} 件</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in selected"
          :key="item.id"
          class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          <span class="max-w-[220px] truncate">{{ item.name }}</span>
          <button
            type="button"
            class="rounded p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary"
            :disabled="props.disabled"
            :aria-label="`移除${item.name}`"
            @click="removeSelection(item.id)">
            <AppIcon name="x" class="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>

    <div class="max-h-56 overflow-y-auto rounded-lg border border-border/70 bg-secondary/15">
      <div v-if="!results.length" class="px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
        搜索后从已有文物中选择，至少绑定一件文物。
      </div>
      <button
        v-for="candidate in results"
        :key="candidate.id"
        type="button"
        class="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0"
        :class="selectedIds.has(candidate.id) || selectedCodes.has(candidate.exhibitCode) ? 'bg-primary/10' : 'hover:bg-secondary/70'"
        :disabled="props.disabled || (selectedCodes.has(candidate.exhibitCode) && !selectedIds.has(candidate.id))"
        @click="toggleSelection(candidate)">
        <img
          v-if="candidate.imageUrl"
          :src="candidate.imageUrl"
          :alt="candidate.name"
          class="h-10 w-10 shrink-0 rounded-md object-cover"
          loading="lazy">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground">{{ candidate.name }}</p>
          <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ candidate.exhibitCode }}</p>
        </div>
        <span class="shrink-0 text-xs text-primary">
          {{ selectedIds.has(candidate.id) ? '已选择' : selectedCodes.has(candidate.exhibitCode) ? '编码重复' : '选择' }}
        </span>
      </button>
    </div>
  </section>
</template>
