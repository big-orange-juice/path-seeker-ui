import { shallowRef } from 'vue'
import { wgs84ToGcj02 } from '@path-seeker/ts-shared'
import { watchLocation, type LocationWatchError, type LocationWatchHandle } from '@/composables/watchLocation'

export interface BrowserLocationResult {
  longitude: number
  latitude: number
  accuracy: number
}

export function transformWgs84ToGcj02(longitude: number, latitude: number) {
  return wgs84ToGcj02({ longitude, latitude })
}

/**
 * 地图控制条使用的单次定位。
 *
 * 取数与导览共用 watchLocation：首帧不强制高精度，再接受高精度改善。
 * 因此这里不是在"等一次最准的定位"，而是尽快给地图一个可用点，随后由改善定位覆盖；
 * 返回的坐标统一转换为 GCJ-02，供高德底图直接使用。
 */
export function useBrowserLocation() {
  const location = shallowRef<BrowserLocationResult | null>(null)
  const pending = shallowRef(false)
  const error = shallowRef('')
  let watch: LocationWatchHandle | null = null

  function settle() {
    pending.value = false
    watch?.stop()
    watch = null
  }

  function locate() {
    if (!navigator.geolocation) { error.value = '当前浏览器不支持定位'; return }
    pending.value = true
    error.value = ''
    settle()
    watch = watchLocation({
      onFix: fix => {
        location.value = { ...transformWgs84ToGcj02(fix.longitude, fix.latitude), accuracy: fix.accuracy }
      },
      // 先让按钮从"定位中"恢复，改善定位随后原地更新地图上的点
      onFirstFix: () => { pending.value = false },
      // 权限被拒绝无法靠重试恢复；其余失败保留"稍后重试"的提示
      onError: (watchError: LocationWatchError) => {
        error.value = watchError.code === 'denied' ? '未获得定位权限，仍可浏览地图' : '定位失败，请稍后重试'
        settle()
      },
    })
  }

  return { location, pending, error, locate }
}
