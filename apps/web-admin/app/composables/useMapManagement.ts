import { computed } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type {
  CreateFloorPayload,
  CreateGalleryPayload,
  FloorResponse,
  GalleryPageRequest,
  GalleryResponse,
  GalleryResponseListTotalPageResult,
  UpdateFloorPayload,
  UpdateGalleryPayload,
} from '@/types/museum';
import type { FloorMapDraft, FloorMapRecord, VenueDraft } from '@/types/map-management';

const DEFAULT_GALLERY_CATEGORY = 1;
const DEFAULT_OPEN_STATUS = 1;

const createVenue = (): VenueDraft => ({
  id: crypto.randomUUID(),
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

const toNullableNumber = (value: string | null | undefined) => {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
};

const normalizeVenue = (venue: VenueDraft, index: number): VenueDraft => ({
  ...venue,
  galleryCode: venue.galleryCode.trim(),
  name: venue.name.trim(),
  subtitle: venue.subtitle.trim(),
  description: venue.description.trim(),
  category: venue.category || DEFAULT_GALLERY_CATEGORY,
  openStatus: venue.openStatus || DEFAULT_OPEN_STATUS,
  sortOrder: venue.sortOrder || index + 1,
});

const normalizeDraft = (draft: FloorMapDraft): FloorMapDraft => ({
  id: draft.id,
  floorNumber: draft.floorNumber.trim(),
  floorName: draft.floorName.trim(),
  floorLevel: Number.isFinite(draft.floorLevel) ? draft.floorLevel : 0,
  description: draft.description.trim(),
  mapImages: draft.mapImages.filter(Boolean).slice(0, 1),
  mapImageFileId: draft.mapImageFileId,
  sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
  venues: draft.venues
    .map(normalizeVenue)
    .filter((venue) => venue.galleryCode || venue.name || venue.x !== null || venue.y !== null),
});

export const useMapManagement = () => {
  const runtimeConfig = useRuntimeConfig();
  const museumId = computed(() => Number(runtimeConfig.public.museumId || 1));
  const asyncKey = computed(() => `map-management:${museumId.value}`);
  const { request } = useApiClient();

  const createEmptyDraft = (): FloorMapDraft => ({
    floorNumber: '',
    floorName: '',
    floorLevel: 0,
    description: '',
    mapImages: [],
    mapImageFileId: null,
    sortOrder: 0,
    venues: [createVenue()],
  });

  const { data, pending, error, refresh } = useAsyncData(
    asyncKey,
    async () => {
      const [floors, galleries] = await Promise.all([
        request<FloorResponse[]>('/api/map-management/floors', {
          query: { museumId: museumId.value },
        }),
        request<GalleryResponseListTotalPageResult<GalleryResponse>>('/api/map-management/galleries/query', {
          method: 'POST',
          body: {
            pageIndex: 1,
            pageSize: 1000,
            museumId: museumId.value,
          } satisfies GalleryPageRequest,
        }),
      ]);

      return {
        floors,
        galleries: galleries.list ?? [],
      };
    },
    {
      default: () => ({
        floors: [],
        galleries: [],
      }),
      watch: [museumId],
    }
  );

  const maps = computed<FloorMapRecord[]>(() => {
    const galleriesByFloorId = new Map<string, GalleryResponse[]>();

    for (const gallery of data.value.galleries) {
      if (!gallery.floorId) {
        continue;
      }

      const floorGalleries = galleriesByFloorId.get(gallery.floorId) ?? [];
      floorGalleries.push(gallery);
      galleriesByFloorId.set(gallery.floorId, floorGalleries);
    }

    return data.value.floors.map((floor) => {
      const floorId = floor.id ?? crypto.randomUUID();
      const galleries = (galleriesByFloorId.get(floorId) ?? [])
        .slice()
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

      return {
        id: floorId,
        floorNumber: floor.floorCode ?? '',
        floorName: floor.floorName ?? '',
        floorLevel: floor.floorLevel ?? 0,
        description: floor.description ?? '',
        mapImages: floor.mapImageUrl ? [floor.mapImageUrl] : [],
        mapImageFileId: toNullableNumber(floor.mapImageUrl)?.toString() ?? null,
        sortOrder: floor.sortOrder ?? 0,
        venues: galleries.map((gallery, index) => ({
          id: gallery.id ?? crypto.randomUUID(),
          galleryCode: gallery.galleryCode ?? '',
          name: gallery.name ?? '',
          subtitle: gallery.subtitle ?? '',
          category: gallery.category ?? DEFAULT_GALLERY_CATEGORY,
          description: gallery.description ?? '',
          exhibitCount: gallery.exhibitCount,
          area: gallery.area,
          coverImageUrl: gallery.coverImageUrl,
          coverImageFileId: toNullableNumber(gallery.coverImageUrl)?.toString() ?? null,
          openStatus: gallery.openStatus ?? DEFAULT_OPEN_STATUS,
          x: gallery.x,
          y: gallery.y,
          sortOrder: gallery.sortOrder ?? index + 1,
        })),
        includedVenueNames: galleries.map((gallery) => gallery.name ?? '').filter(Boolean),
      };
    });
  });

  const createDraftFromRecord = (record: FloorMapRecord): FloorMapDraft => ({
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

  const saveGalleries = async (floorId: string, draft: FloorMapDraft) => {
    const existingGalleryIds = new Set(
      data.value.galleries
        .filter((gallery) => gallery.floorId === floorId)
        .map((gallery) => gallery.id)
        .filter((id): id is string => Boolean(id))
    );
    const nextGalleryIds = new Set(
      draft.venues.filter((venue) => /^\d+$/.test(venue.id)).map((venue) => venue.id)
    );

    for (const gallery of draft.venues.map(normalizeVenue)) {
      const basePayload: CreateGalleryPayload = {
        museumId: museumId.value,
        floorId: Number(floorId),
        galleryCode: gallery.galleryCode || `G-${draft.floorNumber}-${gallery.sortOrder}`,
        name: gallery.name || `未命名展馆 ${gallery.sortOrder}`,
        subtitle: gallery.subtitle || null,
        category: gallery.category,
        description: gallery.description || null,
        exhibitCount: gallery.exhibitCount,
        area: gallery.area,
        coverImageUrl: toNullableNumber(gallery.coverImageFileId),
        openStatus: gallery.openStatus,
        x: gallery.x,
        y: gallery.y,
        sortOrder: gallery.sortOrder,
      };

      if (/^\d+$/.test(gallery.id)) {
        await request('/api/map-management/galleries/' + gallery.id, {
          method: 'PUT',
          body: {
            ...basePayload,
            id: Number(gallery.id),
          } satisfies UpdateGalleryPayload,
        });
        continue;
      }

      await request<string>('/api/map-management/galleries', {
        method: 'POST',
        body: basePayload,
      });
    }

    for (const galleryId of existingGalleryIds) {
      if (nextGalleryIds.has(galleryId)) {
        continue;
      }

      await request('/api/map-management/galleries/' + galleryId, {
        method: 'DELETE',
      });
    }
  };

  const saveDraft = async (draft: FloorMapDraft, targetId?: string) => {
    const normalized = normalizeDraft(draft);
    const baseFloorPayload: CreateFloorPayload = {
      museumId: museumId.value,
      floorCode: normalized.floorNumber,
      floorName: normalized.floorName || null,
      floorLevel: normalized.floorLevel,
      description: normalized.description || null,
      mapImageUrl: toNullableNumber(normalized.mapImageFileId),
      sortOrder: normalized.sortOrder,
    };

    let floorId = targetId ?? normalized.id ?? '';

    if (targetId) {
      await request('/api/map-management/floors/' + targetId, {
        method: 'PUT',
        body: {
          ...baseFloorPayload,
          id: Number(targetId),
        } satisfies UpdateFloorPayload,
      });
    } else {
      floorId = await request<string>('/api/map-management/floors', {
        method: 'POST',
        body: baseFloorPayload,
      });
    }

    await saveGalleries(floorId, normalized);
    await refresh();
  };

  const deleteMap = async (targetId: string) => {
    const floorGalleries = data.value.galleries.filter((gallery) => gallery.floorId === targetId);

    for (const gallery of floorGalleries) {
      if (!gallery.id) {
        continue;
      }

      await request('/api/map-management/galleries/' + gallery.id, {
        method: 'DELETE',
      });
    }

    await request('/api/map-management/floors/' + targetId, {
      method: 'DELETE',
    });
    await refresh();
  };

  return {
    maps,
    pending,
    error,
    refresh,
    createEmptyDraft,
    createDraftFromRecord,
    saveDraft,
    deleteMap,
  };
};
