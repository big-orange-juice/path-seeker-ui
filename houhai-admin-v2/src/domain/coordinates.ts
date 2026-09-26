import type { Coordinate } from '../types'

/** WGS84 → GCJ02：高德底图为火星坐标系，站点数据仍是 WGS84，绘制前统一转换。 */
export function wgs84ToGcj02(coordinate: Coordinate): Coordinate {
  const { longitude, latitude } = coordinate
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

/** 高德坐标 [经度, 纬度]，与业务坐标对象互转。 */
export function toAmapPosition(coordinate: Coordinate): [number, number] {
  const converted = wgs84ToGcj02(coordinate)
  return [converted.longitude, converted.latitude]
}
