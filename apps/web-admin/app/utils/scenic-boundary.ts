export type BoundaryPoint = [number, number];
export type BoundaryPolygon = BoundaryPoint[][];
export interface BoundaryGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: BoundaryPolygon | BoundaryPolygon[];
}

export const isScenicVenue = (venueType = 1) => [2, 3, 4].includes(venueType);

export function parseBoundary(source: string | null | undefined): BoundaryGeometry | null {
  if (!source) return null;
  try {
    const parsed = JSON.parse(source);
    const geometry = parsed.type === 'Feature' ? parsed.geometry : parsed;
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(polygons) || !polygons.length) return null;
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) return null;
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2001) return null;
        if (!ring.every((point: unknown) => Array.isArray(point) && point.length === 2
          && Number.isFinite(point[0]) && Number.isFinite(point[1])
          && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) return null;
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) return null;
        if (new Set(ring.slice(0, -1).map((point: BoundaryPoint) => point.join(','))).size < 3) return null;
        let area = 0;
        for (let index = 0; index < ring.length - 1; index += 1) {
          const point = ring[index];
          const next = ring[index + 1];
          if (point[0] === next[0] && point[1] === next[1]) return null;
          area += (point[0] - first[0]) * (next[1] - first[1]) - (point[1] - first[1]) * (next[0] - first[0]);
        }
        if (Math.abs(area) < 1e-12) return null;
      }
    }
    return geometry as BoundaryGeometry;
  } catch { return null; }
}

export function boundaryPolygons(geometry: BoundaryGeometry): BoundaryPolygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates as BoundaryPolygon] : geometry.coordinates as BoundaryPolygon[];
}

export function boundaryContains(geometry: BoundaryGeometry, point: BoundaryPoint): boolean {
  const inRing = (ring: BoundaryPoint[]) => {
    let inside = false;
    for (let index = 0; index < ring.length - 1; index += 1) {
      const start = ring[index]!;
      const end = ring[index + 1]!;
      const cross = (point[0] - start[0]) * (end[1] - start[1]) - (point[1] - start[1]) * (end[0] - start[0]);
      if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0])
        && point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1])) return true;
      if ((start[1] > point[1]) !== (end[1] > point[1])
        && point[0] < (end[0] - start[0]) * (point[1] - start[1]) / (end[1] - start[1]) + start[0]) inside = !inside;
    }
    return inside;
  };
  return boundaryPolygons(geometry).some(polygon => inRing(polygon[0]!) && !polygon.slice(1).some(inRing));
}

export function matchingDefaultArea<T extends { name?: string; level?: string }>(name: string, areas: T[]): T | null {
  const normalize = (value: string) => value.trim().replace(/\s+/g, '');
  const matches = areas.filter(area => normalize(area.name ?? '') === normalize(name)
    && !['country', 'province', 'city', 'district', 'street'].includes(area.level ?? ''));
  return matches.length === 1 ? matches[0]! : null;
}
