import { computed, reactive, shallowRef, toValue, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useApiClient } from '@/composables/useApiClient';
import type {
  CreateExhibitPayload,
  ExhibitDraft,
  ExhibitPageRequest,
  ExhibitRecord,
  ExhibitResponse,
  ExhibitResponseListTotalPageResult,
  UpdateExhibitPayload,
} from '@/types/museum';

const DEFAULT_PAGE_SIZE = 10;

const toNullableId = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const normalizeText = (value: string) => value.trim();

const normalizeDraft = (draft: ExhibitDraft): ExhibitDraft => ({
  ...draft,
  exhibitCode: normalizeText(draft.exhibitCode),
  name: normalizeText(draft.name),
  dynasty: normalizeText(draft.dynasty),
  material: normalizeText(draft.material),
  category: normalizeText(draft.category),
  description: normalizeText(draft.description),
  showcaseNo: normalizeText(draft.showcaseNo),
  galleryId: toNullableId(draft.galleryId),
  isHighlight: draft.isHighlight ? 1 : 0,
  sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
});

const toPayload = (draft: ExhibitDraft): CreateExhibitPayload => ({
  museumId: draft.museumId,
  galleryId: toNullableId(draft.galleryId),
  exhibitCode: draft.exhibitCode,
  name: draft.name,
  dynasty: draft.dynasty || null,
  material: draft.material || null,
  category: draft.category || null,
  description: draft.description || null,
  imageUrl: toNullableId(draft.imageFileId ?? draft.imageUrl),
  isHighlight: draft.isHighlight,
  showcaseNo: draft.showcaseNo || null,
  recommendedMinutes: draft.recommendedMinutes,
  sortOrder: draft.sortOrder,
  extraList: draft.extraList.length ? draft.extraList : null,
  mediaList: draft.mediaList.length ? draft.mediaList : null,
});

export const useExhibitManagement = (
  museumIdSource?: string | null | undefined | (() => string | null | undefined)
) => {
  const runtimeConfig = useRuntimeConfig();
  const museumId = computed(() => {
    const sourceValue = museumIdSource === undefined
      ? runtimeConfig.public.museumId
      : toValue(museumIdSource);

    return String(sourceValue || '1').trim();
  });
  const { request } = useApiClient();

  const filters = reactive({
    keyword: '',
    dynasty: '',
    isHighlight: -1,
    galleryId: '',
  });

  const pageIndex = shallowRef(1);
  const pageSize = shallowRef(DEFAULT_PAGE_SIZE);
  const sorting = shallowRef<Array<{ id: string; desc: boolean }>>([{ id: 'sortOrder', desc: false }]);

  const queryPayload = computed<ExhibitPageRequest>(() => ({
    pageIndex: pageIndex.value,
    pageSize: pageSize.value,
    museumId: museumId.value,
    galleryId: filters.galleryId.trim() || null,
    dynasty: filters.dynasty.trim() || null,
    isHighlight: filters.isHighlight < 0 ? null : filters.isHighlight,
    keyword: filters.keyword.trim() || null,
  }));

  const { data, pending, error, refresh } = useAsyncData(
    computed(() => `exhibit-management:list:${museumId.value}`),
    () => request<ExhibitResponseListTotalPageResult<ExhibitResponse>>('/api/exhibit/query', {
      method: 'POST',
      body: queryPayload.value,
    }),
    {
      default: () => ({
        list: [],
        pageIndex: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      }),
      watch: [queryPayload],
    }
  );

  const rows = computed<ExhibitRecord[]>(() => {
    const list = (data.value.list ?? []).map((item) => {
      const rawItem = item as ExhibitResponse & Record<string, unknown>;

      return {
        id: item.id ?? uuidv4(),
        museumId: item.museumId ?? museumId.value,
        galleryId: item.galleryId ?? null,
        exhibitCode: item.exhibitCode ?? '',
        name: item.name ?? '',
        dynasty: item.dynasty ?? '',
        material: item.material ?? '',
        category: item.category ?? '',
        description: item.description ?? '',
        imageUrl: item.imageUrl,
        imageFileId: toNullableId(item.imageUrl),
        qrCode: item.qrCode ?? '',
        isHighlight: item.isHighlight ?? 0,
        showcaseNo: item.showcaseNo ?? '',
        recommendedMinutes: item.recommendedMinutes,
        sortOrder: item.sortOrder ?? 0,
        extraList: item.extraList ?? [],
        mediaList: item.mediaList ?? [],
        aiArchive: item.aiArchive ?? rawItem.aiAchive ?? rawItem.AIachive ?? null,
      };
    });

    const currentSorting = sorting.value[0];
    if (!currentSorting) {
      return list;
    }

    const nextList = [...list].sort((left, right) => {
      const leftValue = left[currentSorting.id as keyof ExhibitRecord];
      const rightValue = right[currentSorting.id as keyof ExhibitRecord];
      const leftText = String(leftValue ?? '');
      const rightText = String(rightValue ?? '');
      const result = leftText.localeCompare(rightText, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
      return currentSorting.desc ? -result : result;
    });

    return nextList;
  });

  const createEmptyDraft = (): ExhibitDraft => ({
    museumId: museumId.value,
    galleryId: null,
    exhibitCode: '',
    name: '',
    dynasty: '',
    material: '',
    category: '',
    description: '',
    imageUrl: null,
    imageFileId: null,
    isHighlight: 0,
    showcaseNo: '',
    recommendedMinutes: null,
    sortOrder: 0,
    extraList: [],
    mediaList: [],
  });

  const createDraftFromRecord = (record: ExhibitRecord): ExhibitDraft => ({
    id: record.id,
    museumId: record.museumId,
    galleryId: record.galleryId,
    exhibitCode: record.exhibitCode,
    name: record.name,
    dynasty: record.dynasty,
    material: record.material,
    category: record.category,
    description: record.description,
    imageUrl: record.imageUrl,
    imageFileId: record.imageFileId,
    isHighlight: record.isHighlight,
    showcaseNo: record.showcaseNo,
    recommendedMinutes: record.recommendedMinutes,
    sortOrder: record.sortOrder,
    extraList: record.extraList.map((item) => ({
      attrKey: item.attrKey ?? '',
      attrValue: item.attrValue,
      valueType: item.valueType,
      groupName: item.groupName,
      sortOrder: item.sortOrder,
    })),
    mediaList: record.mediaList.map((item) => ({
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl,
      title: item.title,
      sortOrder: item.sortOrder,
      status: item.status,
    })),
  });

  const setPage = (nextPage: number) => {
    const totalPages = Math.max(data.value.totalPages ?? 1, 1);
    pageIndex.value = Math.min(Math.max(nextPage, 1), totalPages);
  };

  const setPageSize = (nextPageSize: number) => {
    pageSize.value = nextPageSize;
    pageIndex.value = 1;
  };

  const resetFilters = () => {
    filters.keyword = '';
    filters.dynasty = '';
    filters.isHighlight = -1;
    filters.galleryId = '';
    pageIndex.value = 1;
  };

  const toggleSort = (columnId: string) => {
    const current = sorting.value[0];
    if (!current || current.id !== columnId) {
      sorting.value = [{ id: columnId, desc: false }];
      return;
    }

    if (!current.desc) {
      sorting.value = [{ id: columnId, desc: true }];
      return;
    }

    sorting.value = [{ id: 'sortOrder', desc: false }];
  };

  const saveDraft = async (draft: ExhibitDraft, targetId?: string) => {
    const normalized = normalizeDraft(draft);
    const basePayload = toPayload(normalized);
    let nextId = targetId ?? normalized.id ?? '';

    if (targetId) {
      await request('/api/exhibit/' + targetId, {
        method: 'PUT',
        body: {
          ...basePayload,
          id: targetId,
        } satisfies UpdateExhibitPayload,
      });
    } else {
      nextId = await request<string>('/api/exhibit', {
        method: 'POST',
        body: basePayload,
      });
    }

    await refresh();
    return nextId;
  };

  const deleteExhibit = async (id: string) => {
    await request('/api/exhibit/' + id, {
      method: 'DELETE',
    });

    await refresh();
  };

  watch([museumId, () => filters.keyword, () => filters.dynasty, () => filters.isHighlight, () => filters.galleryId], () => {
    pageIndex.value = 1;
  });

  return {
    museumId,
    filters,
    rows,
    pending,
    error,
    refresh,
    pageIndex,
    pageSize,
    sorting,
    total: computed(() => data.value.total ?? 0),
    totalPages: computed(() => data.value.totalPages ?? 0),
    createEmptyDraft,
    createDraftFromRecord,
    saveDraft,
    deleteExhibit,
    setPage,
    setPageSize,
    resetFilters,
    toggleSort,
  };
};
