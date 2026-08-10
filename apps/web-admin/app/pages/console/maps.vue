<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import CollectionExhibitDetailDialog from '@/components/collections/CollectionExhibitDetailDialog.vue';
import GalleryMapAnnotationDialog from '@/components/gallery-map/GalleryMapAnnotationDialog.vue';
import GalleryMapWorkspace from '@/components/gallery-map/GalleryMapWorkspace.vue';
import type {
  CreateGalleryMapAnnotationRequest,
  GalleryMapAnnotationRequest,
  GalleryMapCoordinate,
  GalleryMapPointExhibitRecord,
  GalleryMapPointRecord,
  UpdateGalleryMapAnnotationRequest,
} from '@/types/gallery-map';
import type {
  ExhibitRecord,
  ExhibitResponse,
  ExhibitResponseListTotalPageResult,
  MuseumResponse,
  MuseumResponseListTotalPageResult,
} from '@/types/museum';
import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';

definePageMeta({
  middleware: ['admin-auth', 'admin-only'],
});

type GalleryMapUndoEntry =
  | {
      type: 'relocate';
      label: string;
      pointId: string;
      from: GalleryMapCoordinate;
      point: GalleryMapPointRecord;
    }
  | {
      type: 'create';
      label: string;
      pointId: string;
    }
  | {
      type: 'update';
      label: string;
      previous: UpdateGalleryMapAnnotationRequest;
    }
  | {
      type: 'delete';
      label: string;
      restore: CreateGalleryMapAnnotationRequest;
    };

const UNDO_STACK_LIMIT = 30;

const route = useRoute();
const router = useRouter();
const actionFeedback = useActionFeedback();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const { request } = useApiClient();

const selectedMuseumId = shallowRef(String(runtimeConfig.public.museumId || '').trim());

const { data: museumData, pending: museumPending } = useAsyncData(
  'gallery-map:museums',
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
  },
);

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      label: String(museum.name || museum.museumCode || museum.id).trim() || String(museum.id),
    })),
);

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
  { immediate: true },
);

const {
  museumId,
  galleries,
  maps,
  currentMap,
  points,
  selectedGalleryId,
  selectedMapId,
  galleryPending,
  listPending,
  detailPending,
  error,
  initialize,
  selectGallery,
  selectMap,
  refreshCurrentMap,
  createAnnotation,
  updateAnnotation,
  buildUpdatePayloadFromPoint,
  buildCreatePayloadFromPoint,
  relocatePoint,
  deletePoint,
} = useGalleryMapManagement(() => selectedMuseumId.value);

const selectedPointId = shallowRef('');
const picking = shallowRef(false);
const annotationOpen = shallowRef(false);
const annotationMode = shallowRef<'create' | 'edit'>('create');
const editingPoint = shallowRef<GalleryMapPointRecord | null>(null);
const annotationCoordinate = shallowRef<GalleryMapCoordinate | null>(null);
const annotationSubmitting = shallowRef(false);
const pointActionPending = shallowRef(false);
const bootstrapped = shallowRef(false);
const undoStack = shallowRef<GalleryMapUndoEntry[]>([]);
const undoPending = shallowRef(false);
const deleteConfirmOpen = shallowRef(false);
const pendingDeletePoint = shallowRef<GalleryMapPointRecord | null>(null);

const exhibitDetailOpen = shallowRef(false);
const exhibitDetailRecord = shallowRef<ExhibitRecord | null>(null);
const exhibitDetailPending = shallowRef(false);

const galleryLabelById = computed(() =>
  Object.fromEntries(
    galleries.value.map((gallery) => [gallery.value, gallery.label || gallery.name || gallery.value]),
  ),
);

const mapExhibitResponse = (item: ExhibitResponse, fallbackMuseumId: string): ExhibitRecord => {
  const rawItem = item as ExhibitResponse & Record<string, unknown>;
  return {
    id: String(item.id ?? '').trim(),
    museumId: item.museumId ?? fallbackMuseumId,
    galleryId: item.galleryId ?? null,
    exhibitCode: item.exhibitCode ?? '',
    name: item.name ?? '',
    dynasty: item.dynasty ?? '',
    material: item.material ?? '',
    category: item.category ?? '',
    description: item.description ?? '',
    imageUrl: item.imageUrl,
    imageFileId: item.imageUrl ? String(item.imageUrl).trim() || null : null,
    qrCode: item.qrCode ?? '',
    isHighlight: item.isHighlight ?? 0,
    showcaseNo: item.showcaseNo ?? '',
    recommendedMinutes: item.recommendedMinutes,
    sortOrder: item.sortOrder ?? 0,
    extraList: item.extraList ?? [],
    mediaList: item.mediaList ?? [],
    aiArchive: item.aiArchive ?? rawItem.aiAchive ?? rawItem.AIachive ?? null,
  };
};

const fetchExhibitRecord = async (
  exhibit: GalleryMapPointExhibitRecord,
): Promise<ExhibitRecord | null> => {
  const exhibitId = String(exhibit.exhibitId || '').trim();
  if (!exhibitId) {
    return null;
  }

  const keyword =
    String(exhibit.sourceExhibitCode || '').trim()
    || String(exhibit.exhibitName || exhibit.sourceExhibitName || '').trim()
    || exhibitId;

  const response = await request<ExhibitResponseListTotalPageResult<ExhibitResponse>>('/api/exhibit/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 20,
      museumId: museumId.value || null,
      galleryId: null,
      dynasty: null,
      isHighlight: null,
      keyword,
    },
  });

  const list = response.list ?? [];
  const matched =
    list.find((item) => String(item.id ?? '').trim() === exhibitId)
    ?? list.find((item) => {
      const code = String(item.exhibitCode ?? '').trim();
      return code && code === String(exhibit.sourceExhibitCode || '').trim();
    })
    ?? null;

  if (!matched) {
    // 关键词未命中时再按编码/名称放宽一页
    const fallback = await request<ExhibitResponseListTotalPageResult<ExhibitResponse>>('/api/exhibit/query', {
      method: 'POST',
      body: {
        pageIndex: 1,
        pageSize: 50,
        museumId: museumId.value || null,
        galleryId: null,
        dynasty: null,
        isHighlight: null,
        keyword: exhibitId,
      },
    });
    const fallbackMatch = (fallback.list ?? []).find(
      (item) => String(item.id ?? '').trim() === exhibitId,
    );
    return fallbackMatch ? mapExhibitResponse(fallbackMatch, museumId.value) : null;
  }

  return mapExhibitResponse(matched, museumId.value);
};

const handleOpenExhibit = async (exhibit: GalleryMapPointExhibitRecord) => {
  const exhibitId = String(exhibit.exhibitId || '').trim();
  if (!exhibitId) {
    actionFeedback.error('该关联尚未匹配馆藏，无法打开详情。');
    return;
  }

  if (exhibitDetailPending.value) {
    return;
  }

  exhibitDetailPending.value = true;
  try {
    const record = await fetchExhibitRecord(exhibit);
    if (!record) {
      actionFeedback.error('未找到对应馆藏，请确认是否已匹配。');
      return;
    }
    exhibitDetailRecord.value = record;
    exhibitDetailOpen.value = true;
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '馆藏详情加载失败。');
  } finally {
    exhibitDetailPending.value = false;
  }
};

const readQueryString = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return '';
};

const selectedPoint = computed(() => points.value.find((point) => point.id === selectedPointId.value) ?? null);
const canUndo = computed(() => undoStack.value.length > 0);
const undoLabel = computed(() => {
  const entry = undoStack.value[undoStack.value.length - 1];
  return entry ? `撤销：${entry.label}` : '暂无可撤销操作';
});

const clearUndoStack = () => {
  undoStack.value = [];
};

const pushUndo = (entry: GalleryMapUndoEntry) => {
  undoStack.value = [...undoStack.value, entry].slice(-UNDO_STACK_LIMIT);
};

const clonePoint = (point: GalleryMapPointRecord): GalleryMapPointRecord => ({
  ...point,
  exhibits: point.exhibits.map((exhibit) => ({ ...exhibit })),
});

const syncRouteQuery = async (galleryId: string, mapId: string) => {
  await router.replace({
    query: {
      ...route.query,
      galleryId: galleryId || undefined,
      mapId: mapId || undefined,
    },
  });
};

const initializePage = async (options: { galleryId?: string; mapId?: string } = {}) => {
  if (!selectedMuseumId.value) {
    return;
  }

  try {
    await initialize({
      galleryId: options.galleryId ?? readQueryString(route.query.galleryId),
      mapId: options.mapId ?? readQueryString(route.query.mapId),
    });
    await syncRouteQuery(selectedGalleryId.value, selectedMapId.value);
  } catch (caughtError) {
    void caughtError;
  } finally {
    bootstrapped.value = true;
  }
};

watch(
  selectedMuseumId,
  async (nextMuseumId, previousMuseumId) => {
    if (!nextMuseumId) {
      return;
    }

    const isMuseumSwitch = Boolean(previousMuseumId) && previousMuseumId !== nextMuseumId;
    picking.value = false;
    selectedPointId.value = '';
    clearUndoStack();

    if (isMuseumSwitch) {
      await initializePage({ galleryId: '', mapId: '' });
      return;
    }

    if (!bootstrapped.value) {
      await initializePage();
    }
  },
  { immediate: true },
);

watch(
  points,
  (nextPoints) => {
    if (selectedPointId.value && !nextPoints.some((point) => point.id === selectedPointId.value)) {
      selectedPointId.value = '';
    }
  },
  { immediate: true },
);

const handleMuseumChange = (museumIdValue: string) => {
  selectedMuseumId.value = museumIdValue;
};

const handleGalleryChange = async (galleryId: string) => {
  picking.value = false;
  selectedPointId.value = '';
  clearUndoStack();

  try {
    await selectGallery(galleryId);
    await syncRouteQuery(selectedGalleryId.value, selectedMapId.value);
  } catch (caughtError) {
    void caughtError;
  }
};

const handleMapChange = async (mapId: string) => {
  selectedPointId.value = '';
  clearUndoStack();

  try {
    await selectMap(mapId);
    await syncRouteQuery(selectedGalleryId.value, selectedMapId.value);
  } catch (caughtError) {
    void caughtError;
  }
};

const handleRefresh = async () => {
  try {
    if (!selectedMapId.value) {
      await initializePage({
        galleryId: selectedGalleryId.value,
        mapId: '',
      });
      return;
    }

    await refreshCurrentMap();
  } catch (caughtError) {
    void caughtError;
  }
};

const startAdding = () => {
  if (!currentMap.value?.imageUrl) {
    actionFeedback.error('当前地图没有可用的地图背景图。');
    return;
  }

  selectedPointId.value = '';
  editingPoint.value = null;
  annotationMode.value = 'create';
  picking.value = true;
};

const cancelPicking = () => {
  picking.value = false;
};

const handlePickPosition = (coordinate: GalleryMapCoordinate) => {
  picking.value = false;
  editingPoint.value = null;
  annotationMode.value = 'create';
  annotationCoordinate.value = coordinate;
  annotationOpen.value = true;
};

const handleEditPoint = (point: GalleryMapPointRecord) => {
  if (annotationSubmitting.value || pointActionPending.value || point.markerType !== 1) {
    return;
  }

  picking.value = false;
  annotationMode.value = 'edit';
  editingPoint.value = clonePoint(point);
  annotationCoordinate.value = {
    xPercent: point.xPercent,
    yPercent: point.yPercent,
  };
  annotationOpen.value = true;
};

const handleRemovePoint = (point: GalleryMapPointRecord) => {
  if (pointActionPending.value || annotationSubmitting.value || undoPending.value) {
    return;
  }

  pendingDeletePoint.value = clonePoint(point);
  deleteConfirmOpen.value = true;
};

const handleDeleteConfirmOpenChange = (open: boolean) => {
  if (pointActionPending.value) {
    return;
  }

  deleteConfirmOpen.value = open;
  if (!open) {
    pendingDeletePoint.value = null;
  }
};

const submitRemovePoint = async () => {
  const point = pendingDeletePoint.value;
  if (!point || pointActionPending.value || annotationSubmitting.value || undoPending.value) {
    return;
  }

  const pointName = point.title || point.sourcePointCode || '当前点位';

  let restore: CreateGalleryMapAnnotationRequest;
  try {
    restore = buildCreatePayloadFromPoint(point);
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '无法准备撤销数据。');
    return;
  }

  pointActionPending.value = true;
  try {
    await deletePoint(point.id);
    selectedPointId.value = '';
    pushUndo({
      type: 'delete',
      label: `删除 ${pointName}`,
      restore,
    });
    deleteConfirmOpen.value = false;
    pendingDeletePoint.value = null;
    actionFeedback.success('文物点位已删除。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '文物点位删除失败。');
  } finally {
    pointActionPending.value = false;
  }
};

const handleMovePoint = async (payload: {
  point: GalleryMapPointRecord;
  coordinate: GalleryMapCoordinate;
}) => {
  if (pointActionPending.value || annotationSubmitting.value || picking.value || undoPending.value) {
    return;
  }

  const nextX = payload.coordinate.xPercent;
  const nextY = payload.coordinate.yPercent;
  if (
    Math.abs(nextX - payload.point.xPercent) < 0.000001
    && Math.abs(nextY - payload.point.yPercent) < 0.000001
  ) {
    return;
  }

  const from: GalleryMapCoordinate = {
    xPercent: payload.point.xPercent,
    yPercent: payload.point.yPercent,
  };
  const pointSnapshot = clonePoint(payload.point);
  const pointName = payload.point.title || payload.point.sourcePointCode || '点位';

  pointActionPending.value = true;
  selectedPointId.value = payload.point.id;

  try {
    await relocatePoint(payload.point, payload.coordinate);
    pushUndo({
      type: 'relocate',
      label: `移动 ${pointName}`,
      pointId: payload.point.id,
      from,
      point: pointSnapshot,
    });
    toast.success('点位位置已更新');
  } catch (caughtError) {
    toast.error(resolveHttpErrorMessage(caughtError, '点位位置更新失败'));
  } finally {
    pointActionPending.value = false;
  }
};

const handleAnnotationOpenChange = (open: boolean) => {
  if (annotationSubmitting.value) {
    return;
  }

  annotationOpen.value = open;
  if (!open) {
    annotationCoordinate.value = null;
    annotationMode.value = 'create';
    editingPoint.value = null;
  }
};

const handleSaveAnnotation = async (payload: GalleryMapAnnotationRequest) => {
  annotationSubmitting.value = true;

  try {
    if ('id' in payload) {
      const previousPoint = editingPoint.value;
      const previous = previousPoint
        ? buildUpdatePayloadFromPoint(previousPoint)
        : null;
      const pointId = await updateAnnotation(payload);
      if (previous) {
        pushUndo({
          type: 'update',
          label: `编辑 ${previous.title || previous.sourcePointCode || '点位'}`,
          previous,
        });
      }
      selectedPointId.value = pointId;
    } else {
      const pointId = await createAnnotation(payload);
      pushUndo({
        type: 'create',
        label: `新增 ${payload.title || payload.sourcePointCode || '点位'}`,
        pointId,
      });
      selectedPointId.value = pointId;
    }

    annotationOpen.value = false;
    annotationCoordinate.value = null;
    annotationMode.value = 'create';
    editingPoint.value = null;
    actionFeedback.success('文物点位已保存。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '文物点位保存失败。');
  } finally {
    annotationSubmitting.value = false;
  }
};

const handleUndo = async () => {
  if (undoPending.value || pointActionPending.value || annotationSubmitting.value) {
    return;
  }

  const stack = undoStack.value;
  const entry = stack[stack.length - 1];
  if (!entry) {
    return;
  }

  undoStack.value = stack.slice(0, -1);
  undoPending.value = true;
  pointActionPending.value = true;

  try {
    if (entry.type === 'relocate') {
      const livePoint = points.value.find((point) => point.id === entry.pointId) ?? entry.point;
      await relocatePoint(livePoint, entry.from);
      selectedPointId.value = entry.pointId;
      toast.success('已撤销点位移动');
      return;
    }

    if (entry.type === 'create') {
      await deletePoint(entry.pointId);
      if (selectedPointId.value === entry.pointId) {
        selectedPointId.value = '';
      }
      actionFeedback.success('已撤销新增点位。');
      return;
    }

    if (entry.type === 'update') {
      await updateAnnotation(entry.previous);
      selectedPointId.value = entry.previous.id;
      actionFeedback.success('已撤销点位编辑。');
      return;
    }

    const restoredId = await createAnnotation(entry.restore);
    selectedPointId.value = restoredId;
    actionFeedback.success('已撤销删除点位。');
  } catch (caughtError) {
    // 撤销失败时把条目放回栈顶，避免静默丢失
    undoStack.value = [...undoStack.value, entry].slice(-UNDO_STACK_LIMIT);
    actionFeedback.errorFrom(caughtError, '撤销失败。');
  } finally {
    undoPending.value = false;
    pointActionPending.value = false;
  }
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  const isUndoShortcut = (event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey;
  if (!isUndoShortcut || annotationOpen.value) {
    return;
  }

  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
    return;
  }

  if (!canUndo.value || undoPending.value || pointActionPending.value) {
    return;
  }

  event.preventDefault();
  void handleUndo();
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="admin-page-frame flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
    <div
      v-if="error"
      class="shrink-0 rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error.message || '地图数据加载失败。' }}</span>
        <button type="button" class="font-medium underline underline-offset-2" @click="handleRefresh">
          重试
        </button>
      </div>
    </div>

    <GalleryMapWorkspace
      class="min-h-0 flex-1 overflow-hidden"
      :museum-options="museumOptions"
      :museum-id="selectedMuseumId"
      :museum-pending="museumPending"
      :galleries="galleries"
      :maps="maps"
      :gallery-id="selectedGalleryId"
      :map-id="selectedMapId"
      :map="currentMap"
      :selected-point="selectedPoint"
      :gallery-pending="galleryPending"
      :list-pending="listPending"
      :detail-pending="detailPending"
      :picking="picking"
      :point-action-pending="pointActionPending || undoPending"
      :can-undo="canUndo"
      :undo-pending="undoPending"
      :undo-label="undoLabel"
      @update:museum-id="handleMuseumChange"
      @update:gallery-id="handleGalleryChange"
      @update:map-id="handleMapChange"
      @refresh="handleRefresh"
      @undo="handleUndo"
      @start-add="startAdding"
      @cancel-pick="cancelPicking"
      @select-point="selectedPointId = $event.id"
      @pick-position="handlePickPosition"
      @move-point="handleMovePoint"
      @edit-point="handleEditPoint"
      @remove-point="handleRemovePoint"
      @open-exhibit="handleOpenExhibit" />

    <CollectionExhibitDetailDialog
      v-model:open="exhibitDetailOpen"
      :record="exhibitDetailRecord"
      :gallery-label-by-id="galleryLabelById" />

    <GalleryMapAnnotationDialog
      :open="annotationOpen"
      :mode="annotationMode"
      :map-id="selectedMapId"
      :museum-id="museumId"
      :coordinate="annotationCoordinate"
      :point="editingPoint"
      :point-count="currentMap?.points.length ?? 0"
      :submitting="annotationSubmitting"
      @update:open="handleAnnotationOpenChange"
      @save="handleSaveAnnotation" />

    <Dialog :open="deleteConfirmOpen" @update:open="handleDeleteConfirmOpenChange">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle class="text-base font-semibold text-foreground">
            删除点位
          </DialogTitle>
          <DialogDescription class="text-sm leading-6 text-muted-foreground">
            确认删除「{{ pendingDeletePoint?.title || pendingDeletePoint?.sourcePointCode || '当前点位' }}」吗？删除后可在本页撤销恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 px-5 pb-4 pt-3">
          <Button
            variant="outline"
            type="button"
            :disabled="pointActionPending"
            @click="handleDeleteConfirmOpenChange(false)">
            取消
          </Button>
          <Button
            type="button"
            :disabled="pointActionPending || !pendingDeletePoint"
            @click="submitRemovePoint">
            {{ pointActionPending ? '删除中…' : '确认删除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
