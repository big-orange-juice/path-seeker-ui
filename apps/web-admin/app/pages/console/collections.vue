<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import CollectionExhibitDialog from '@/components/collections/CollectionExhibitDialog.vue';
import CollectionExhibitDetailDialog from '@/components/collections/CollectionExhibitDetailDialog.vue';
import CollectionExhibitTable from '@/components/collections/CollectionExhibitTable.vue';
import CollectionSearchDialog from '@/components/collections/CollectionSearchDialog.vue';
import CulturalPlaceFormDialog from '@/components/museum-management/CulturalPlaceFormDialog.vue';
import type { CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';
import type {
  ExhibitDraft,
  ExhibitRecord,
  GalleryResponse,
  GalleryResponseListTotalPageResult,
  MuseumResponse,
  MuseumResponseListTotalPageResult,
} from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const actionFeedback = useActionFeedback();
const runtimeConfig = useRuntimeConfig();
const selectedMuseumId = shallowRef(String(runtimeConfig.public.museumId || '1').trim());
const { request } = useApiClient();

const { data: museumData, pending: museumPending } = useAsyncData(
  'exhibit-management:museums',
  () => request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 1000,
      keyword: null,
      status: null,
    },
  }),
  {
    default: () => ({
      list: [],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    }),
  }
);

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      // 下拉默认只展示名称；编码留给详情/表单（G-04）
      label: String(museum.name || museum.museumCode || museum.id).trim() || String(museum.id),
    }))
);

const selectedMuseum = computed(() => museumData.value.list.find((museum) => String(museum.id) === selectedMuseumId.value));
const isOutdoor = computed(() => [2, 3, 4].includes(selectedMuseum.value?.venueType ?? 1));
const contentLabel = computed(() => isOutdoor.value ? '景点' : '馆藏');

watch(
  museumOptions,
  (options) => {
    if (!options.length) {
      selectedMuseumId.value = '';
      return;
    }

    if (options.some((option) => option.value === selectedMuseumId.value)) {
      return;
    }

    selectedMuseumId.value = options[0]?.value ?? '';
  },
  { immediate: true }
);

const {
  museumId,
  filters,
  rows,
  pending,
  error,
  refresh,
  pageIndex,
  pageSize,
  sorting,
  total,
  totalPages,
  createEmptyDraft,
  createDraftFromRecord,
  getRecord,
  saveDraft,
  deleteExhibit,
  setPage,
  setPageSize,
  resetFilters,
  toggleSort,
} = useExhibitManagement(() => selectedMuseumId.value, () => isOutdoor.value);

const { data: galleryData } = useAsyncData(
  computed(() => `exhibit-management:galleries:${museumId.value}`),
  () => request<GalleryResponseListTotalPageResult<GalleryResponse>>('/api/map-management/galleries/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 1000,
      museumId: museumId.value,
    },
  }),
  {
    default: () => ({
      list: [],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    }),
    watch: [museumId],
  }
);

const galleryOptions = computed(() =>
  (galleryData.value.list ?? [])
    .filter((gallery) => gallery.id)
    .map((gallery) => ({
      label: [gallery.galleryCode, gallery.name].filter(Boolean).join(' / ') || String(gallery.id),
      value: String(gallery.id),
    }))
);

watch(
  [() => selectedMuseumId.value, galleryOptions],
  ([, options]) => {
    if (!filters.galleryId || filters.galleryId === '0') {
      return;
    }

    if (options.some((option) => option.value === filters.galleryId)) {
      return;
    }

    filters.galleryId = '';
  },
  { immediate: true }
);

const galleryLabelById = computed(() =>
  Object.fromEntries(galleryOptions.value.map((option) => [option.value, option.label]))
);

const formMode = shallowRef<'create' | 'edit'>('create');
const activeRecordId = shallowRef('');
const submitting = shallowRef(false);
const draftState = shallowRef<ExhibitDraft>(createEmptyDraft());
const dialogOpen = shallowRef(false);
const detailRecord = shallowRef<ExhibitRecord | null>(null);
const detailDialogOpen = shallowRef(false);
const placeDialogOpen = shallowRef(false);
const placeRecord = shallowRef<CulturalPlaceRecord | null>(null);
const placeError = shallowRef('');
const contentLoading = shallowRef(false);
let contentRequestVersion = 0;

/** AI 联网补充资料：复用导入的候选预览与确认流程（设计文档 §7） */
const searchDialog = shallowRef<{ openDialog: (preset?: { id: string; name: string; code?: string | null }) => void } | null>(null);
const searchExhibits = computed(() =>
  rows.value
    .filter((record) => record.contentType !== 'place')
    .map((record) => ({
      id: record.id,
      name: record.name || record.exhibitCode || record.id,
      code: record.exhibitCode ?? null,
    }))
);

watch(selectedMuseumId, () => {
  contentRequestVersion += 1;
  contentLoading.value = false;
  dialogOpen.value = false;
  placeDialogOpen.value = false;
  detailDialogOpen.value = false;
  resetFilters();
});

const toPlaceRecord = (record: ExhibitRecord): CulturalPlaceRecord => ({
  id: record.placeId ?? record.id,
  museumId: record.museumId,
  code: record.exhibitCode,
  name: record.name,
  category: record.category || null,
  address: record.addressText ?? null,
  description: record.description || null,
  recommendedMinutes: record.recommendedMinutes,
  longitude: record.longitude ?? null,
  latitude: record.latitude ?? null,
  coordinateSystem: record.coordinateSystem ?? 1,
  status: record.placeStatus ?? 1,
  coverAttachmentId: record.imageFileId,
  coverUrl: record.imageUrl,
  sortOrder: record.sortOrder,
  extraList: record.placeExtraList ?? [],
  archive: record.placeArchive ?? null,
});

const startCreate = () => {
  if (isOutdoor.value) {
    placeRecord.value = null;
    placeError.value = '';
    placeDialogOpen.value = true;
    return;
  }
  formMode.value = 'create';
  activeRecordId.value = '';
  draftState.value = createEmptyDraft();
  dialogOpen.value = true;
};

const loadContent = async (record: ExhibitRecord, mode: 'detail' | 'edit') => {
  if (submitting.value || contentLoading.value) return;
  const version = ++contentRequestVersion;
  contentLoading.value = true;
  try {
    const fullRecord = await getRecord(record.id);
    if (version !== contentRequestVersion) return;
    if (mode === 'detail') {
      detailRecord.value = fullRecord;
      detailDialogOpen.value = true;
    } else if (fullRecord.contentType === 'place') {
      placeRecord.value = toPlaceRecord(fullRecord);
      placeError.value = '';
      placeDialogOpen.value = true;
    } else {
      formMode.value = 'edit';
      activeRecordId.value = fullRecord.id;
      draftState.value = createDraftFromRecord(fullRecord);
      dialogOpen.value = true;
    }
  } catch (caughtError) {
    if (version === contentRequestVersion) actionFeedback.errorFrom(caughtError, '详情加载失败。');
  } finally {
    if (version === contentRequestVersion) contentLoading.value = false;
  }
};

const startEdit = (record: ExhibitRecord) => loadContent(record, 'edit');
const openDetail = (record: ExhibitRecord) => loadContent(record, 'detail');

const handlePlaceSave = async (draft: CulturalPlaceDraft) => {
  submitting.value = true;
  placeError.value = '';
  try {
    await request(draft.id ? '/api/cultural-place/update' : '/api/cultural-place/create', {
      method: 'POST',
      body: draft,
    });
    placeDialogOpen.value = false;
    actionFeedback.success('景点已保存。');
    await refresh();
  } catch (caughtError) {
    placeError.value = caughtError instanceof Error ? caughtError.message : '景点保存失败。';
  } finally {
    submitting.value = false;
  }
};

const handleSave = async (draft: ExhibitDraft) => {
  submitting.value = true;

  try {
    const savedId = await saveDraft(draft, formMode.value === 'edit' ? activeRecordId.value : undefined);
    activeRecordId.value = savedId;
    formMode.value = 'edit';
    draftState.value = {
      ...draft,
      id: savedId,
    };
    dialogOpen.value = false;
    actionFeedback.success('馆藏已保存。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '馆藏保存失败。');
  } finally {
    submitting.value = false;
  }
};

const handleRemove = async (record: ExhibitRecord) => {
  if (submitting.value || contentLoading.value) return;
  const label = record.contentType === 'place' ? '景点' : '馆藏';
  const confirmed = window.confirm('确认删除' + label + '“' + (record.name || record.exhibitCode || record.id) + '”吗？');
  if (!confirmed) {
    return;
  }

  submitting.value = true;

  try {
    await deleteExhibit(record.id);
    actionFeedback.success(label + '已删除。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, label + '删除失败。');
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="admin-page-frame flex flex-col gap-4">
    <div v-if="error" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '馆藏数据加载失败。' }}
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[280px] space-y-2">
          <label class="text-sm font-medium">所属场馆 / 目的地</label>
          <Select :model-value="selectedMuseumId" :disabled="submitting || museumPending || !museumOptions.length" @update:model-value="selectedMuseumId = $event">
            <option v-for="option in museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="min-w-[260px] flex-1 space-y-2">
          <label class="text-sm font-medium">关键词</label>
          <Input v-model="filters.keyword" :placeholder="'搜索' + contentLabel + '名称、编码、类别'" />
        </div>
        <div v-if="!isOutdoor" class="w-[180px] space-y-2">
          <label class="text-sm font-medium">年代筛选</label>
          <Input v-model="filters.dynasty" placeholder="如 商晚期 / 北宋" />
        </div>
        <div v-if="!isOutdoor" class="w-[260px] space-y-2">
          <label class="text-sm font-medium">展厅筛选</label>
          <Select :model-value="filters.galleryId" @update:model-value="filters.galleryId = $event">
            <option value="">全部展厅</option>
            <option value="0">未展览</option>
            <option v-for="option in galleryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div v-if="!isOutdoor" class="w-[180px] space-y-2">
          <label class="text-sm font-medium">重点筛选</label>
          <Select :model-value="String(filters.isHighlight)" @update:model-value="filters.isHighlight = Number($event)">
            <option value="-1">全部类型</option>
            <option value="1">重点展品</option>
            <option value="0">普通馆藏</option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button variant="outline" :disabled="submitting" @click="resetFilters">
            重置筛选
          </Button>
          <Button variant="outline" :disabled="submitting" @click="refresh()">
            刷新
          </Button>
          <Button
            variant="outline"
            :disabled="submitting || contentLoading || museumPending || !museumId"
            title="按公开资料来源补充典藏资料，结果进入候选条目待人工确认"
            @click="searchDialog?.openDialog()">
            AI 联网补充资料
          </Button>
          <Button :disabled="submitting || contentLoading || museumPending || !museumId" @click="startCreate">
            新增{{ contentLabel }}
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <p v-if="contentLoading" class="text-sm text-muted-foreground" role="status">正在加载详情…</p>
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页
        </div>
        <div class="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-muted-foreground">
          <span class="whitespace-nowrap">每页</span>
          <Select :model-value="String(pageSize)" class="w-[78px] shrink-0" @update:model-value="setPageSize(Number($event))">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex <= 1 || pending" @click="setPage(pageIndex - 1)">
            上一页
          </Button>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex >= Math.max(totalPages, 1) || pending" @click="setPage(pageIndex + 1)">
            下一页
          </Button>
        </div>
      </div>

      <CollectionExhibitTable
        :rows="rows"
        :pending="pending"
        :sorting="sorting"
        :gallery-label-by-id="galleryLabelById"
        :place-mode="isOutdoor"
        :busy="submitting || contentLoading"
        @sort="toggleSort"
        @detail="openDetail"
        @edit="startEdit"
        @remove="handleRemove" />
    </section>

    <CollectionExhibitDialog
      :open="dialogOpen"
      :mode="formMode"
      :initial-value="draftState"
      :submitting="submitting"
      :gallery-options="galleryOptions"
      @update:open="dialogOpen = $event"
      @save="handleSave" />

    <CollectionExhibitDetailDialog
      :open="detailDialogOpen"
      :record="detailRecord"
      :gallery-label-by-id="galleryLabelById"
      @update:open="detailDialogOpen = $event" />

    <CulturalPlaceFormDialog
      :open="placeDialogOpen"
      :museum-id="museumId"
      :record="placeRecord"
      :pending="submitting"
      :error="placeError"
      :require-coordinates="false"
      @update:open="placeDialogOpen = $event"
      @save="handlePlaceSave" />

    <CollectionSearchDialog
      ref="searchDialog"
      :museum-id="museumId"
      :exhibits="searchExhibits"
      @finished="refresh()" />
  </div>
</template>
