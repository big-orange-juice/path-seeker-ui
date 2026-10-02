let sdkPromise: Promise<any> | null = null

export function loadAMap() {
  if ((window as any).AMap) return Promise.resolve((window as any).AMap)
  if (sdkPromise) return sdkPromise
  const key = String(import.meta.env.VITE_AMAP_KEY || '').trim()
  if (!key) return Promise.reject(new Error('noMap'))
  const proxy = String(import.meta.env.VITE_AMAP_SECURITY_PROXY || '').trim()
  const securityCode = String(import.meta.env.VITE_AMAP_SECURITY_CODE || '').trim()
  ;(window as any)._AMapSecurityConfig = proxy ? { serviceHost: proxy } : { securityJsCode: securityCode }
  const load = (version: string) => new Promise<any>((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => { script.remove(); reject(new Error('noMap')) }, 10000)
    script.src = `https://webapi.amap.com/maps?v=${version}&key=${encodeURIComponent(key)}`
    script.onload = () => { clearTimeout(timer); (window as any).AMap ? resolve((window as any).AMap) : reject(new Error('noMap')) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('noMap')) }
    document.head.appendChild(script)
  })
  sdkPromise = load('2.1Beta').catch(() => load('2.0')).catch(caught => { sdkPromise = null; throw caught })
  return sdkPromise
}
