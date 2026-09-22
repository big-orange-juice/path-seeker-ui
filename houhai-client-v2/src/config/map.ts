export const mapConfig = {
  amapKey: import.meta.env.VITE_AMAP_KEY || '',
  amapSecurityCode: import.meta.env.VITE_AMAP_SECURITY_CODE || '',
  amapSecurityProxy: import.meta.env.VITE_AMAP_SECURITY_PROXY || '',
  center: [116.3815, 39.9402] as [number, number],
  zoom: 15,
  minZoom: 12,
  maxZoom: 18,
}
