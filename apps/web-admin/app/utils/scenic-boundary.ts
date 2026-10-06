/**
 * 景区边界与范围工具（管理端入口）。
 *
 * 实现已上移到 `@path-seeker/ts-shared`，与 C 端共用同一份几何代码：
 * 见设计文档 §2.1「边界划取与包含判定」与 §5.2「校验与几何工具」。
 * 此文件只做转发，保留既有 import 路径，避免各处调用点改动。
 */
export {
  parseBoundary,
  boundaryPolygons,
  boundaryContains,
  distanceToBoundaryMeters,
  metersBetween,
  circleToRing,
  matchingDefaultArea,
  resolveApproachPolicy,
  evaluateApproach,
  distanceToPlaceRangeMeters,
  containsPlaceRange,
  isUsableLocation,
  DEFAULT_APPROACH_POLICY,
  PLACE_RANGE_TYPE,
} from '@path-seeker/ts-shared';

export type {
  BoundaryPoint,
  BoundaryPolygon,
  BoundaryGeometry,
  PlaceRange,
  PlaceRangeType,
  ApproachPolicy,
  ApproachPoint,
  ApproachResult,
} from '@path-seeker/ts-shared';

/** 户外场馆类型：2=古镇景区 3=混合场馆 4=户外景点 */
export const isScenicVenue = (venueType = 1) => [2, 3, 4].includes(venueType);
