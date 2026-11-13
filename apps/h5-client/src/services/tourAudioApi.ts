import { request } from './http'

export const tourAudioRequest = <Result>(path: string, method: 'GET' | 'POST' | 'DELETE', data?: object) => request<Result>(path, { method, data })

export function tourAudioMediaUrl(value: string) {
  if (typeof value !== 'string' || !value.startsWith('/TourAudioSessions/')) throw Error('持续讲解地址无效')
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const url = new URL(`${base}${value}`, location.origin)
  if (!['https:', 'http:'].includes(url.protocol) || location.protocol === 'https:' && url.protocol !== 'https:') throw Error('持续讲解需要安全的音频地址')
  return url.href
}
