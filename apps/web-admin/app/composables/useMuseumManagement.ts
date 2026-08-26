import { computed, reactive, shallowRef, toRefs, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useApiClient } from '@/composables/useApiClient';
import type {
  CreateMuseumPayload,
  MuseumDraft,
  MuseumPageRequest,
  MuseumRecord,
  MuseumResponse,
  MuseumResponseListTotalPageResult,
  UpdateMuseumPayload,
} from '@/types/museum';

const DEFAULT_STATUS = 1;
const DEFAULT_PAGE_SIZE = 20;

const createEmptyPageResult = (): MuseumResponseListTotalPageResult<MuseumResponse> => ({
  list: [],
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
});

const toNullableId = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  return normalized;
};

const normalizeText = (value: string) => value.trim();

const normalizeDraft = (draft: MuseumDraft): MuseumDraft => ({
  ...draft,
  museumCode: normalizeText(draft.museumCode),
  name: normalizeText(draft.name),
  address: normalizeText(draft.address),
  openingHours: normalizeText(draft.openingHours),
  closedDay: normalizeText(draft.closedDay),
  reservationInfo: normalizeText(draft.reservationInfo),
  officialWebsite: normalizeText(draft.officialWebsite),
  wechatAccount: normalizeText(draft.wechatAccount),
  contactPhone: normalizeText(draft.contactPhone),
  intro: normalizeText(draft.intro),
  status: draft.status || DEFAULT_STATUS,
});

const toPayload = (draft: MuseumDraft): CreateMuseumPayload => ({
  museumCode: draft.museumCode,
  name: draft.name,
  address: draft.address || null,
  openingHours: draft.openingHours || null,
  closedDay: draft.closedDay || null,
  reservationInfo: draft.reservationInfo || null,
  officialWebsite: draft.officialWebsite || null,
  wechatAccount: draft.wechatAccount || null,
  contactPhone: draft.contactPhone || null,
  longitude: draft.longitude,
  latitude: draft.latitude,
  landArea: draft.landArea,
  buildingArea: draft.buildingArea,
  exhibitionArea: draft.exhibitionArea,
  floorsAbove: draft.floorsAbove,
  floorsBelow: draft.floorsBelow,
  intro: draft.intro || null,
  coverImageUrl: toNullableId(draft.coverImageFileId),
  status: draft.status,
  venueType: draft.venueType ?? 1,
  coordinateSystem: draft.coordinateSystem ?? 1,
  mapProvider: draft.mapProvider ?? null,
  boundaryGeoJson: draft.boundaryGeoJson || null,
});

const createEmptyDraftValue = (): MuseumDraft => ({
  museumCode: '',
  name: '',
  address: '',
  openingHours: '',
  closedDay: '',
  reservationInfo: '',
  officialWebsite: '',
  wechatAccount: '',
  contactPhone: '',
  longitude: null,
  latitude: null,
  landArea: null,
  buildingArea: null,
  exhibitionArea: null,
  floorsAbove: null,
  floorsBelow: null,
  intro: '',
  coverImageUrl: null,
  coverImageFileId: null,
  status: DEFAULT_STATUS,
  venueType: 1,
  coordinateSystem: 1,
  mapProvider: null,
  boundaryGeoJson: null,
});

export const useMuseumManagement = () => {
  const { request } = useApiClient();
  const filters = reactive({
    keyword: '',
    status: 0,
  });

  const queryPayload = computed<MuseumPageRequest>(() => ({
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    keyword: filters.keyword.trim() || null,
    status: filters.status || null,
  }));

  const data = shallowRef(createEmptyPageResult());
  const pending = shallowRef(false);
  const error = shallowRef<Error | null>(null);
  let requestVersion = 0;

  const refresh = async () => {
    const currentVersion = ++requestVersion;
    const payload = { ...queryPayload.value };
    pending.value = true;
    error.value = null;
    try {
      const result = await request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
        method: 'POST',
        body: payload,
      });
      if (currentVersion !== requestVersion) return;
      data.value = result;
    } catch (caught) {
      if (currentVersion !== requestVersion) return;
      error.value = caught instanceof Error ? caught : new Error('博物馆数据加载失败。');
    } finally {
      if (currentVersion === requestVersion) pending.value = false;
    }
  };

  watch(queryPayload, () => {
    if (import.meta.client) void refresh();
  }, { immediate: true });

  const museums = computed<MuseumRecord[]>(() =>
    (data.value.list ?? []).map((item) => ({
      id: item.id ?? uuidv4(),
      museumCode: item.museumCode ?? '',
      name: item.name ?? '',
      address: item.address ?? '',
      openingHours: item.openingHours ?? '',
      closedDay: item.closedDay ?? '',
      reservationInfo: item.reservationInfo ?? '',
      officialWebsite: item.officialWebsite ?? '',
      wechatAccount: item.wechatAccount ?? '',
      contactPhone: item.contactPhone ?? '',
      longitude: item.longitude,
      latitude: item.latitude,
      landArea: item.landArea,
      buildingArea: item.buildingArea,
      exhibitionArea: item.exhibitionArea,
      floorsAbove: item.floorsAbove,
      floorsBelow: item.floorsBelow,
      intro: item.intro ?? '',
      coverImageUrl: item.coverImageUrl,
      coverImageFileId: toNullableId(item.coverImageUrl),
      status: item.status ?? DEFAULT_STATUS,
      venueType: item.venueType ?? 1,
      coordinateSystem: item.coordinateSystem ?? 1,
      mapProvider: item.mapProvider ?? null,
      boundaryGeoJson: item.boundaryGeoJson ?? null,
    }))
  );

  const createEmptyDraft = () => createEmptyDraftValue();

  const createDraftFromRecord = (record: MuseumRecord): MuseumDraft => ({
    id: record.id,
    museumCode: record.museumCode,
    name: record.name,
    address: record.address,
    openingHours: record.openingHours,
    closedDay: record.closedDay,
    reservationInfo: record.reservationInfo,
    officialWebsite: record.officialWebsite,
    wechatAccount: record.wechatAccount,
    contactPhone: record.contactPhone,
    longitude: record.longitude,
    latitude: record.latitude,
    landArea: record.landArea,
    buildingArea: record.buildingArea,
    exhibitionArea: record.exhibitionArea,
    floorsAbove: record.floorsAbove,
    floorsBelow: record.floorsBelow,
    intro: record.intro,
    coverImageUrl: record.coverImageUrl,
    coverImageFileId: record.coverImageFileId,
    status: record.status,
    venueType: record.venueType,
    coordinateSystem: record.coordinateSystem,
    mapProvider: record.mapProvider,
    boundaryGeoJson: record.boundaryGeoJson,
  });

  const saveDraft = async (draft: MuseumDraft, targetId?: string) => {
    const normalized = normalizeDraft(draft);
    const basePayload = toPayload(normalized);
    let nextId = targetId ?? normalized.id ?? '';

    if (targetId) {
      await request('/api/museum-management/' + targetId, {
        method: 'PUT',
        body: {
          ...basePayload,
          id: targetId,
        } satisfies UpdateMuseumPayload,
      });
    } else {
      nextId = await request<string>('/api/museum-management', {
        method: 'POST',
        body: basePayload,
      });
    }

    await refresh();
    return nextId;
  };

  const deleteMuseum = async (id: string) => {
    await request('/api/museum-management/' + id, {
      method: 'DELETE',
    });

    await refresh();
  };

  return {
    ...toRefs(filters),
    museums,
    pending,
    error,
    refresh,
    total: computed(() => data.value.total ?? 0),
    totalPages: computed(() => data.value.totalPages ?? 0),
    createEmptyDraft,
    createDraftFromRecord,
    saveDraft,
    deleteMuseum,
  };
};
