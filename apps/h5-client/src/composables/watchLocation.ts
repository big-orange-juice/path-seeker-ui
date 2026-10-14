import { TOUR_ARRIVAL_POLICY } from '@/utils/tourProgression'

/**
 * 浏览器定位的统一取数策略。
 *
 * 为什么需要这一层：`enableHighAccuracy: true` 在 Android Chromium/Edge 上会让
 * `watchPosition` 一直等待 GPS 级的新鲜定位。室内拿不到时它既不回调也不报错，
 * 表现为"12 秒 0 次回调、0 次错误"；而同一台设备用不强制高精度的请求可以立刻
 * 拿到 9 米左右的融合定位（见 public/location-check.html 的实测报告）。
 * 因此首次定位一律不强制高精度、并允许吃短时缓存，随后再机会性要一次高精度。
 *
 * 边界：这里只负责"拿到坐标"，不做前后台判定、不做坐标系转换、不判断是否满足
 * 接近阈值；精度是否够用由调用方按 ApproachPolicy 决定。
 */

export interface LocationFix {
  longitude: number
  latitude: number
  accuracy: number
  heading: number | null
  timestamp: number
}

export type LocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unknown'

export interface LocationWatchError {
  code: LocationErrorCode
  /** 保留浏览器原始错误码，便于现场排查 */
  rawCode: number | null
}

export interface LocationWatchOptions {
  /** 每次拿到定位都会回调，包含可机会性替换的改善定位 */
  onFix: (fix: LocationFix) => void
  onError?: (error: LocationWatchError) => void
  /** 首次拿到定位时回调一次 */
  onFirstFix?: () => void
  /** 精度达到该值（米）后不再索要高精度定位，缺省取接近判定的精度阈值 */
  goodAccuracyMeters?: number
}

export interface LocationWatchHandle {
  stop: () => void
}

/** 首帧允许的缓存时长：放宽到 10 秒，避免因为拒绝缓存而长时间没有定位 */
const QUICK_MAX_AGE_MS = 10_000
/** 高精度改善的观察窗口；超过后认为设备给不出更好的定位，避免长时间占用 GNSS */
const UPGRADE_WINDOW_MS = 90_000
/** 首次定位的超时；watchPosition 的 timeout 只约束单次请求，这里额外兜底 */
const QUICK_TIMEOUT_MS = 15_000
const UPGRADE_TIMEOUT_MS = 20_000

function toErrorCode(code: number | undefined): LocationWatchError {
  if (code === 1) return { code: 'denied', rawCode: 1 }
  if (code === 2) return { code: 'unavailable', rawCode: 2 }
  if (code === 3) return { code: 'timeout', rawCode: 3 }
  return { code: 'unknown', rawCode: typeof code === 'number' ? code : null }
}

function toFix(position: GeolocationPosition): LocationFix {
  // heading 只有移动中才有效，静止时浏览器会给 null/NaN，交给地图保持当前朝向
  const heading = Number(position.coords.heading)
  return {
    longitude: position.coords.longitude,
    latitude: position.coords.latitude,
    accuracy: position.coords.accuracy,
    heading: Number.isFinite(heading) ? heading : null,
    timestamp: position.timestamp,
  }
}

/** 在支持的设备上优先用 watchPosition（可持续刷新），否则回落为单次定位 */
function openRawWatch(
  options: PositionOptions,
  onFix: (fix: LocationFix) => void,
  onError: (error: LocationWatchError) => void,
): { stop: () => void } {
  if (typeof navigator.geolocation.watchPosition === 'function') {
    const id = navigator.geolocation.watchPosition(
      position => onFix(toFix(position)),
      error => onError(toErrorCode(error.code)),
      options,
    )
    return { stop: () => navigator.geolocation.clearWatch(id) }
  }
  let cancelled = false
  navigator.geolocation.getCurrentPosition(
    position => { if (!cancelled) onFix(toFix(position)) },
    error => { if (!cancelled) onError(toErrorCode(error.code)) },
    options,
  )
  return { stop: () => { cancelled = true } }
}

export function watchLocation(options: LocationWatchOptions): LocationWatchHandle {
  const goodAccuracy = options.goodAccuracyMeters ?? TOUR_ARRIVAL_POLICY.maxAccuracyMeters
  const startedAt = Date.now()
  let stopped = false
  let deliveredFirst = false
  let denialReported = false
  let quickWatch: { stop: () => void } | null = null
  let upgradeWatch: { stop: () => void } | null = null
  let upgradeTimer: ReturnType<typeof setTimeout> | undefined
  let firstFixTimer: ReturnType<typeof setTimeout> | undefined

  function stopWatch(target: { stop: () => void } | null) {
    if (target) target.stop()
  }

  function closeUpgrade() {
    if (upgradeTimer !== undefined) { clearTimeout(upgradeTimer); upgradeTimer = undefined }
    stopWatch(upgradeWatch)
    upgradeWatch = null
  }

  function startUpgrade() {
    if (stopped || upgradeWatch) return
    // 已经拿到足够好的定位且不在改善窗口内时不再索要高精度，避免无谓耗电
    if (deliveredFirst && Date.now() - startedAt > UPGRADE_WINDOW_MS) return
    upgradeWatch = openRawWatch(
      { enableHighAccuracy: true, maximumAge: 0, timeout: UPGRADE_TIMEOUT_MS },
      handleFix,
      handleUpgradeError,
    )
    upgradeTimer = setTimeout(closeUpgrade, UPGRADE_WINDOW_MS)
  }

  function handleFix(fix: LocationFix) {
    if (stopped) return
    options.onFix(fix)
    if (!deliveredFirst) {
      deliveredFirst = true
      if (firstFixTimer !== undefined) { clearTimeout(firstFixTimer); firstFixTimer = undefined }
      options.onFirstFix?.()
    }
    if (fix.accuracy <= goodAccuracy) closeUpgrade()
  }

  function handleQuickError(error: LocationWatchError) {
    if (stopped) return
    // 粗定位被系统禁用（或首帧就一直拿不到）时，首帧只能靠 GNSS：
    // 改以强制高精度重试一次，并等更久的缓存；只重试一次，避免反复挂起
    if (!deliveredFirst && error.code === 'unavailable') {
      stopWatch(quickWatch)
      quickWatch = openRawWatch(
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: UPGRADE_TIMEOUT_MS },
        handleFix,
        handleUpgradeError,
      )
      return
    }
    reportError(error)
  }

  /** 高精度通道只是改善手段：权限被拒时如实上报，其余错误保持静默，由首帧的超时兜底 */
  function handleUpgradeError(error: LocationWatchError) {
    if (stopped) return
    if (error.code === 'denied') reportError(error)
  }

  function reportError(error: LocationWatchError) {
    // 权限被拒只需上报一次，其余错误每次都上报，交给调用方决定提示与重试
    if (error.code === 'denied') {
      if (denialReported) return
      denialReported = true
    }
    options.onError?.(error)
  }

  quickWatch = openRawWatch(
    { enableHighAccuracy: false, maximumAge: QUICK_MAX_AGE_MS, timeout: QUICK_TIMEOUT_MS },
    handleFix,
    handleQuickError,
  )
  startUpgrade()

  return {
    stop() {
      stopped = true
      if (firstFixTimer !== undefined) { clearTimeout(firstFixTimer); firstFixTimer = undefined }
      closeUpgrade()
      stopWatch(quickWatch)
      quickWatch = null
    },
  }
}
