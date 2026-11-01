import { getAccessToken } from './authSession'

export async function uploadRoomQuestion(roomId: string, wav: ArrayBuffer, requestId: string, signal: AbortSignal) {
  const data = new FormData()
  data.append('requestId', requestId)
  data.append('file', new Blob([wav], { type: 'audio/wav' }), 'question.wav')
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const token = getAccessToken()
  const response = await fetch(`${base}/TranslationRooms/${encodeURIComponent(roomId)}/questions`, {
    method: 'POST', headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }, body: data, signal,
  })
  const result = await response.json()
  if (!response.ok || result?.code !== 0) throw Error(result?.message || 'question_failed')
  return result.data as { questionId: string; status: string }
}
