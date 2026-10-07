/**
 * 范围几何与接近判定（管理端与 C 端共用一份实现）。
 *
 * 设计依据：doc/b-admin-functional-optimization-plan.md §5。
 * - 三层范围：目的地边界(museum.boundary_geojson)、景区区域(museum_site_area)、景点本体范围(museum_cultural_place)。
 * - 本文件只处理"几何与判定"，不做任何网络请求。
 * - 所有坐标一律 WGS84；渲染前由调用方自行转换为 GCJ-02。
 * - 禁止在 h5-client 或 web-admin 里再写第二份包含/距离实现。
 */

export type BoundaryPoint = [number, number]
export type BoundaryPolygon = BoundaryPoint[][]
export interface BoundaryGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: BoundaryPolygon | BoundaryPolygon[]
}

/** 景点本体范围类型：1=点 2=圆 3=多边形（与后端 CulturalPlaceRangeTypes 对齐） */
export const PLACE_RANGE_TYPE = { POINT: 1, CIRCLE: 2, POLYGON: 3 } as const
export type PlaceRangeType = (typeof PLACE_RANGE_TYPE)[keyof typeof PLACE_RANGE_TYPE]

/** C 端下发的景点范围契约（对应后端 ClientPlaceRange） */
export interface PlaceRange {
  type: 'point' | 'circle' | 'polygon'
  radiusMeters?: number | null
  boundaryGeoJson?: string | null
  proximityDistanceMeters?: number | null
  releaseDistanceMeters?: number | null
  defaultProximityDistanceMeters?: number
  defaultReleaseDistanceMeters?: number
  rangeVersion: number
}

/** 接近判定策略；范围未单独配置阈值时使用这里的全局默认 */
export interface ApproachPolicy {
  /** 进入接近状态的阈值(米) */
  proximityMeters: number
  /** 解除接近状态的阈值(米)，必须不小于 proximityMeters */
  releaseMeters: number
  /** 可接受的最大定位精度(米) */
  maxAccuracyMeters: number
  /** 位置有效期(毫秒) */
  maxAgeMs: number
  /** 稳定停留时长(毫秒) */
  dwellMs: number
}

/** 默认策略：进入 50 米、退出 80 米（设计文档 §5.3 已确认值） */
export const DEFAULT_APPROACH_POLICY: ApproachPolicy = {
  proximityMeters: 50,
  releaseMeters: 80,
  maxAccuracyMeters: 65,
  maxAgeMs: 15000,
  dwellMs: 1500,
}

export interface ApproachPoint {
  longitude: number
  latitude: number
}

export interface ApproachResult {
  /** 到范围的距离(米)；几何缺失时为 null */
  distanceMeters: number | null
  /** 是否落在范围内 */
  withinRange: boolean
  /** 是否应进入"接近"状态（distanceMeters ≤ proximityMeters） */
  approaching: boolean
  /** 是否应解除"接近"状态（distanceMeters > releaseMeters） */
  releasing: boolean
  /** 生效的接近阈值 */
  proximityMeters: number
  /** 生效的解除阈值 */
  releaseMeters: number
}

const EARTH_RADIUS_METERS = 6371008.8
const METERS_PER_DEGREE_LATITUDE = 111320

/** 两点间大圆距离(米)，与后端 GeoDistance.MetersBetween 口径一致 */
export function metersBetween(from: ApproachPoint, to: ApproachPoint): number {
  const radLat1 = (from.latitude * Math.PI) / 180
  const radLat2 = (to.latitude * Math.PI) / 180
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** 解析 Polygon / MultiPolygon（也接受 GeoJSON Feature），失败返回 null */
export function parseBoundary(source: string | null | undefined): BoundaryGeometry | null {
  if (!source) return null
  try {
    const parsed = JSON.parse(source)
    const geometry = parsed.type === 'Feature' ? parsed.geometry : parsed
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    if (!Array.isArray(polygons) || !polygons.length) return null
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) return null
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2001) return null
        if (!ring.every((point: unknown) => Array.isArray(point) && point.length === 2
          && Number.isFinite(point[0]) && Number.isFinite(point[1])
          && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) return null
        const first = ring[0]
        const last = ring[ring.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) return null
        if (new Set(ring.slice(0, -1).map((point: BoundaryPoint) => point.join(','))).size < 3) return null
        let area = 0
        for (let index = 0; index < ring.length - 1; index += 1) {
          const point = ring[index]
          const next = ring[index + 1]
          if (point[0] === next[0] && point[1] === next[1]) return null
          area += (point[0] - first[0]) * (next[1] - first[1]) - (point[1] - first[1]) * (next[0] - first[0])
        }
        if (Math.abs(area) < 1e-12) return null
      }
    }
    return geometry as BoundaryGeometry
  } catch {
    return null
  }
}

export function boundaryPolygons(geometry: BoundaryGeometry): BoundaryPolygon[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates as BoundaryPolygon]
    : (geometry.coordinates as BoundaryPolygon[])
}

/** 点是否在边界内；内环(水域/不开放区域)内的点视为区域外 */
export function boundaryContains(geometry: BoundaryGeometry, point: BoundaryPoint): boolean {
  return boundaryPolygons(geometry).some(polygon => inRing(polygon[0]!, point)
    && !polygon.slice(1).some(ring => inRing(ring, point)))
}

/** 点到边界的最近距离(米)；点在区域内或边界上返回 0 */
export function distanceToBoundaryMeters(geometry: BoundaryGeometry, point: ApproachPoint): number {
  if (boundaryContains(geometry, [point.longitude, point.latitude])) return 0
  let min = Number.POSITIVE_INFINITY
  for (const polygon of boundaryPolygons(geometry)) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        min = Math.min(min, distanceToSegmentMeters(point, ring[index - 1]!, ring[index]!))
      }
    }
  }
  return min
}

/**
 * 计算用户位置到景点范围的距离(米)，语义与后端 CulturalPlaceRangeCalculator 一致：
 * 点 = 到锚点距离；圆 = max(0, 到圆心距离 - 半径)；多边形 = 区域内/边界为 0，外部取到边界最短距离。
 * anchor 为景点锚点(WGS84)，圆与点必需。
 */
export function distanceToPlaceRangeMeters(
  point: ApproachPoint,
  range: PlaceRange | null | undefined,
  anchor: ApproachPoint | null | undefined,
): number | null {
  if (!range || range.type === 'point') {
    return anchor ? metersBetween(point, anchor) : null
  }

  if (range.type === 'circle') {
    if (!anchor || !range.radiusMeters) return null
    return Math.max(0, metersBetween(point, anchor) - range.radiusMeters)
  }

  const geometry = parseBoundary(range.boundaryGeoJson)
  if (!geometry) return null
  return distanceToBoundaryMeters(geometry, point)
}

/** 位置是否落在景点范围内 */
export function containsPlaceRange(
  point: ApproachPoint,
  range: PlaceRange | null | undefined,
  anchor: ApproachPoint | null | undefined,
): boolean {
  const distance = distanceToPlaceRangeMeters(point, range, anchor)
  if (distance === null) return false
  if (!range || range.type === 'point') return distance <= 0.5
  if (range.type === 'circle') return distance <= 0
  return distance <= 0
}

/**
 * 统一接近判定：候选筛选、弹出卡片、解除提示必须都调用本函数，避免只改一处。
 * 返回 null 表示定位质量不足（未知状态），调用方应保留手动选择能力。
 */
export function resolveApproachPolicy(
  range: PlaceRange | null | undefined,
  fallback: ApproachPolicy = DEFAULT_APPROACH_POLICY,
): ApproachPolicy {
  const proximity = range?.proximityDistanceMeters ?? fallback.proximityMeters
  const releaseRaw = range?.releaseDistanceMeters ?? fallback.releaseMeters
  return {
    ...fallback,
    proximityMeters: proximity,
    releaseMeters: Math.max(proximity, releaseRaw),
  }
}

export function evaluateApproach(
  point: ApproachPoint,
  range: PlaceRange | null | undefined,
  anchor: ApproachPoint | null | undefined,
  policy: ApproachPolicy = DEFAULT_APPROACH_POLICY,
): ApproachResult {
  const distance = distanceToPlaceRangeMeters(point, range, anchor)
  const effective = resolveApproachPolicy(range, policy)
  return {
    distanceMeters: distance,
    withinRange: distance !== null && containsPlaceRange(point, range, anchor),
    approaching: distance !== null && distance <= effective.proximityMeters,
    releasing: distance === null || distance > effective.releaseMeters,
    proximityMeters: effective.proximityMeters,
    releaseMeters: effective.releaseMeters,
  }
}

/** 定位质量校验：精度、时间戳与时效性；不通过时调用方按"未知"处理 */
export function isUsableLocation(
  fix: { accuracy?: number | null; timestamp: number } | null | undefined,
  policy: ApproachPolicy = DEFAULT_APPROACH_POLICY,
  now = Date.now(),
): boolean {
  if (!fix) return false
  const accuracy = fix.accuracy ?? 0
  if (accuracy < 0 || accuracy > policy.maxAccuracyMeters) return false
  if (now - fix.timestamp > policy.maxAgeMs) return false
  if (fix.timestamp > now + 1000) return false
  return true
}

/** 把圆形范围离散为多边形环，供地图绘制（判定仍按半径计算） */
export function circleToRing(center: ApproachPoint, radiusMeters: number, segments = 64): BoundaryPoint[] {
  const metersPerDegreeLongitude = Math.abs(METERS_PER_DEGREE_LATITUDE * Math.cos((center.latitude * Math.PI) / 180)) < 1e-6
    ? METERS_PER_DEGREE_LATITUDE
    : METERS_PER_DEGREE_LATITUDE * Math.cos((center.latitude * Math.PI) / 180)
  const ring: BoundaryPoint[] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = (2 * Math.PI * index) / segments
    ring.push([
      center.longitude + (radiusMeters * Math.cos(angle)) / metersPerDegreeLongitude,
      center.latitude + (radiusMeters * Math.sin(angle)) / METERS_PER_DEGREE_LATITUDE,
    ])
  }
  return ring
}

/** 名称匹配默认区域（沿用原有行为） */
export function matchingDefaultArea<T extends { name?: string; level?: string }>(name: string, areas: T[]): T | null {
  const normalize = (value: string) => value.trim().replace(/\s+/g, '')
  const matches = areas.filter(area => normalize(area.name ?? '') === normalize(name)
    && !['country', 'province', 'city', 'district', 'street'].includes(area.level ?? ''))
  return matches.length === 1 ? matches[0]! : null
}

function inRing(ring: BoundaryPoint[], point: BoundaryPoint): boolean {
  let inside = false
  for (let index = 0; index < ring.length - 1; index += 1) {
    const start = ring[index]!
    const end = ring[index + 1]!
    const cross = (point[0] - start[0]) * (end[1] - start[1]) - (point[1] - start[1]) * (end[0] - start[0])
    if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0])
      && point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1])) return true
    if ((start[1] > point[1]) !== (end[1] > point[1])
      && point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]) inside = !inside
  }
  return inside
}

function distanceToSegmentMeters(point: ApproachPoint, start: BoundaryPoint, end: BoundaryPoint): number {
  let metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos((point.latitude * Math.PI) / 180)
  if (Math.abs(metersPerDegreeLongitude) < 1e-6) metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE

  const px = (point.longitude - start[0]) * metersPerDegreeLongitude
  const py = (point.latitude - start[1]) * METERS_PER_DEGREE_LATITUDE
  const bx = (end[0] - start[0]) * metersPerDegreeLongitude
  const by = (end[1] - start[1]) * METERS_PER_DEGREE_LATITUDE
  const lengthSquared = bx * bx + by * by
  const t = lengthSquared < 1e-6 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared))
  const nearestX = t * bx
  const nearestY = t * by
  return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2)
}
