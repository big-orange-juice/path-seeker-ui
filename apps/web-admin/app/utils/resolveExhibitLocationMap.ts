import type { StageExhibitLocationMap } from '@path-seeker/game-renderer';
import type {
  GalleryMapResponse,
  GalleryMapResponseListTotalPageResult,
} from '@/types/gallery-map';
import type { ExhibitResponse } from '@/types/museum';

const normalizeId = (value: unknown) => {
  const id = String(value ?? '').trim();
  if (!id || id === '0') return '';
  return id;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

/**
 * 根据文物 ID 查询所属展厅地图，并定位该文物点位。
 * 仅返回「有底图 + 命中点位」的结果；无地图/无标注时返回 null。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminRequest = <T>(url: string, options?: any) => Promise<T>

export async function resolveExhibitLocationMap(
  request: AdminRequest,
  exhibitId: string | null | undefined,
): Promise<StageExhibitLocationMap | null> {
  const id = normalizeId(exhibitId);
  if (!id) return null;

  let exhibit: ExhibitResponse | null = null;
  try {
    exhibit = await request<ExhibitResponse>(`/api/exhibit/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }

  const galleryId = normalizeId(exhibit?.galleryId);
  if (!galleryId) return null;

  const exhibitName =
    normalizeText(exhibit?.name)
    || null;

  let page: GalleryMapResponseListTotalPageResult<GalleryMapResponse> | null = null;
  try {
    page = await request<GalleryMapResponseListTotalPageResult<GalleryMapResponse>>(
      '/api/gallery-map/page-list',
      {
        method: 'POST',
        body: {
          pageIndex: 1,
          pageSize: 50,
          galleryId,
          sourceArticleCode: null,
          crawlStatus: null,
        },
      },
    );
  } catch {
    return null;
  }

  const maps = [...(page?.list ?? [])]
    .filter((item) => normalizeId(item.id))
    .sort((left, right) => {
      const sortDelta = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
      if (sortDelta !== 0) return sortDelta;
      return Number(left.mapIndex ?? 0) - Number(right.mapIndex ?? 0);
    });

  for (const summary of maps) {
    const mapId = normalizeId(summary.id);
    if (!mapId) continue;

    let detail: GalleryMapResponse | null = null;
    try {
      detail = await request<GalleryMapResponse>(`/api/gallery-map/${encodeURIComponent(mapId)}`);
    } catch {
      continue;
    }

    const imageUrl =
      normalizeText(detail?.imageUrl)
      || normalizeText(detail?.sourceImageUrl);
    if (!imageUrl) continue;

    const points = detail?.points ?? [];
    for (const point of points) {
      const matched = (point.exhibits ?? []).some(
        (item) => normalizeId(item.exhibitId) === id,
      );
      if (!matched) continue;

      const xPercent = Number(point.xPercent);
      const yPercent = Number(point.yPercent);
      if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) continue;

      return {
        galleryName:
          normalizeText(detail.galleryName)
          || normalizeText(summary.galleryName)
          || null,
        imageUrl,
        xPercent,
        yPercent,
        pointTitle:
          normalizeText(point.title)
          || exhibitName,
        exhibitName,
      };
    }
  }

  return null;
}
