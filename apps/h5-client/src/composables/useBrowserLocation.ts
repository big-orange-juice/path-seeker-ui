import { shallowRef } from 'vue'
import { wgs84ToGcj02 } from '@path-seeker/ts-shared'

export interface BrowserLocationResult {
  longitude: number
  latitude: number
  accuracy: number
}

export function transformWgs84ToGcj02(longitude: number, latitude: number) {
  return wgs84ToGcj02({ longitude, latitude })
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
