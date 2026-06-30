<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { FloorMapDraft, FloorMapRecord } from '@/types/map-management';

const {
  maps,
  pending,
  error,
  createEmptyDraft,
  createDraftFromRecord,
  saveDraft,
  deleteMap,
} = useMapManagement();

const dialogOpen = shallowRef(false);
const dialogMode = shallowRef<'create' | 'edit'>('create');
const activeRecordId = shallowRef<string>('');
const draftState = shallowRef<FloorMapDraft>(createEmptyDraft());
const submitting = shallowRef(false);

const pageStats = computed(() => {
  const totalMaps = maps.value.length;
  const totalVenues = maps.value.reduce((count, record) => count + record.venues.length, 0);
  const withImages = maps.value.filter((record) => record.mapImages.length > 0).length;

  return [
    { label: '楼层地图', value: totalMaps },
    { label: '展馆条目', value: totalVenues },
    { label: '已上传底图', value: withImages },
  ];
});

const openCreateDialog = () => {
  dialogMode.value = 'create';
  activeRecordId.value = '';
  draftState.value = createEmptyDraft();
  dialogOpen.value = true;
};

const openEditDialog = (record: FloorMapRecord) => {
  dialogMode.value = 'edit';
  activeRecordId.value = record.id;
  draftState.value = createDraftFromRecord(record);
  dialogOpen.value = true;
};

const handleSave = async (draft: FloorMapDraft) => {
  submitting.value = true;

  try {
    await saveDraft(draft, dialogMode.value === 'edit' ? activeRecordId.value : undefined);
    dialogOpen.value = false;
  } finally {
    submitting.value = false;
  }
};

const handleRemove = async (record: FloorMapRecord) => {
  submitting.value = true;

  try {
    await deleteMap(record.id);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="warm-panel warm-outline overflow-hidden rounded-[1.6rem] border border-border/70">
        <div class="relative px-6 py-6 md:px-7 md:py-7">
          <div class="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top,rgba(209,178,111,0.18),transparent_62%)]" />
          <div class="relative space-y-3">
            <AdminPageHeader
              eyebrow="maps"
              title="地图管理"
              description="维护楼层基础信息、地图底图与展馆坐标，所有请求统一走 Nuxt server + middleware。" />
            <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
              楼层数据来自 `/api/Museum/Floors`，展馆数据来自 `/api/Gallery`，字段以后端 schema 为准。
            </p>
            <div class="flex flex-wrap gap-3 pt-1">
              <UiButton :disabled="submitting" @click="openCreateDialog">
                新增地图
              </UiButton>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <div
          v-for="item in pageStats"
          :key="item.label"
          class="warm-panel warm-outline rounded-[1.25rem] border border-border/70 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ item.label }}</p>
          <p class="mt-3 text-3xl font-semibold tracking-tight text-foreground">{{ item.value }}</p>
        </div>
      </div>
    </section>

    <div v-if="error" class="rounded-[1rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '楼层数据加载失败。' }}
    </div>

    <div v-if="pending" class="warm-panel warm-outline rounded-[1.25rem] border border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
      正在加载楼层数据...
    </div>

    <MapManagementCardGrid v-else :maps="maps" @edit="openEditDialog" @remove="handleRemove" />

    <MapManagementDialog
      :open="dialogOpen"
      :mode="dialogMode"
      :initial-value="draftState"
      @update:open="dialogOpen = $event"
      @save="handleSave" />
  </div>
</template>
