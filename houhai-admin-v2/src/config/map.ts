// 地图配置与 C 端保持一致：统一使用高德，Key 与安全配置从 .env.local 读取。
export const mapConfig = {
  amapKey: import.meta.env.VITE_AMAP_KEY || '',
  amapSecurityCode: import.meta.env.VITE_AMAP_SECURITY_CODE || '',
  amapSecurityProxy: import.meta.env.VITE_AMAP_SECURITY_PROXY || '',
  zoom: 15,
  minZoom: 12,
  maxZoom: 19,
}
