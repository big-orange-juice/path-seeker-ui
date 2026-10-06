/**
 * 路线地图几何工具（渲染与编辑共用一份实现）。
 *
 * - 只做 GeoJSON 解析 / 序列化与坐标校验，不含任何请求与地图 SDK 依赖。
 * - 坐标一律 WGS84；渲染前由 MapCanvas 自行转换为 GCJ-02。
 * - 吸附后的人工路段允许是 MultiLineString（见设计文档 §6），
 *   因此解析必须同时支持 LineString / MultiLineString / Feature 包装。
 */

export type LngLat = [number, number];

/** 路线地图几何坐标系：1=WGS84 2=GCJ-02 3=BD-09（与后端 CoordinateSystem 一致） */
export const ROUTE_COORDINATE_SYSTEM = {
  WGS84: 1,
  GCJ02: 2,
  BD09: 3,
} as const;

/** 路段来源：1=自动生成 2=人工编辑 */
export const ROUTE_SEGMENT_SOURCE = {
  AUTO: 1,
  MANUAL: 2,
} as const;

/** 相邻顶点之间距离小于该值(度)时视为重复点，避免吸附后出现零长度线段 */
const DEGREE_EPSILON = 1e-9;

export function isLngLat(value: unknown): value is LngLat {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Math.abs(Number(value[0])) <= 180
    && Math.abs(Number(value[1])) <= 90;
}

/**
 * 解析路线几何为多段线数组。
 * 解析失败、类型不支持或坐标非法一律返回空数组，调用方据此显示"待绘制"。
 */
export function parseRouteLines(source: string | null | undefined): LngLat[][] {
  if (!source) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const geometry = record.type === 'Feature'
    ? (record.geometry as Record<string, unknown> | null | undefined)
    : record;

  if (!geometry || typeof geometry !== 'object') {
    return [];
  }

  const type = String((geometry as Record<string, unknown>).type ?? '');
  const coordinates = (geometry as Record<string, unknown>).coordinates;

  if (type === 'LineString') {
    const line = toLine(coordinates);
    return line ? [line] : [];
  }

  if (type === 'MultiLineString') {
    if (!Array.isArray(coordinates)) {
      return [];
    }
    return coordinates
      .map((item) => toLine(item))
      .filter((line): line is LngLat[] => line !== null);
  }

  return [];
}

/** 解析单段几何并按相邻点去重，返回顶点列表（WGS84） */
export function parseRouteLine(source: string | null | undefined): LngLat[] {
  const lines = parseRouteLines(source);
  if (!lines.length) {
    return [];
  }

  const merged: LngLat[] = [];
  for (const line of lines) {
    for (const point of line) {
      const previous = merged[merged.length - 1];
      if (previous && samePoint(previous, point)) {
        continue;
      }
      merged.push(point);
    }
  }

  return merged;
}

/**
 * 序列化编辑中的顶点列表。
 * 少于 2 个顶点时返回 null，交由调用方判定"路段待绘制"。
 *
 * 注意：保存给后端的几何必须是单条 LineString——后端 ValidateLine 只接受
 * `{"type":"LineString"}`，且既有的确认/校验与 C 端渲染都按单条折线处理。
 * 解析侧仍兼容 MultiLineString，是为了读取历史或外部写入的数据。
 */
export function serializeRouteLine(points: LngLat[]): string | null {
  const normalized = normalizePoints(points);
  if (normalized.length < 2) {
    return null;
  }

  return JSON.stringify({
    type: 'LineString',
    coordinates: normalized,
  });
}

/** 去掉相邻重复点与非法坐标 */
export function normalizePoints(points: readonly LngLat[]): LngLat[] {
  const normalized: LngLat[] = [];
  for (const point of points) {
    if (!isLngLat(point)) {
      continue;
    }
    const next: LngLat = [Number(point[0]), Number(point[1])];
    const previous = normalized[normalized.length - 1];
    if (previous && samePoint(previous, next)) {
      continue;
    }
    normalized.push(next);
  }
  return normalized;
}

export function samePoint(left: LngLat, right: LngLat): boolean {
  return Math.abs(left[0] - right[0]) < DEGREE_EPSILON
    && Math.abs(left[1] - right[1]) < DEGREE_EPSILON;
}

/** 两点距离(米)，用于编辑期长度提示；口径与 ts-shared geo-range.metersBetween 一致 */
export function polylineLengthMeters(points: readonly LngLat[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += metersBetween(points[index - 1]!, points[index]!);
  }
  return total;
}

const EARTH_RADIUS_METERS = 6371008.8;

function metersBetween(from: LngLat, to: LngLat): number {
  const radLat1 = (from[1] * Math.PI) / 180;
  const radLat2 = (to[1] * Math.PI) / 180;
  const deltaLat = ((to[1] - from[1]) * Math.PI) / 180;
  const deltaLng = ((to[0] - from[0]) * Math.PI) / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 顶点索引的稳定键，供撤销重做比较 */
export function pointsSignature(points: readonly LngLat[]): string {
  return points.map((point) => `${point[0].toFixed(7)},${point[1].toFixed(7)}`).join(';');
}

function toLine(source: unknown): LngLat[] | null {
  if (!Array.isArray(source)) {
    return null;
  }

  const line: LngLat[] = [];
  for (const item of source) {
    if (!isLngLat(item)) {
      return null;
    }
    line.push([Number(item[0]), Number(item[1])]);
  }

  return line.length ? line : null;
}
