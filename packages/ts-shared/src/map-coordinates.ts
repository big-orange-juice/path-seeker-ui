import { COORDINATE_SYSTEM, type GeoPoint } from './geo'

export function wgs84ToGcj02(point: GeoPoint): GeoPoint {
  const { longitude, latitude } = point
  if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) return { longitude, latitude }
  const offsetLongitude = longitude - 105
  const offsetLatitude = latitude - 35
  let deltaLatitude = -100 + 2 * offsetLongitude + 3 * offsetLatitude + 0.2 * offsetLatitude ** 2 + 0.1 * offsetLongitude * offsetLatitude + 0.2 * Math.sqrt(Math.abs(offsetLongitude))
  deltaLatitude += (20 * Math.sin(6 * offsetLongitude * Math.PI) + 20 * Math.sin(2 * offsetLongitude * Math.PI)) * 2 / 3
  deltaLatitude += (20 * Math.sin(offsetLatitude * Math.PI) + 40 * Math.sin(offsetLatitude / 3 * Math.PI)) * 2 / 3
  deltaLatitude += (160 * Math.sin(offsetLatitude / 12 * Math.PI) + 320 * Math.sin(offsetLatitude * Math.PI / 30)) * 2 / 3
  let deltaLongitude = 300 + offsetLongitude + 2 * offsetLatitude + 0.1 * offsetLongitude ** 2 + 0.1 * offsetLongitude * offsetLatitude + 0.1 * Math.sqrt(Math.abs(offsetLongitude))
  deltaLongitude += (20 * Math.sin(6 * offsetLongitude * Math.PI) + 20 * Math.sin(2 * offsetLongitude * Math.PI)) * 2 / 3
  deltaLongitude += (20 * Math.sin(offsetLongitude * Math.PI) + 40 * Math.sin(offsetLongitude / 3 * Math.PI)) * 2 / 3
  deltaLongitude += (150 * Math.sin(offsetLongitude / 12 * Math.PI) + 300 * Math.sin(offsetLongitude / 30 * Math.PI)) * 2 / 3
  const radians = latitude / 180 * Math.PI
  const eccentricity = 0.006693421622965943
  const magic = 1 - eccentricity * Math.sin(radians) ** 2
  const rootMagic = Math.sqrt(magic)
  deltaLatitude = deltaLatitude * 180 / ((6378245 * (1 - eccentricity)) / (magic * rootMagic) * Math.PI)
  deltaLongitude = deltaLongitude * 180 / (6378245 / rootMagic * Math.cos(radians) * Math.PI)
  return { longitude: longitude + deltaLongitude, latitude: latitude + deltaLatitude }
}

export function gcj02ToWgs84(point: GeoPoint): GeoPoint {
  let result = { ...point }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const projected = wgs84ToGcj02(result)
    result = { longitude: result.longitude + point.longitude - projected.longitude, latitude: result.latitude + point.latitude - projected.latitude }
  }
  return result
}

export function toGcj02(point: GeoPoint, coordinateSystem = COORDINATE_SYSTEM.WGS84 as number): GeoPoint {
  if (coordinateSystem === COORDINATE_SYSTEM.GCJ02) return { ...point }
  if (coordinateSystem === COORDINATE_SYSTEM.BD09) {
    const longitude = point.longitude - 0.0065
    const latitude = point.latitude - 0.006
    const angle = Math.PI * 3000 / 180
    const radius = Math.sqrt(longitude ** 2 + latitude ** 2) - 0.00002 * Math.sin(latitude * angle)
    const theta = Math.atan2(latitude, longitude) - 0.000003 * Math.cos(longitude * angle)
    return { longitude: radius * Math.cos(theta), latitude: radius * Math.sin(theta) }
  }
  return wgs84ToGcj02(point)
}
