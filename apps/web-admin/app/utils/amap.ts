let sdkPromise: Promise<any> | null = null

export function loadAdminAMap(config: { key: string; securityCode: string; securityProxy: string }) {
  if ((window as any).AMap) return Promise.resolve((window as any).AMap)
  if (sdkPromise) return sdkPromise
  if (!config.key) return Promise.reject(new Error('地图服务尚未配置。'))
  ;(window as any)._AMapSecurityConfig = config.securityProxy ? { serviceHost: config.securityProxy } : { securityJsCode: config.securityCode }
  const load = (version: string) => new Promise<any>((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => { script.remove(); reject(new Error('地图服务加载超时。')) }, 10000)
    script.src = `https://webapi.amap.com/maps?v=${version}&key=${encodeURIComponent(config.key)}`
    script.onload = () => { clearTimeout(timer); (window as any).AMap ? resolve((window as any).AMap) : reject(new Error('地图服务加载失败。')) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('地图服务加载失败。')) }
    document.head.appendChild(script)
  })
  sdkPromise = load('2.1Beta').catch(() => load('2.0')).catch(caught => { sdkPromise = null; throw caught })
  return sdkPromise
}
