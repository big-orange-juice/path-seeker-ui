import { computed, shallowRef, toValue, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useApiClient } from '@/composables/useApiClient';
import type { FloorMapDraft, FloorMapRecord, VenueDraft } from '@/types/map-management';
import type {
  CreateFacilityPayload,
  CreateFloorPayload,
  CreateGalleryPayload,
  FacilityResponse,
  FloorResponse,
  FloorResponseListTotalPageResult,
  GalleryPageRequest,
  GalleryResponse,
  GalleryResponseListTotalPageResult,
  MuseumFacilityDraft,
  MuseumFacilityRecord,
  MuseumFloorDraft,
  MuseumFloorRecord,
  MuseumGalleryDraft,
  MuseumGalleryRecord,
  UpdateFacilityPayload,
  UpdateFloorPayload,
  UpdateGalleryPayload,
} from '@/types/museum';

const DEFAULT_GALLERY_CATEGORY = 1;
const DEFAULT_OPEN_STATUS = 1;
const DEFAULT_FACILITY_TYPE = 99;

const createEmptyVenue = (): VenueDraft => ({
  id: uuidv4(),
  galleryCode: '',
  name: '',
  subtitle: '',
  category: DEFAULT_GALLERY_CATEGORY,
  description: '',
  exhibitCount: null,
  area: null,
  coverImageUrl: null,
  coverImageFileId: null,
  openStatus: DEFAULT_OPEN_STATUS,
  x: null,
  y: null,
  sortOrder: 0,
});

const toIdString = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '').trim();
  return normalized;
};

const toNullableId = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  return normalized;
};

const trim = (value: string) => value.trim();
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const normalizeList = <T>(value: unknown): T[] =>
  Array.isArray(value) ? value.filter(isObjectRecord) as T[] : [];

const normalizePagedList = <T>(value: unknown) => {
  if (!isObjectRecord(value)) {
    return {
      list: [] as T[],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    };
  }

  return {
    list: normalizeList<T>(value.list),
    pageIndex: typeof value.pageIndex === 'number' ? value.pageIndex : 1,
    pageSize: typeof value.pageSize === 'number' ? value.pageSize : 1000,
    total: typeof value.total === 'number' ? value.total : 0,
    totalPages: typeof value.totalPages === 'number' ? value.totalPages : 0,
  };
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.statusMessage === 'string' && record.statusMessage.trim()) {
      return record.statusMessage;
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }

  return fallback;
};

export const useMuseumWorkbench = (
  museumIdSource: string | number | null | undefined | (() => string | number | null | undefined),
  sectionSource?: 'floors' | 'galleries' | 'facilities' | (() => 'floors' | 'galleries' | 'facilities')
) => {
  const { request } = useApiClient();
  const museumId = computed(() => toIdString(toValue(museumIdSource)));
  const activeSection = computed<'floors' | 'galleries' | 'facilities'>(() => {
    const resolved = typeof sectionSource === 'function' ? toValue(sectionSource) : sectionSource;
    if (resolved === 'galleries' || resolved === 'facilities') {
      return resolved;
    }

    return 'floors';
  });

  const floorsData = shallowRef<FloorResponse[]>([]);
  const galleriesData = shallowRef<GalleryResponse[]>([]);
  const facilitiesData = shallowRef<FacilityResponse[]>([]);

  const floorsPending = shallowRef(false);
  const galleriesPending = shallowRef(false);
  const facilitiesPending = shallowRef(false);

  const floorsError = shallowRef<unknown>(null);
  const galleriesError = shallowRef<unknown>(null);
  const facilitiesError = shallowRef<unknown>(null);

  const floorsLoadedMuseumId = shallowRef('');
  const galleriesLoadedMuseumId = shallowRef('');
  const facilitiesLoadedMuseumId = shallowRef('');

  const resetResourceState = () => {
    floorsData.value = [];
    galleriesData.value = [];
    facilitiesData.value = [];
    floorsPending.value = false;
    galleriesPending.value = false;
    facilitiesPending.value = false;
    floorsError.value = null;
    galleriesError.value = null;
    facilitiesError.value = null;
    floorsLoadedMuseumId.value = '';
    galleriesLoadedMuseumId.value = '';
    facilitiesLoadedMuseumId.value = '';
  };

  const loadFloors = async (options: { force?: boolean } = {}) => {
    if (!museumId.value) {
      floorsData.value = [];
      floorsError.value = null;
      floorsLoadedMuseumId.value = '';
      return;
    }

    if (!options.force && (floorsPending.value || floorsLoadedMuseumId.value === museumId.value)) {
      return;
    }

    floorsPending.value = true;
    floorsError.value = null;

    try {
      const response = await request<FloorResponse[] | FloorResponseListTotalPageResult<FloorResponse>>('/api/map-management/floors', {
        query: { museumId: museumId.value },
      });
      floorsData.value = Array.isArray(response)
        ? normalizeList<FloorResponse>(response)
        : normalizePagedList<FloorResponse>(response).list;
      floorsLoadedMuseumId.value = museumId.value;
    } catch (error) {
      floorsData.value = [];
      floorsError.value = error;
      floorsLoadedMuseumId.value = '';
    } finally {
      floorsPending.value = false;
    }
  };

  const loadGalleries = async (options: { force?: boolean } = {}) => {
    if (!museumId.value) {
      galleriesData.value = [];
      galleriesError.value = null;
      galleriesLoadedMuseumId.value = '';
      return;
    }

    if (!options.force && (galleriesPending.value || galleriesLoadedMuseumId.value === museumId.value)) {
      return;
    }

    galleriesPending.value = true;
    galleriesError.value = null;

    try {
      const response = await request<GalleryResponseListTotalPageResult<GalleryResponse>>(
        '/api/map-management/galleries/query',
        {
          method: 'POST',
          body: {
            pageIndex: 1,
            pageSize: 1000,
            museumId: museumId.value,
          } satisfies GalleryPageRequest,
        }
      );

      galleriesData.value = normalizePagedList<GalleryResponse>(response).list;
      galleriesLoadedMuseumId.value = museumId.value;
    } catch (error) {
      galleriesData.value = [];
      galleriesError.value = error;
      galleriesLoadedMuseumId.value = '';
    } finally {
      galleriesPending.value = false;
    }
  };

  const loadFacilities = async (options: { force?: boolean } = {}) => {
    if (!museumId.value) {
      facilitiesData.value = [];
      facilitiesError.value = null;
      facilitiesLoadedMuseumId.value = '';
      return;
    }

    if (!options.force && (facilitiesPending.value || facilitiesLoadedMuseumId.value === museumId.value)) {
      return;
    }

    facilitiesPending.value = true;
    facilitiesError.value = null;

    try {
      facilitiesData.value = normalizeList<FacilityResponse>(
        await request<FacilityResponse[]>('/api/museum-management/facilities', {
          query: { museumId: museumId.value },
        })
      );
      facilitiesLoadedMuseumId.value = museumId.value;
    } catch (error) {
      facilitiesData.value = [];
      facilitiesError.value = error;
      facilitiesLoadedMuseumId.value = '';
    } finally {
      facilitiesPending.value = false;
    }
  };

  watch(
    museumId,
    () => {
      resetResourceState();
    }
  );

  watch(
    [museumId, activeSection],
    async ([nextMuseumId, nextSection]) => {
      if (!nextMuseumId) {
        return;
      }

      await loadFloors();

      if (nextSection === 'galleries') {
        await loadGalleries();
        return;
      }

      if (nextSection === 'facilities') {
        await loadFacilities();
      }
    },
    { immediate: true }
  );

  const floors = computed<MuseumFloorRecord[]>(() =>
    normalizeList<FloorResponse>(floorsData.value).map((floor) => ({
      id: floor.id ?? uuidv4(),
      floorNumber: floor.floorCode ?? '',
      floorName: floor.floorName ?? '',
      floorLevel: floor.floorLevel ?? 0,
      description: floor.description ?? '',
      mapImages: floor.mapImageUrl ? [floor.mapImageUrl] : [],
      mapImageFileId: toNullableId(floor.mapImageUrl),
      sortOrder: floor.sortOrder ?? 0,
    }))
  );

  const floorNameMap = computed(() => new Map(floors.value.map((floor) => [floor.id, floor.floorName || floor.floorNumber])));

  const galleries = computed<MuseumGalleryRecord[]>(() =>
    normalizeList<GalleryResponse>(galleriesData.value).map((gallery, index) => ({
      id: gallery.id ?? uuidv4(),
      museumId: gallery.museumId ?? museumId.value,
      floorId: gallery.floorId ?? null,
      floorName: floorNameMap.value.get(gallery.floorId ?? '') ?? '未绑定楼层',
      galleryCode: gallery.galleryCode ?? '',
      name: gallery.name ?? '',
      subtitle: gallery.subtitle ?? '',
      category: gallery.category ?? DEFAULT_GALLERY_CATEGORY,
      description: gallery.description ?? '',
      exhibitCount: gallery.exhibitCount,
      area: gallery.area,
      coverImageUrl: gallery.coverImageUrl,
      coverImageFileId: toNullableId(gallery.coverImageUrl),
      openStatus: gallery.openStatus ?? DEFAULT_OPEN_STATUS,
      x: gallery.x,
      y: gallery.y,
      sortOrder: gallery.sortOrder ?? index + 1,
    }))
  );

  const facilities = computed<MuseumFacilityRecord[]>(() =>
    normalizeList<FacilityResponse>(facilitiesData.value).map((facility, index) => ({
      id: facility.id ?? uuidv4(),
      museumId: facility.museumId ?? museumId.value,
      floorId: facility.floorId ?? null,
      floorName: floorNameMap.value.get(facility.floorId ?? '') ?? '未绑定楼层',
      name: facility.name ?? '',
      facilityType: facility.facilityType ?? DEFAULT_FACILITY_TYPE,
      locationDesc: facility.locationDesc ?? '',
      iconUrl: facility.iconUrl,
      iconFileId: toNullableId(facility.iconUrl),
      sortOrder: facility.sortOrder ?? index + 1,
    }))
  );

  const floorOptions = computed(() =>
    floors.value.map((floor) => ({
      label: `${floor.floorNumber}${floor.floorName ? ` · ${floor.floorName}` : ''}`,
      value: floor.id,
    }))
  );

  const resourceErrors = computed(() => ({
    floors: floorsError.value ? toErrorMessage(floorsError.value, '楼层数据加载失败，请稍后重试。') : '',
    galleries: galleriesError.value ? toErrorMessage(galleriesError.value, '场馆点位加载失败，请稍后重试。') : '',
    facilities: facilitiesError.value ? toErrorMessage(facilitiesError.value, '设施数据加载失败，请稍后重试。') : '',
  }));

  const resourcePending = computed(() => ({
    floors: floorsPending.value,
    galleries: galleriesPending.value,
    facilities: facilitiesPending.value,
  }));

  const pending = computed(() =>
    floorsPending.value || galleriesPending.value || facilitiesPending.value
  );
  const error = computed(() => floorsError.value || galleriesError.value || facilitiesError.value || null);

  const floorMaps = computed<FloorMapRecord[]>(() =>
    floors.value.map((floor) => {
      const relatedGalleries = galleries.value
        .filter((gallery) => gallery.floorId === floor.id)
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);

      return {
        id: floor.id,
        floorNumber: floor.floorNumber,
        floorName: floor.floorName,
        floorLevel: floor.floorLevel,
        description: floor.description,
        mapImages: [...floor.mapImages],
        mapImageFileId: floor.mapImageFileId,
        sortOrder: floor.sortOrder,
        venues: relatedGalleries.map((gallery) => ({
          id: gallery.id,
          galleryCode: gallery.galleryCode,
          name: gallery.name,
          subtitle: gallery.subtitle,
          category: gallery.category,
          description: gallery.description,
          exhibitCount: gallery.exhibitCount,
          area: gallery.area,
          coverImageUrl: gallery.coverImageUrl,
          coverImageFileId: gallery.coverImageFileId,
          openStatus: gallery.openStatus,
          x: gallery.x,
          y: gallery.y,
          sortOrder: gallery.sortOrder,
        })),
        includedVenueNames: relatedGalleries.map((gallery) => gallery.name).filter(Boolean),
      };
    })
  );

  const createEmptyFloorMapDraft = (): FloorMapDraft => ({
    floorNumber: '',
    floorName: '',
    floorLevel: 0,
    description: '',
    mapImages: [],
    mapImageFileId: null,
    sortOrder: floorMaps.value.length + 1,
    venues: [createEmptyVenue()],
  });

  const createFloorMapDraftFromRecord = (record: FloorMapRecord): FloorMapDraft => ({
    id: record.id,
    floorNumber: record.floorNumber,
    floorName: record.floorName,
    floorLevel: record.floorLevel,
    description: record.description,
    mapImages: [...record.mapImages],
    mapImageFileId: record.mapImageFileId,
    sortOrder: record.sortOrder,
    venues: record.venues.map((venue) => ({ ...venue })),
  });

  const createEmptyFloorDraft = (): MuseumFloorDraft => ({
    floorNumber: '',
    floorName: '',
    floorLevel: 0,
    description: '',
    mapImages: [],
    mapImageFileId: null,
    sortOrder: floors.value.length + 1,
  });

  const createFloorDraftFromRecord = (record: MuseumFloorRecord): MuseumFloorDraft => ({
    id: record.id,
    floorNumber: record.floorNumber,
    floorName: record.floorName,
    floorLevel: record.floorLevel,
    description: record.description,
    mapImages: [...record.mapImages],
    mapImageFileId: record.mapImageFileId,
    sortOrder: record.sortOrder,
  });

  const createEmptyGalleryDraft = (): MuseumGalleryDraft => ({
    floorId: null,
    galleryCode: '',
    name: '',
    subtitle: '',
    category: DEFAULT_GALLERY_CATEGORY,
    description: '',
    exhibitCount: null,
    area: null,
    coverImageUrl: null,
    coverImageFileId: null,
    openStatus: DEFAULT_OPEN_STATUS,
    x: null,
    y: null,
    sortOrder: galleries.value.length + 1,
  });

  const createGalleryDraftFromRecord = (record: MuseumGalleryRecord): MuseumGalleryDraft => ({
    id: record.id,
    floorId: record.floorId,
    galleryCode: record.galleryCode,
    name: record.name,
    subtitle: record.subtitle,
    category: record.category,
    description: record.description,
    exhibitCount: record.exhibitCount,
    area: record.area,
    coverImageUrl: record.coverImageUrl,
    coverImageFileId: record.coverImageFileId,
    openStatus: record.openStatus,
    x: record.x,
    y: record.y,
    sortOrder: record.sortOrder,
  });

  const createEmptyFacilityDraft = (): MuseumFacilityDraft => ({
    floorId: null,
    name: '',
    facilityType: DEFAULT_FACILITY_TYPE,
    locationDesc: '',
    iconUrl: null,
    iconFileId: null,
    sortOrder: facilities.value.length + 1,
  });

  const createFacilityDraftFromRecord = (record: MuseumFacilityRecord): MuseumFacilityDraft => ({
    id: record.id,
    floorId: record.floorId,
    name: record.name,
    facilityType: record.facilityType,
    locationDesc: record.locationDesc,
    iconUrl: record.iconUrl,
    iconFileId: record.iconFileId,
    sortOrder: record.sortOrder,
  });

  const saveFloor = async (draft: MuseumFloorDraft, targetId?: string) => {
    if (!museumId.value) {
      return;
    }

    const payload: CreateFloorPayload = {
      museumId: museumId.value,
      floorCode: trim(draft.floorNumber),
      floorName: trim(draft.floorName) || null,
      floorLevel: draft.floorLevel,
      description: trim(draft.description) || null,
      mapImageUrl: toNullableId(draft.mapImages[0] ?? null),
      sortOrder: draft.sortOrder,
    };

    if (targetId) {
      await request('/api/map-management/floors/' + targetId, {
        method: 'PUT',
        body: {
          ...payload,
          id: targetId,
        } satisfies UpdateFloorPayload,
      });
    } else {
      await request<string>('/api/map-management/floors', {
        method: 'POST',
        body: payload,
      });
    }

    await refresh();
  };

  const saveFloorMapDraft = async (draft: FloorMapDraft, targetId?: string) => {
    if (!museumId.value) {
      return;
    }

    const floorPayload: CreateFloorPayload = {
      museumId: museumId.value,
      floorCode: trim(draft.floorNumber),
      floorName: trim(draft.floorName) || null,
      floorLevel: draft.floorLevel,
      description: trim(draft.description) || null,
      mapImageUrl: toNullableId(draft.mapImages[0] ?? null),
      sortOrder: draft.sortOrder,
    };

    let floorId = targetId ?? draft.id ?? '';

    if (targetId) {
      await request('/api/map-management/floors/' + targetId, {
        method: 'PUT',
        body: {
          ...floorPayload,
          id: targetId,
        } satisfies UpdateFloorPayload,
      });
    } else {
      floorId = await request<string>('/api/map-management/floors', {
        method: 'POST',
        body: floorPayload,
      });
    }

    const existingGalleryIds = new Set(
      galleries.value
        .filter((gallery) => gallery.floorId === floorId)
        .map((gallery) => gallery.id)
        .filter((id): id is string => Boolean(id))
    );

    const nextGalleryIds = new Set(
      draft.venues.filter((venue) => /^\d+$/.test(venue.id)).map((venue) => venue.id)
    );

    for (const [index, venue] of draft.venues.entries()) {
      const payload: CreateGalleryPayload = {
        museumId: museumId.value,
        floorId,
        galleryCode: trim(venue.galleryCode) || `G-${trim(draft.floorNumber)}-${index + 1}`,
        name: trim(venue.name) || `未命名展馆 ${index + 1}`,
        subtitle: trim(venue.subtitle) || null,
        category: venue.category || DEFAULT_GALLERY_CATEGORY,
        description: trim(venue.description) || null,
        exhibitCount: venue.exhibitCount,
        area: venue.area,
        coverImageUrl: toNullableId(venue.coverImageFileId),
        openStatus: venue.openStatus || DEFAULT_OPEN_STATUS,
        x: venue.x,
        y: venue.y,
        sortOrder: venue.sortOrder || index + 1,
      };

      if (/^\d+$/.test(venue.id)) {
        await request('/api/map-management/galleries/' + venue.id, {
          method: 'PUT',
          body: {
            ...payload,
            id: venue.id,
          } satisfies UpdateGalleryPayload,
        });
      } else {
        await request<string>('/api/map-management/galleries', {
          method: 'POST',
          body: payload,
        });
      }
    }

    for (const existingId of existingGalleryIds) {
      if (nextGalleryIds.has(existingId)) {
        continue;
      }

      await request('/api/map-management/galleries/' + existingId, {
        method: 'DELETE',
      });
    }

    await refresh();
  };

  const deleteFloor = async (id: string) => {
    await request('/api/map-management/floors/' + id, {
      method: 'DELETE',
    });
    await refresh();
  };

  const saveGallery = async (
    draft: MuseumGalleryDraft,
    targetId?: string,
    options: { refresh?: boolean } = {}
  ) => {
    if (!museumId.value) {
      return;
    }

    const payload: CreateGalleryPayload = {
      museumId: museumId.value,
      floorId: draft.floorId || null,
      galleryCode: trim(draft.galleryCode),
      name: trim(draft.name),
      subtitle: trim(draft.subtitle) || null,
      category: draft.category,
      description: trim(draft.description) || null,
      exhibitCount: draft.exhibitCount,
      area: draft.area,
      coverImageUrl: toNullableId(draft.coverImageFileId),
      openStatus: draft.openStatus,
      x: draft.x,
      y: draft.y,
      sortOrder: draft.sortOrder,
    };

    if (targetId) {
      await request('/api/map-management/galleries/' + targetId, {
        method: 'PUT',
        body: {
          ...payload,
          id: targetId,
        } satisfies UpdateGalleryPayload,
      });
    } else {
      await request<string>('/api/map-management/galleries', {
        method: 'POST',
        body: payload,
      });
    }

    if (options.refresh !== false) {
      await refresh();
    }
  };

  const deleteGallery = async (id: string, options: { refresh?: boolean } = {}) => {
    await request('/api/map-management/galleries/' + id, {
      method: 'DELETE',
    });

    if (options.refresh !== false) {
      await refresh();
    }
  };

  const saveFacility = async (draft: MuseumFacilityDraft, targetId?: string) => {
    if (!museumId.value) {
      return;
    }

    const payload: CreateFacilityPayload = {
      museumId: museumId.value,
      floorId: draft.floorId || null,
      name: trim(draft.name),
      facilityType: draft.facilityType,
      locationDesc: trim(draft.locationDesc) || null,
      iconUrl: toNullableId(draft.iconFileId),
      sortOrder: draft.sortOrder,
    };

    if (targetId) {
      await request('/api/museum-management/facilities/' + targetId, {
        method: 'PUT',
        body: {
          ...payload,
          id: targetId,
        } satisfies UpdateFacilityPayload,
      });
    } else {
      await request<string>('/api/museum-management/facilities', {
        method: 'POST',
        body: payload,
      });
    }

    await refresh();
  };

  const deleteFacility = async (id: string) => {
    await request('/api/museum-management/facilities/' + id, {
      method: 'DELETE',
    });
    await refresh();
  };

  const refresh = async () => {
    await Promise.all([
      loadFloors({ force: true }),
      activeSection.value === 'galleries' ? loadGalleries({ force: true }) : Promise.resolve(),
      activeSection.value === 'facilities' ? loadFacilities({ force: true }) : Promise.resolve(),
    ]);
  };

  return {
    museumId,
    pending,
    error,
    refresh,
    resourceErrors,
    resourcePending,
    floors,
    floorMaps,
    galleries,
    facilities,
    floorOptions,
    createEmptyFloorMapDraft,
    createFloorMapDraftFromRecord,
    createEmptyFloorDraft,
    createFloorDraftFromRecord,
    createEmptyGalleryDraft,
    createGalleryDraftFromRecord,
    createEmptyFacilityDraft,
    createFacilityDraftFromRecord,
    saveFloor,
    saveFloorMapDraft,
    deleteFloor,
    saveGallery,
    deleteGallery,
    saveFacility,
    deleteFacility,
  };
};




