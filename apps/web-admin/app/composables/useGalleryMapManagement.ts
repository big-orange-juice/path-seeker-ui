import { computed, shallowRef } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type {
  GalleryMapGalleryOption,
  GalleryMapPageRequest,
  GalleryMapPointRecord,
  GalleryMapRecord,
  GalleryMapResponse,
  GalleryMapResponseListTotalPageResult,
  GalleryMapSummary,
  CreateGalleryMapAnnotationRequest,
  UpdateGalleryMapAnnotationRequest,
} from '@/types/gallery-map';
import type {
  GalleryResponse,
  GalleryResponseListTotalPageResult,
} from '@/types/museum';

const PAGE_SIZE = 1000;

const toNullableString = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const toText = (value: string | null | undefined) => String(value ?? '').trim();

const normalizePoint = (value: NonNullable<GalleryMapResponse['points']>[number]): GalleryMapPointRecord | null => {
  const id = toNullableString(value.id);
  if (!id) {
    return null;
  }

  return {
    id,
    galleryMapId: toNullableString(value.galleryMapId),
    sourcePointCode: toText(value.sourcePointCode),
    markerType: value.markerType,
    xPercent: value.xPercent,
    yPercent: value.yPercent,
    title: toText(value.title),
    description: toText(value.description),
    sourcePayload: toNullableString(value.sourcePayload),
    sortOrder: value.sortOrder,
    exhibitCount: value.exhibitCount,
    exhibits: (value.exhibits ?? []).map((exhibit) => ({
      id: toNullableString(exhibit.id),
      mapPointId: toNullableString(exhibit.mapPointId),
      exhibitId: toNullableString(exhibit.exhibitId),
      exhibitName: toText(exhibit.exhibitName || exhibit.sourceExhibitName),
      sourceExhibitCode: toText(exhibit.sourceExhibitCode),
      sourceExhibitName: toText(exhibit.sourceExhibitName),
      sourceNameNormalized: toText(exhibit.sourceNameNormalized),
      sourceDetailUrl: toNullableString(exhibit.sourceDetailUrl),
      sourceImageUrl: toNullableString(exhibit.sourceImageUrl),
      matchStatus: exhibit.matchStatus,
      matchMethod: toText(exhibit.matchMethod),
      sortOrder: exhibit.sortOrder,
    })),
  };
};

const normalizeSummary = (value: GalleryMapResponse): GalleryMapSummary | null => {
  const id = toNullableString(value.id);
  if (!id) {
    return null;
  }

  return {
    id,
    galleryId: toNullableString(value.galleryId),
    galleryName: toText(value.galleryName),
    sourceArticleCode: toText(value.sourceArticleCode),
    sourcePageUrl: toNullableString(value.sourcePageUrl),
    mapIndex: value.mapIndex,
    sourceImageUrl: toNullableString(value.sourceImageUrl),
    imageAttachmentId: toNullableString(value.imageAttachmentId),
    imageUrl: toNullableString(value.imageUrl),
    imageWidth: value.imageWidth,
    imageHeight: value.imageHeight,
    coordinateType: value.coordinateType,
    contentHash: toNullableString(value.contentHash),
    crawlStatus: value.crawlStatus,
    lastCrawledAt: toNullableString(value.lastCrawledAt),
    sortOrder: value.sortOrder,
    pointCount: value.pointCount,
  };
};

const normalizeRecord = (value: GalleryMapResponse): GalleryMapRecord | null => {
  const summary = normalizeSummary(value);
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    points: (value.points ?? []).map(normalizePoint).filter((point): point is GalleryMapPointRecord => Boolean(point)),
  };
};

const normalizeGalleryOptions = (items: GalleryResponse[]): GalleryMapGalleryOption[] => items
  .map((gallery) => {
    const value = toNullableString(gallery.id);
    if (!value) {
      return null;
    }

    const name = toText(gallery.name);
    const code = toText(gallery.galleryCode);
    return {
      value,
      name,
      code,
      label: [code, name].filter(Boolean).join(' / ') || value,
    };
  })
  .filter((option): option is GalleryMapGalleryOption => Boolean(option));

export const useGalleryMapManagement = (
  getMuseumId: () => string = () => {
    const runtimeConfig = useRuntimeConfig();
    return String(runtimeConfig.public.museumId || '').trim();
  },
) => {
  const museumId = computed(() => String(getMuseumId() || '').trim());
  const { request } = useApiClient();

  const galleries = shallowRef<GalleryMapGalleryOption[]>([]);
  const maps = shallowRef<GalleryMapSummary[]>([]);
  const currentMap = shallowRef<GalleryMapRecord | null>(null);
  const selectedGalleryId = shallowRef('');
  const selectedMapId = shallowRef('');
  const galleryPending = shallowRef(false);
  const listPending = shallowRef(false);
  const detailPending = shallowRef(false);
  const error = shallowRef<Error | null>(null);
  let galleryRequestVersion = 0;
  let listRequestVersion = 0;
  let detailRequestVersion = 0;

  const clearSelection = () => {
    galleries.value = [];
    maps.value = [];
    currentMap.value = null;
    selectedGalleryId.value = '';
    selectedMapId.value = '';
  };

  const loadGalleries = async () => {
    const currentVersion = ++galleryRequestVersion;
    const currentMuseumId = museumId.value;
    galleryPending.value = true;
    error.value = null;

    if (!currentMuseumId) {
      clearSelection();
      galleryPending.value = false;
      return galleries.value;
    }

    try {
      const response = await request<GalleryResponseListTotalPageResult<GalleryResponse>>('/api/map-management/galleries/query', {
        method: 'POST',
        body: {
          pageIndex: 1,
          pageSize: PAGE_SIZE,
          museumId: currentMuseumId,
        },
      });

      if (currentVersion !== galleryRequestVersion || currentMuseumId !== museumId.value) return galleries.value;
      galleries.value = normalizeGalleryOptions(response.list ?? []);
      return galleries.value;
    } catch (caughtError) {
      if (currentVersion !== galleryRequestVersion || currentMuseumId !== museumId.value) return galleries.value;
      galleries.value = [];
      error.value = caughtError instanceof Error ? caughtError : new Error('展厅加载失败。');
      throw caughtError;
    } finally {
      if (currentVersion === galleryRequestVersion) galleryPending.value = false;
    }
  };

  const loadMap = async (mapId: string) => {
    const normalizedId = String(mapId || '').trim();
    if (!normalizedId) {
      currentMap.value = null;
      selectedMapId.value = '';
      return null;
    }

    const currentVersion = ++detailRequestVersion;
    selectedMapId.value = normalizedId;
    detailPending.value = true;
    error.value = null;

    try {
      const response = await request<GalleryMapResponse>(`/api/gallery-map/${encodeURIComponent(normalizedId)}`);
      const nextMap = normalizeRecord(response);
      if (!nextMap) {
        throw new Error('地图数据无效。');
      }

      if (currentVersion !== detailRequestVersion || selectedMapId.value !== normalizedId) return null;
      currentMap.value = nextMap;
      selectedMapId.value = nextMap.id;
      if (nextMap.galleryId) {
        selectedGalleryId.value = nextMap.galleryId;
      }
      return nextMap;
    } catch (caughtError) {
      if (currentVersion !== detailRequestVersion || selectedMapId.value !== normalizedId) return null;
      currentMap.value = null;
      error.value = caughtError instanceof Error ? caughtError : new Error('地图加载失败。');
      throw caughtError;
    } finally {
      if (currentVersion === detailRequestVersion) detailPending.value = false;
    }
  };

  const loadMaps = async (galleryId: string | null = null, preferredMapId = '') => {
    const normalizedGalleryId = String(galleryId ?? '').trim();
    const normalizedPreferredMapId = String(preferredMapId || '').trim();
    const currentVersion = ++listRequestVersion;
    detailRequestVersion += 1;
    listPending.value = true;
    error.value = null;
    selectedGalleryId.value = normalizedGalleryId;
    selectedMapId.value = '';
    currentMap.value = null;

    if (!normalizedGalleryId) {
      maps.value = [];
      listPending.value = false;
      return maps.value;
    }

    try {
      const body: GalleryMapPageRequest = {
        pageIndex: 1,
        pageSize: PAGE_SIZE,
        galleryId: normalizedGalleryId,
        sourceArticleCode: null,
        crawlStatus: null,
      };
      const response = await request<GalleryMapResponseListTotalPageResult<GalleryMapResponse>>('/api/gallery-map/page-list', {
        method: 'POST',
        body,
      });

      if (currentVersion !== listRequestVersion || selectedGalleryId.value !== normalizedGalleryId) return maps.value;
      maps.value = (response.list ?? [])
        .map(normalizeSummary)
        .filter((map): map is GalleryMapSummary => Boolean(map));

      const retainedMapId = normalizedPreferredMapId && maps.value.some((map) => map.id === normalizedPreferredMapId)
        ? normalizedPreferredMapId
        : maps.value[0]?.id ?? '';
      selectedMapId.value = retainedMapId;

      if (retainedMapId) {
        await loadMap(retainedMapId);
      } else {
        currentMap.value = null;
      }

      return maps.value;
    } catch (caughtError) {
      if (currentVersion !== listRequestVersion || selectedGalleryId.value !== normalizedGalleryId) return maps.value;
      error.value = caughtError instanceof Error ? caughtError : new Error('地图列表加载失败。');
      throw caughtError;
    } finally {
      if (currentVersion === listRequestVersion) listPending.value = false;
    }
  };

  const selectGallery = async (galleryId: string) => {
    selectedMapId.value = '';
    currentMap.value = null;
    await loadMaps(String(galleryId || '').trim() || null);
  };

  const selectMap = async (mapId: string) => {
    const normalizedId = String(mapId || '').trim();
    if (!normalizedId) {
      currentMap.value = null;
      selectedMapId.value = '';
      return null;
    }

    return loadMap(normalizedId);
  };

  const initialize = async (options: { galleryId?: string; mapId?: string } = {}) => {
    await loadGalleries();

    const initialMapId = String(options.mapId || '').trim();
    if (initialMapId) {
      const initialMap = await loadMap(initialMapId);
      const targetGalleryId = initialMap?.galleryId || String(options.galleryId || '').trim();
      await loadMaps(targetGalleryId || null, initialMapId);

      if (!maps.value.some((map) => map.id === initialMapId) && initialMap) {
        maps.value = [initialMap, ...maps.value];
        await loadMap(initialMapId);
      }
      return;
    }

    if (!galleries.value.length) {
      maps.value = [];
      currentMap.value = null;
      selectedGalleryId.value = '';
      selectedMapId.value = '';
      return;
    }

    const requestedGalleryId = String(options.galleryId || '').trim();
    const galleryId = requestedGalleryId && galleries.value.some((gallery) => gallery.value === requestedGalleryId)
      ? requestedGalleryId
      : galleries.value[0]?.value ?? '';

    await selectGallery(galleryId);
  };

  const refreshCurrentMap = async () => {
    if (!selectedMapId.value) {
      return null;
    }

    return loadMap(selectedMapId.value);
  };

  const createAnnotation = async (payload: CreateGalleryMapAnnotationRequest) => {
    const responseId = await request<string | null>('/api/gallery-map/annotation/create', {
      method: 'POST',
      body: payload,
    });

    const savedId = String(responseId ?? '').trim();
    const refreshedMap = await refreshCurrentMap();
    const refreshedPoint = refreshedMap?.points.find(
      (point) => point.sourcePointCode === payload.sourcePointCode,
    );

    return refreshedPoint?.id || savedId;
  };

  const updateAnnotation = async (payload: UpdateGalleryMapAnnotationRequest) => {
    const id = String(payload.id || '').trim();
    if (!id) {
      throw new Error('点位 ID 不能为空。');
    }

    await request('/api/gallery-map/annotation/update', {
      method: 'POST',
      body: {
        ...payload,
        id,
      },
    });

    await refreshCurrentMap();
    return id;
  };

  const buildExhibitPayload = (point: GalleryMapPointRecord) => point.exhibits.map((item, index) => ({
    exhibitId: item.exhibitId,
    sourceExhibitCode: item.sourceExhibitCode,
    sourceExhibitName: item.sourceExhibitName || item.exhibitName,
    sourceDetailUrl: item.sourceDetailUrl,
    sourceImageUrl: item.sourceImageUrl,
    matchStatus: item.matchStatus ?? 1,
    matchMethod: item.matchMethod || 'manual',
    sortOrder: Number.isInteger(item.sortOrder) && item.sortOrder > 0
      ? item.sortOrder
      : index + 1,
  }));

  const buildUpdatePayloadFromPoint = (
    point: GalleryMapPointRecord,
    coordinate: { xPercent: number; yPercent: number } = {
      xPercent: point.xPercent,
      yPercent: point.yPercent,
    },
  ): UpdateGalleryMapAnnotationRequest => {
    const galleryMapId = String(point.galleryMapId || selectedMapId.value || '').trim();
    if (!galleryMapId) {
      throw new Error('地图 ID 不能为空。');
    }

    return {
      id: point.id,
      galleryMapId,
      sourcePointCode: point.sourcePointCode,
      markerType: point.markerType,
      xPercent: coordinate.xPercent,
      yPercent: coordinate.yPercent,
      title: point.title || null,
      description: point.description || null,
      sourcePayload: point.sourcePayload,
      sortOrder: point.sortOrder,
      exhibits: buildExhibitPayload(point),
    };
  };

  const buildCreatePayloadFromPoint = (
    point: GalleryMapPointRecord,
  ): CreateGalleryMapAnnotationRequest => {
    const galleryMapId = String(point.galleryMapId || selectedMapId.value || '').trim();
    if (!galleryMapId) {
      throw new Error('地图 ID 不能为空。');
    }

    return {
      galleryMapId,
      sourcePointCode: point.sourcePointCode,
      markerType: point.markerType,
      xPercent: point.xPercent,
      yPercent: point.yPercent,
      title: point.title || null,
      description: point.description || null,
      sourcePayload: point.sourcePayload,
      sortOrder: point.sortOrder,
      exhibits: buildExhibitPayload(point),
    };
  };

  const relocatePoint = async (
    point: GalleryMapPointRecord,
    coordinate: { xPercent: number; yPercent: number },
  ) => {
    const id = String(point.id || '').trim();
    if (!id) {
      throw new Error('点位 ID 不能为空。');
    }

    if (point.markerType !== 1) {
      throw new Error('当前仅支持拖动文物点位。');
    }

    if (!point.exhibits.length) {
      throw new Error('点位缺少关联文物，无法调整位置。');
    }

    const previousX = point.xPercent;
    const previousY = point.yPercent;

    // 乐观更新本地坐标，避免整图刷新造成闪动
    if (currentMap.value) {
      currentMap.value = {
        ...currentMap.value,
        points: currentMap.value.points.map((item) => (
          item.id === id
            ? {
                ...item,
                xPercent: coordinate.xPercent,
                yPercent: coordinate.yPercent,
              }
            : item
        )),
      };
    }

    try {
      await request('/api/gallery-map/annotation/update', {
        method: 'POST',
        body: buildUpdatePayloadFromPoint(point, coordinate),
      });
      return id;
    } catch (caughtError) {
      if (currentMap.value) {
        currentMap.value = {
          ...currentMap.value,
          points: currentMap.value.points.map((item) => (
            item.id === id
              ? {
                  ...item,
                  xPercent: previousX,
                  yPercent: previousY,
                }
              : item
          )),
        };
      }
      throw caughtError;
    }
  };

  const deletePoint = async (pointId: string) => {
    const id = String(pointId || '').trim();
    if (!id) {
      throw new Error('点位 ID 不能为空。');
    }

    await request('/api/gallery-map/point/delete', {
      method: 'POST',
      body: { id },
    });

    await refreshCurrentMap();
    return id;
  };

  const points = computed(() => currentMap.value?.points ?? []);

  return {
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
    loadGalleries,
    loadMaps,
    loadMap,
    selectGallery,
    selectMap,
    initialize,
    refreshCurrentMap,
    createAnnotation,
    updateAnnotation,
    buildUpdatePayloadFromPoint,
    buildCreatePayloadFromPoint,
    relocatePoint,
    deletePoint,
  };
};
