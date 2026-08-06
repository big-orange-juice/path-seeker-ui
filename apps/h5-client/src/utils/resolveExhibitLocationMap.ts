import type { StageExhibitLocationMap } from "@path-seeker/game-renderer"
import {
  fetchExhibit,
  fetchGalleryMap,
  fetchGalleryMapPageList,
} from "@/services/gameplay"

const normalizeId = (value: unknown) => {
  const id = String(value ?? "").trim()
  if (!id || id === "0") return ""
  return id
}

const normalizeText = (value: unknown) => String(value ?? "").trim()

/**
 * 根据 refExhibitId 查文物所属展厅地图，定位该文物点位。
 * 仅返回「有底图 + 命中点位」；无地图/无标注返回 null（不展示定位图标）。
 */
export async function resolveExhibitLocationMap(
  exhibitId: string | null | undefined,
): Promise<StageExhibitLocationMap | null> {
  const id = normalizeId(exhibitId)
  if (!id) return null

  let exhibit
  try {
    exhibit = await fetchExhibit(id)
  } catch {
    return null
  }

  const galleryId = normalizeId(exhibit?.galleryId)
  if (!galleryId) return null

  const exhibitName = normalizeText(exhibit?.name) || null

  let page
  try {
    page = await fetchGalleryMapPageList({
      pageIndex: 1,
      pageSize: 50,
      galleryId,
      sourceArticleCode: null,
      crawlStatus: null,
    })
  } catch {
    return null
  }

  const maps = [...(page?.list ?? [])]
    .filter((item) => normalizeId(item.id))
    .sort((left, right) => {
      const sortDelta = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0)
      if (sortDelta !== 0) return sortDelta
      return Number(left.mapIndex ?? 0) - Number(right.mapIndex ?? 0)
    })

  for (const summary of maps) {
    const mapId = normalizeId(summary.id)
    if (!mapId) continue

    let detail
    try {
      detail = await fetchGalleryMap(mapId)
    } catch {
      continue
    }

    const imageUrl =
      normalizeText(detail?.imageUrl)
      || normalizeText(detail?.sourceImageUrl)
    if (!imageUrl) continue

    for (const point of detail?.points ?? []) {
      const matched = (point.exhibits ?? []).some(
        (item) => normalizeId(item.exhibitId) === id,
      )
      if (!matched) continue

      const xPercent = Number(point.xPercent)
      const yPercent = Number(point.yPercent)
      if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) continue

      return {
        galleryName:
          normalizeText(detail.galleryName)
          || normalizeText(summary.galleryName)
          || null,
        imageUrl,
        xPercent,
        yPercent,
        pointTitle: normalizeText(point.title) || exhibitName,
        exhibitName,
      }
    }
  }

  return null
}
