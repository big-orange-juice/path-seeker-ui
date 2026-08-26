export const COORDINATE_SYSTEM = {
  WGS84: 1,
  GCJ02: 2,
  BD09: 3,
} as const

export type CoordinateSystem = (typeof COORDINATE_SYSTEM)[keyof typeof COORDINATE_SYSTEM]

export interface GeoPoint {
  longitude: number
  latitude: number
}

export type GeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPoint"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] }

export interface GeoLocation {
  id: string | null
  exhibitId: string | null
  locationType: number
  longitude: number | null
  latitude: number | null
  altitudeMeters: number | null
  geometryGeoJson: string | null
  coordinateSystem: CoordinateSystem
  locationName: string | null
  floorLabel: string | null
  entranceName: string | null
  isPrimary: number
  accuracyMeters: number | null
  sourceType: number
  sourceNote: string | null
  sortOrder: number
}

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  return Boolean(
    point
      && Number.isFinite(point.longitude)
      && Number.isFinite(point.latitude)
      && point.longitude >= -180
      && point.longitude <= 180
      && point.latitude >= -90
      && point.latitude <= 90,
  )
}

export function toGeoPoint(location: Pick<GeoLocation, "longitude" | "latitude"> | null | undefined) {
  if (location?.longitude == null || location.latitude == null) return null
  const point = { longitude: location.longitude, latitude: location.latitude }
  return isValidGeoPoint(point) ? point : null
}

export function parseGeoJsonGeometry(value: string | null | undefined): GeoJsonGeometry | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<GeoJsonGeometry>
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string" || !("coordinates" in parsed)) {
      return null
    }
    return parsed as GeoJsonGeometry
  } catch {
    return null
  }
}
