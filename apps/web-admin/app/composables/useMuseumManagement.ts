import { computed, reactive, toRefs } from 'vue';
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

  const { data, pending, error, refresh } = useAsyncData(
    'museum-management:list',
    () =>
      request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
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

  const museums = computed<MuseumRecord[]>(() =>
    (data.value.list ?? []).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
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
