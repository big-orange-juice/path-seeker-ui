import { shallowRef } from 'vue'

export interface BrowserLocationResult {
  longitude: number
  latitude: number
  accuracy: number
}

function transformWgs84ToGcj02(longitude: number, latitude: number) {
  if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) return { longitude, latitude }
  const axis = 6378245
  const eccentricity = 0.006693421622965943
  const offsetLongitude = longitude - 105
  const offsetLatitude = latitude - 35
  let latitudeDelta = -100 + 2 * offsetLongitude + 3 * offsetLatitude + .2 * offsetLatitude ** 2 + .1 * offsetLongitude * offsetLatitude + .2 * Math.sqrt(Math.abs(offsetLongitude))
  latitudeDelta += (20 * Math.sin(6 * offsetLongitude * Math.PI) + 20 * Math.sin(2 * offsetLongitude * Math.PI)) * 2 / 3
  latitudeDelta += (20 * Math.sin(offsetLatitude * Math.PI) + 40 * Math.sin(offsetLatitude / 3 * Math.PI)) * 2 / 3
  latitudeDelta += (160 * Math.sin(offsetLatitude / 12 * Math.PI) + 320 * Math.sin(offsetLatitude * Math.PI / 30)) * 2 / 3
  let longitudeDelta = 300 + offsetLongitude + 2 * offsetLatitude + .1 * offsetLongitude ** 2 + .1 * offsetLongitude * offsetLatitude + .1 * Math.sqrt(Math.abs(offsetLongitude))
  longitudeDelta += (20 * Math.sin(6 * offsetLongitude * Math.PI) + 20 * Math.sin(2 * offsetLongitude * Math.PI)) * 2 / 3
  longitudeDelta += (20 * Math.sin(offsetLongitude * Math.PI) + 40 * Math.sin(offsetLongitude / 3 * Math.PI)) * 2 / 3
  longitudeDelta += (150 * Math.sin(offsetLongitude / 12 * Math.PI) + 300 * Math.sin(offsetLongitude / 30 * Math.PI)) * 2 / 3
  const radianLatitude = latitude / 180 * Math.PI
  let magic = Math.sin(radianLatitude)
  magic = 1 - eccentricity * magic * magic
  const squareRootMagic = Math.sqrt(magic)
  latitudeDelta = latitudeDelta * 180 / ((axis * (1 - eccentricity)) / (magic * squareRootMagic) * Math.PI)
  longitudeDelta = longitudeDelta * 180 / (axis / squareRootMagic * Math.cos(radianLatitude) * Math.PI)
  return { longitude: longitude + longitudeDelta, latitude: latitude + latitudeDelta }
}

export function useBrowserLocation() {
  const location = shallowRef<BrowserLocationResult | null>(null)
  const pending = shallowRef(false)
  const error = shallowRef('')
  function locate() {
    if (!navigator.geolocation) { error.value = '当前浏览器不支持定位'; return }
    pending.value = true; error.value = ''
    navigator.geolocation.getCurrentPosition(position => {
      const point = transformWgs84ToGcj02(position.coords.longitude, position.coords.latitude)
      location.value = { ...point, accuracy: position.coords.accuracy }
      pending.value = false
    }, caught => {
      error.value = caught.code === 1 ? '未获得定位权限，仍可浏览地图' : '定位失败，请稍后重试'
      pending.value = false
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 })
  }
  return { location, pending, error, locate }
}
