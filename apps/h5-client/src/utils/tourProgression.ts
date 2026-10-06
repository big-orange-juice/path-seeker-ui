import {
  DEFAULT_APPROACH_POLICY,
  evaluateApproach,
  isUsableLocation,
  type ApproachPoint,
  type ApproachPolicy,
  type ApproachResult,
  type PlaceRange,
} from '@path-seeker/ts-shared'
import type { ClientPlace, ClientTourStop } from '@/types/clientCatalog'

/**
 * 接近判定策略：直接复用共享默认值（进入 50 米、退出 80 米，设计文档 §5.3 与 §2.3 第 4 条）。
 *
 * 这里不再保留旧的 100/180 半径语义：所有距离判断都改为"按景点范围计算"，
 * 阈值优先取服务端下发的 range 生效值，未下发时回落到 DEFAULT_APPROACH_POLICY。
 */
export const TOUR_ARRIVAL_POLICY: ApproachPolicy = DEFAULT_APPROACH_POLICY

/** 带定位质量字段的用户位置 */
export interface TourFix {
  longitude: number
  latitude: number
  accuracy: number
  timestamp: number
}

/** 一个接近候选：候选筛选、弹出卡片、确认与解除都使用同一份计算结果 */
export interface TourStopCandidate {
  /** 站点在排序后路线中的下标 */
  index: number
  stop: ClientTourStop
  place: ClientPlace | null
  /** 判定锚点：优先文化点经纬度 */
  anchor: ApproachPoint
  range: PlaceRange | null
  distanceMeters: number | null
  withinRange: boolean
  proximityMeters: number
  releaseMeters: number
}

/** 判定锚点取文化点经纬度；文化点缺坐标时回落到站点坐标 */
export function tourStopAnchor(stop: ClientTourStop, place: ClientPlace | null | undefined): ApproachPoint | null {
  const longitude = place?.longitude ?? stop.longitude
  const latitude = place?.latitude ?? stop.latitude
  if (longitude == null || latitude == null) return null
  return { longitude, latitude }
}

/**
 * 计算某个站点相对当前位置的接近结果。
 * 返回 null 表示无法判定（没有定位、定位质量不足、缺锚点坐标），调用方按"未知"处理并保留手动选择能力。
 */
export function evaluateTourStop(
  stop: ClientTourStop,
  place: ClientPlace | null | undefined,
  fix: TourFix | null | undefined,
  now = Date.now(),
  policy: ApproachPolicy = TOUR_ARRIVAL_POLICY,
): ApproachResult | null {
  if (!fix || !isUsableLocation(fix, policy, now)) return null
  const anchor = tourStopAnchor(stop, place)
  if (!anchor) return null
  return evaluateApproach({ longitude: fix.longitude, latitude: fix.latitude }, place?.range ?? null, anchor, policy)
}

/**
 * 候选筛选（原 nearbyTourStop 的替代）：只返回处于"接近"状态的未游览站点。
 * 多个范围重叠时全部返回，先按路线顺序、再按到停靠点的距离排序，由用户在卡片上选择。
 */
export function nearbyTourStops(
  stops: ClientTourStop[],
  places: ClientPlace[] | null | undefined,
  fix: TourFix | null | undefined,
  after: number,
  now = Date.now(),
  policy: ApproachPolicy = TOUR_ARRIVAL_POLICY,
): TourStopCandidate[] {
  if (!fix || !isUsableLocation(fix, policy, now)) return []
  const placeById = new Map<string, ClientPlace>()
  for (const place of places ?? []) placeById.set(place.id, place)
  const point: ApproachPoint = { longitude: fix.longitude, latitude: fix.latitude }
  const candidates: TourStopCandidate[] = []
  stops.forEach((stop, index) => {
    if (index <= after) return
    const place = stop.placeId ? placeById.get(stop.placeId) ?? null : null
    const anchor = tourStopAnchor(stop, place)
    if (!anchor) return
    const range = place?.range ?? null
    const result = evaluateApproach(point, range, anchor, policy)
    if (!result.approaching) return
    candidates.push({
      index,
      stop,
      place,
      anchor,
      range,
      distanceMeters: result.distanceMeters,
      withinRange: result.withinRange,
      proximityMeters: result.proximityMeters,
      releaseMeters: result.releaseMeters,
    })
  })
  return candidates.sort((left, right) => (left.stop.order - right.stop.order)
    || ((left.distanceMeters ?? Number.POSITIVE_INFINITY) - (right.distanceMeters ?? Number.POSITIVE_INFINITY)))
}
