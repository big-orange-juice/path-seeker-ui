/**
 * 景点本体范围几何（管理端共用）。
 *
 * 解析与接近判定都在 `@path-seeker/ts-shared`，这里只解决一件事：把文化点记录里的范围
 * （点/圆/多边形，按景点自身 `coordinateSystem` 存储）投影成高德可直接绘制的 GCJ-02 环。
 * 景区景点地图与路线编排地图都调用这里，避免两处各写一份坐标系转换。
 */
import { toGcj02 } from '@path-seeker/ts-shared';
import { PLACE_RANGE_TYPE, boundaryPolygons, circleToRing, parseBoundary, type BoundaryPoint } from '@/utils/scenic-boundary';

/** 只声明绘制范围需要读取的字段，方便调用方传入更窄的结构 */
export interface PlaceRangeSource {
  rangeType?: number | null;
  rangeRadiusMeters?: number | null;
  boundaryGeoJson?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  coordinateSystem?: number | null;
}

/**
 * 范围面路径：外层是面、中层是环（首个为外环，其余为内环）、内层是 GCJ-02 坐标点。
 * 点范围本身没有面，返回空数组；圆缺半径、多边形缺合法几何时同样返回空数组，由调用方跳过绘制。
 */
export function placeRangeGcj02Paths(place: PlaceRangeSource): BoundaryPoint[][][] {
  const coordinateSystem = place.coordinateSystem ?? 1;
  const rangeType = Number(place.rangeType ?? PLACE_RANGE_TYPE.POINT);
  if (rangeType === PLACE_RANGE_TYPE.CIRCLE) {
    const radius = Number(place.rangeRadiusMeters);
    if (place.longitude == null || place.latitude == null || !(radius > 0)) return [];
    const ring = circleToRing({ longitude: place.longitude, latitude: place.latitude }, radius)
      .map(point => project(point[0], point[1], coordinateSystem));
    return [[ring]];
  }
  if (rangeType !== PLACE_RANGE_TYPE.POLYGON) return [];
  const geometry = parseBoundary(place.boundaryGeoJson);
  if (!geometry) return [];
  return boundaryPolygons(geometry)
    .map(polygon => polygon.map(ring => ring.map(point => project(point[0], point[1], coordinateSystem))));
}

function project(longitude: number, latitude: number, coordinateSystem: number): BoundaryPoint {
  const point = toGcj02({ longitude, latitude }, coordinateSystem);
  return [point.longitude, point.latitude];
}
