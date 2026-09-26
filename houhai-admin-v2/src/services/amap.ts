import { mapConfig } from '../config/map'

export interface AmapOverlay {
  on: (event: string, callback: () => void) => void
  setPosition?: (position: [number, number]) => void
}
export interface AmapLngLat { getLng: () => number; getLat: () => number }
export interface AmapInstance {
  add: (overlays: AmapOverlay[]) => void
  remove: (overlays: AmapOverlay[]) => void
  setFitView: (overlays: AmapOverlay[], immediately: boolean, padding: number[], maxZoom: number) => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void
  setPitch: (pitch: number, immediately?: boolean) => void
  setRotation: (rotation: number, immediately?: boolean) => void
  setFeatures: (features: string[]) => void
  resize: () => void
  destroy: () => void
}
export interface AmapSdk {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => AmapInstance
  Marker: new (options: Record<string, unknown>) => AmapOverlay
  Polyline: new (options: Record<string, unknown>) => AmapOverlay
  Pixel: new (horizontal: number, vertical: number) => unknown
}

declare global {
  interface Window {
    AMap?: AmapSdk
    _AMapSecurityConfig?: { serviceHost?: string; securityJsCode?: string }
  }
}

let amapPromise: Promise<AmapSdk> | undefined

function injectAmap(version: string): Promise<AmapSdk> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => fail(), 8000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error(`高德地图 ${version} 加载失败，请检查 Key、域名白名单与安全配置。`))
    }
    script.src = `https://webapi.amap.com/maps?v=${version}&key=${encodeURIComponent(mapConfig.amapKey)}`
    script.onerror = fail
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.AMap?.Map) resolve(window.AMap)
      else fail()
    }
    document.head.append(script)
  })
}

/** 加载高德 JS SDK：优先 2.1Beta（支持体块高度），失败回退 2.0。 */
export function loadAmap(): Promise<AmapSdk> {
  if (!mapConfig.amapKey || (!mapConfig.amapSecurityCode && !mapConfig.amapSecurityProxy)) {
    return Promise.reject(new Error('高德地图尚未配置：请在 .env.local 填写 VITE_AMAP_KEY 与安全配置。'))
  }
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise
  window._AMapSecurityConfig = mapConfig.amapSecurityProxy
    ? { serviceHost: mapConfig.amapSecurityProxy }
    : { securityJsCode: mapConfig.amapSecurityCode }
  amapPromise = (async () => {
    let failure: unknown
    for (const version of ['2.1Beta', '2.0']) {
      try { return await injectAmap(version) } catch (error) { failure = error }
    }
    amapPromise = undefined
    throw failure instanceof Error ? failure : new Error('高德地图加载失败，请检查 Key、域名白名单与安全配置。')
  })()
  return amapPromise
}
