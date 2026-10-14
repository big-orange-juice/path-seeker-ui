import { getAccessToken } from '@/services/authSession'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export interface VoiceTranscriptionResult {
  text: string
}

export async function transcribeVoiceAudio(blob: Blob, signal: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'utterance.wav')
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getAccessToken()
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`

  const timeout = new AbortController()
  const cancel = () => timeout.abort()
  if (signal.aborted) cancel()
  else signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 65000)
  try {
    const response = await fetch(`${API_BASE_URL}/ExhibitChat/transcribe`, {
      method: 'POST', headers, body: form, signal: timeout.signal,
    })
    const payload = await response.json().catch(() => null) as {
      code?: number
      message?: string
      data?: VoiceTranscriptionResult | null
    } | null
    if (!response.ok || payload?.code !== 0) {
      throw new Error(payload?.message || `语音识别失败（${response.status}）`)
    }
    const text = String(payload?.data?.text || '').trim()
    if (!text) throw new Error('没有识别到内容，请说得更完整一些。')
    return text
  } catch (caught) {
    if (timeout.signal.aborted && !signal.aborted) throw new Error('语音识别超时，请重试或使用文字输入。')
    throw caught
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}
