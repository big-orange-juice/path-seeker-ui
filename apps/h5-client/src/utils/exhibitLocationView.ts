import type {
  ExhibitMapOverlayModel,
  ExhibitMapOverlayPoint,
  ExhibitMapOverlaySheet,
} from "@path-seeker/game-renderer"
import type { ExhibitChatLocationItem } from "@/types/exhibitChat"

function normalizeStatus(item: ExhibitChatLocationItem | null | undefined) {
  return String(item?.status || "").trim()
}

/** 是否可打开可绘地图（至少一张底图 + 一个有效点位） */
export function canOpenExhibitLocationMap(item: ExhibitChatLocationItem | null | undefined) {
  return Boolean(toExhibitMapOverlayModel(item) || item?.outdoorLocations?.some((location) => location.longitude != null && location.latitude != null))
}

export function formatExhibitLocationPlaceLine(item: ExhibitChatLocationItem) {
  const floor = String(item.gallery?.floorName || "").trim()
  const gallery = String(item.gallery?.galleryName || "").trim()
  const parts = [floor, gallery].filter(Boolean)
  return parts.join(" · ") || item.siteArea?.name || (item.outdoorLocations?.length ? "景区地图" : "")
}

export function toOutdoorMapFocusModel(item: ExhibitChatLocationItem | null | undefined) {
  const location = item?.outdoorLocations?.find((candidate) => candidate.isPrimary) || item?.outdoorLocations?.[0]
  if (!location || location.longitude == null || location.latitude == null) return null
  return { exhibitId: item?.exhibitId || null, exhibitName: item?.exhibitName || null, longitude: location.longitude, latitude: location.latitude, coordinateSystem: location.coordinateSystem }
}

export function resolveExhibitLocationView(item: ExhibitChatLocationItem | null | undefined) {
  const indoor = toExhibitMapOverlayModel(item)
  const outdoor = toOutdoorMapFocusModel(item)
  return indoor && outdoor ? { kind: "both" as const, indoor, outdoor } : outdoor ? { kind: "outdoor" as const, outdoor } : indoor ? { kind: "indoor" as const, indoor } : null
}

/** 气泡卡状态短提示 */
export function formatExhibitLocationStatusHint(item: ExhibitChatLocationItem) {
  switch (normalizeStatus(item)) {
    case "located":
      return "已定位到展厅点位"
    case "multiple_locations": {
      const count = countDrawablePoints(item)
      return count > 1 ? `共 ${count} 个陈列点位` : "存在多个陈列点位"
    }
    case "gallery_only":
      return "已绑定展厅，暂无地图点位"
    case "map_unavailable":
      return "展厅地图暂未录入"
    case "unbound":
      return "陈列位置暂未录入"
    default:
      return "位置信息"
  }
}

/** 更完整的副文案：楼层展厅 + 状态说明 */
export function formatExhibitLocationDetailLine(item: ExhibitChatLocationItem) {
  const place = formatExhibitLocationPlaceLine(item)
  const status = normalizeStatus(item)
  switch (status) {
    case "located":
      return place || "已定位到展厅点位"
    case "multiple_locations": {
      const count = countDrawablePoints(item)
      const multi = count > 1 ? `${count} 个点位` : "多个点位"
      return place ? `${place} · ${multi}` : multi
    }
    case "gallery_only":
      return place ? `${place}（暂无地图点位）` : "已绑定展厅，暂无地图点位"
    case "map_unavailable":
      return place ? `${place}（地图未录入）` : "展厅地图暂未录入"
    case "unbound":
      return "该文物尚未绑定有效展厅"
    default:
      return place || formatExhibitLocationStatusHint(item)
  }
}

/** 卡片右侧 CTA / 状态徽章 */
export function formatExhibitLocationCta(item: ExhibitChatLocationItem) {
  if (canOpenExhibitLocationMap(item)) {
    return "查看地图"
  }
  switch (normalizeStatus(item)) {
    case "gallery_only":
      return "暂无点位"
    case "map_unavailable":
      return "暂无地图"
    case "unbound":
      return "暂未录入"
    default:
      return "暂不可用"
  }
}

/** 气泡缩略图：优先可绘底图，其次任意 map 图 */
export function getLocationPreviewImageUrl(item: ExhibitChatLocationItem | null | undefined) {
  if (!item) return null
  for (const map of item.maps || []) {
    const url = String(map.mapImageUrl || "").trim()
    if (!url) continue
    const hasPoint = (map.points || []).some((point) => {
      const x = Number(point.xPercent)
      const y = Number(point.yPercent)
      return Number.isFinite(x) && Number.isFinite(y)
    })
    if (hasPoint) return url
  }
  for (const map of item.maps || []) {
    const url = String(map.mapImageUrl || "").trim()
    if (url) return url
  }
  return null
}

function mapPoints(
  item: ExhibitChatLocationItem,
  map: ExhibitChatLocationItem["maps"][number],
  mapIndex: number,
): ExhibitMapOverlayPoint[] {
  const points: ExhibitMapOverlayPoint[] = []
  for (const [index, point] of (map.points || []).entries()) {
    const xPercent = Number(point.xPercent)
    const yPercent = Number(point.yPercent)
    if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) {
      continue
    }
    points.push({
      id: String(point.pointId || "").trim() || `m${mapIndex}-p${index}`,
      title:
        String(point.title || "").trim()
        || String(item.exhibitName || "").trim()
        || null,
      xPercent,
      yPercent,
    })
  }
  return points
}

function countDrawablePoints(item: ExhibitChatLocationItem) {
  let total = 0
  for (const [mapIndex, map] of (item.maps || []).entries()) {
    total += mapPoints(item, map, mapIndex).length
  }
  return total
}

/**
 * 将问答位置快照适配为通用弹层模型。
 * 使用消息内快照，不二次请求接口，避免历史漂移。
 * 支持多底图 maps[]；过滤无点位底图。
 */
export function toExhibitMapOverlayModel(
  item: ExhibitChatLocationItem | null | undefined,
): ExhibitMapOverlayModel | null {
  if (!item) return null

  const status = normalizeStatus(item)
  // 明确无点位状态：不打开地图（即使 maps 有脏数据）
  if (status === "gallery_only" || status === "map_unavailable" || status === "unbound") {
    return null
  }

  const sheets: ExhibitMapOverlaySheet[] = []
  for (const [mapIndex, map] of (item.maps || []).entries()) {
    const imageUrl = String(map.mapImageUrl || "").trim()
    if (!imageUrl) continue
    const points = mapPoints(item, map, mapIndex)
    if (!points.length) continue

    const mapId = String(map.mapId || "").trim() || `map-${mapIndex}`
    sheets.push({
      id: mapId,
      label: sheets.length === 0 && (item.maps || []).length <= 1
        ? String(item.gallery?.galleryName || "").trim() || "展厅地图"
        : `地图 ${sheets.length + 1}`,
      imageUrl,
      points,
    })
  }

  if (!sheets.length) return null

  const place = formatExhibitLocationPlaceLine(item)
  const exhibitName = String(item.exhibitName || "").trim()
  const pointTotal = sheets.reduce((sum, sheet) => sum + sheet.points.length, 0)
  const subtitleParts = [
    exhibitName,
    pointTotal > 1 ? `${pointTotal} 个点位` : "",
    sheets.length > 1 ? `${sheets.length} 张地图` : "",
  ].filter(Boolean)

  const first = sheets[0]!
  return {
    galleryName: String(item.gallery?.galleryName || "").trim() || place || "展厅地图",
    subtitle: subtitleParts.join(" · ") || place || null,
    maps: sheets,
    imageUrl: first.imageUrl,
    points: first.points,
    initialMapId: first.id,
    focusPointId: first.points[0]?.id || null,
  }
}

/** 语音模式 toast 副文案 */
export function formatLocationVoiceToastDetail(items: ExhibitChatLocationItem[]) {
  const first = items.find((item) => item && typeof item === "object")
  if (!first) return "可在回复中查看位置卡"
  const openable = items.some((item) => canOpenExhibitLocationMap(item))
  const place = formatExhibitLocationPlaceLine(first)
  const name = String(first.exhibitName || "").trim()
  if (openable) {
    if (name && place) return `${name} · ${place}`
    return place || name || "点击位置卡查看地图"
  }
  return formatExhibitLocationDetailLine(first)
}
