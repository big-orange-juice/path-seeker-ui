/**
 * 景点本体范围契约（§5 景点范围及接近判定）。
 *
 * 对齐后端 `CulturalPlaceController` 的 UpdateRange / CopyAreaBoundary / EvaluateRange 与
 * `CulturalPlaceAdminResponse` 的范围字段：
 * - `rangeType`：1=点 2=圆 3=多边形（历史数据为 1）；
 * - `boundaryGeoJson` 与景点 `longitude/latitude` 使用同一 `coordinateSystem` 存储；
 *   `destinationBoundaryGeoJson` / `siteAreaBoundaryGeoJson` 由后端统一输出 **WGS84**；
 * - `siteAreaId` 为 "0" 表示不关联片区；
 * - 阈值字段为空表示跟随全局默认（`defaultProximityDistanceMeters` / `defaultReleaseDistanceMeters`）。
 */

/** 范围类型：1=点 2=圆 3=多边形 */
export const PLACE_RANGE_TYPE = { POINT: 1, CIRCLE: 2, POLYGON: 3 } as const

export type PlaceRangeType = (typeof PLACE_RANGE_TYPE)[keyof typeof PLACE_RANGE_TYPE]

/** 范围类型中文名，供 Select 与只读展示共用 */
export const PLACE_RANGE_TYPE_LABEL: Readonly<Record<number, string>> = {
  1: '点',
  2: '圆',
  3: '多边形',
}

/** POST /api/CulturalPlace/UpdateRange */
export interface UpdatePlaceRangeRequest {
  id: string
  rangeType: PlaceRangeType
  /** 圆形半径（米）；rangeType=2 时必填且大于 0 */
  rangeRadiusMeters?: number | null
  /** 多边形 GeoJSON（Polygon/MultiPolygon，按景点坐标系）；rangeType=3 时必填 */
  boundaryGeoJson?: string | null
  /** 归属景区区域 ID；不传或 "0" 表示不关联 */
  siteAreaId?: string | null
  /** 接近阈值（米）；不传表示跟随全局默认 */
  proximityDistanceMeters?: number | null
  /** 解除阈值（米）；不传表示跟随全局默认，且不得小于接近阈值 */
  releaseDistanceMeters?: number | null
  /** 并发校验版本；传入且与当前不一致时后端返回 10005 冲突 */
  rangeVersion?: number
}

/** POST /api/CulturalPlace/CopyAreaBoundary：返回按景点坐标系转换后的 GeoJSON 字符串 */
export interface CopyAreaBoundaryRequest {
  id: string
  /** 不传时使用景点当前 siteAreaId */
  siteAreaId?: string | null
}

/** POST /api/CulturalPlace/EvaluateRange：模拟用户位置校验判定结果 */
export interface EvaluatePlaceRangeRequest {
  id: string
  longitude: number
  latitude: number
}

export interface PlaceRangeEvaluation {
  placeId: string
  rangeType: number
  /** 用户位置到范围的距离（米）；几何缺失时为 null */
  distanceMeters: number | null
  isWithinRange: boolean
  /** 生效的接近阈值（米） */
  proximityDistanceMeters: number
  /** 生效的解除阈值（米） */
  releaseDistanceMeters: number
  isApproaching: boolean
}

/**
 * 景点范围相关业务错误码（与后端 `ErrorCodes` 对齐）。
 * 12011 表示范围超出父级目的地边界：越界数据不落库，必须引导用户先去扩大父级目的地边界。
 */
export const PLACE_RANGE_ERROR_CODE = {
  RANGE_INVALID: 12010,
  RANGE_OUT_OF_DESTINATION: 12011,
  RANGE_THRESHOLD_INVALID: 12012,
  SITE_AREA_NOT_FOUND: 12013,
} as const

/** 12011 越界引导所需的上下文：点击「去编辑目的地边界」时带上当前范围坐标作参考 */
export interface RangeOutOfDestinationContext {
  /** 父级目的地（museum）ID */
  destinationId: string
  destinationName: string
  /** 触发越界的范围坐标（WGS84 经纬度列表），作为目标页面参考 */
  referencePoints: { longitude: number; latitude: number }[]
  /** 后端返回的越界提示原文 */
  message: string
}
