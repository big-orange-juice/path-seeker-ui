import { request } from '@/services/http'
import { getAccessToken } from '@/services/authSession'

export interface TranslationRoom {
  roomId: string
  rickshawId: string
  isHost: boolean
  code: string
  sourceLanguage: string
  status: string
  listenerCount: number
  languages?: { language: string; count: number }[]
  qrImageDataUri?: string
}
export interface HostVehicle { rickshawId: string; vehicleNo: string; driverName?: string }
export const roomRequest = <Result>(path: string, data?: object) => request<Result>(`/TranslationRooms${path}`, {
  method: data ? 'POST' : 'GET', data,
})
export function roomSocket(roomId: string, kind: 'input' | 'events') {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const url = new URL(`${base}/TranslationRooms/${encodeURIComponent(roomId)}/${kind}`, location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(url, ['translation', `bearer.${getAccessToken()}`])
}
