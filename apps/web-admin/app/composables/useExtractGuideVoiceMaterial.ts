import { resolveHttpErrorMessage } from '@path-seeker/ts-shared'
import { useAdminAuthStore } from '@/stores/adminAuth'
import { resolveApiErrorMessage } from '@/composables/useApiClient'

/** 与 server 侧一致：音频 20MB / 视频 400MB */
export const MAX_VOICE_AUDIO_BYTES = 20 * 1024 * 1024
export const MAX_VOICE_VIDEO_BYTES = 400 * 1024 * 1024

export interface ExtractVoiceMaterialResult {
  file: File
  fromVideo: boolean
}

export interface ExtractVoiceMaterialOptions {
  /** 0–100；上传阶段约 0–80，服务端提取等待约 80–95，完成 100 */
  onProgress?: (percent: number, phase: 'upload' | 'extract' | 'done') => void
  signal?: AbortSignal
}

const joinAppApiUrl = (baseURL: string, path: string) => {
  const base = String(baseURL || '/').replace(/\/?$/, '/')
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}${normalizedPath}`
}

const readXhrPayload = async (xhr: XMLHttpRequest) => {
  const response = xhr.response
  if (response instanceof Blob) {
    const text = (await response.text()).trim()
    if (!text) {
      return null
    }
    try {
      return JSON.parse(text) as unknown
    } catch {
      return { message: text }
    }
  }

  const raw = String(xhr.responseText || '').trim()
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return { message: raw }
  }
}

const pickErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }
  const record = payload as Record<string, unknown>
  const nested = record.data && typeof record.data === 'object'
    ? (record.data as Record<string, unknown>)
    : null
  const candidates = [
    nested?.message,
    record.message,
    record.statusMessage,
  ]
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim()
    }
  }
  return fallback
}

/**
 * 将视频上传到 BFF 抽音频；带上传进度（XHR）。
 * 音频也可走同一接口，服务端原样返回。
 */
export const useExtractGuideVoiceMaterial = () => {
  const runtimeConfig = useRuntimeConfig()
  const authStore = useAdminAuthStore()

  const extractVoiceMaterial = (
    file: File,
    options: ExtractVoiceMaterialOptions = {},
  ): Promise<ExtractVoiceMaterialResult> => {
    const url = joinAppApiUrl(
      String(runtimeConfig.app.baseURL || '/'),
      '/api/guide/extract-voice-material',
    )

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.responseType = 'blob'
      xhr.withCredentials = true

      /** 上传结束后服务端 ffmpeg 可能较久，缓慢爬升进度避免“卡住”感 */
      let extractTick: ReturnType<typeof setInterval> | null = null
      let softProgress = 82
      const clearExtractTick = () => {
        if (extractTick != null) {
          clearInterval(extractTick)
          extractTick = null
        }
      }

      let settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        clearExtractTick()
        reject(error)
      }
      const succeed = (result: ExtractVoiceMaterialResult) => {
        if (settled) return
        settled = true
        clearExtractTick()
        resolve(result)
      }

      const onAbort = () => {
        xhr.abort()
        fail(new Error('已取消提取'))
      }
      if (options.signal) {
        if (options.signal.aborted) {
          onAbort()
          return
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) {
          options.onProgress?.(15, 'upload')
          return
        }
        const ratio = Math.min(1, Math.max(0, event.loaded / event.total))
        // 上传占前 80%，剩余留给服务端 ffmpeg
        options.onProgress?.(Math.round(ratio * 80), 'upload')
      }

      xhr.upload.onload = () => {
        options.onProgress?.(82, 'extract')
        extractTick = setInterval(() => {
          if (softProgress >= 94) {
            clearExtractTick()
            return
          }
          softProgress = Math.min(94, softProgress + 1)
          options.onProgress?.(softProgress, 'extract')
        }, 1200)
      }

      xhr.onprogress = () => {
        clearExtractTick()
        // 响应体下载阶段，提取已基本完成
        options.onProgress?.(96, 'extract')
      }

      xhr.onerror = () => {
        fail(new Error('网络异常，声音样本提取失败'))
      }

      xhr.ontimeout = () => {
        fail(new Error('提取超时，请缩小视频后重试'))
      }

      xhr.onload = async () => {
        const status = xhr.status
        if (status < 200 || status >= 300) {
          const payload = await readXhrPayload(xhr)
          const message = pickErrorMessage(
            payload,
            resolveHttpErrorMessage(
              { statusCode: status, data: payload },
              '声音样本提取失败，请稍后重试',
            ),
          )

          if (status === 401) {
            authStore.openSessionExpiredDialog(message || '未登录或登录已过期，请重新登录')
          }

          const err = new Error(message) as Error & { statusCode?: number; data?: unknown }
          err.statusCode = status
          err.data = payload
          fail(err)
          return
        }

        const blob = xhr.response instanceof Blob
          ? xhr.response
          : new Blob([xhr.response], { type: 'audio/mpeg' })

        if (!blob.size) {
          fail(new Error('服务端未返回有效音频。'))
          return
        }

        const headerName = xhr.getResponseHeader('X-Extracted-File-Name')
        const decodedName = headerName
          ? decodeURIComponent(headerName)
          : ''
        const fileName = decodedName || `${file.name.replace(/\.[^.]+$/, '') || 'sample'}.mp3`
        const fromVideo = xhr.getResponseHeader('X-From-Video') === '1'
        const mime = blob.type && blob.type !== 'application/octet-stream'
          ? blob.type
          : 'audio/mpeg'
        const audioFile = new File([blob], fileName, {
          type: mime,
          lastModified: Date.now(),
        })

        options.onProgress?.(100, 'done')
        succeed({ file: audioFile, fromVideo })
      }

      // 大视频上传 + ffmpeg：10 分钟
      xhr.timeout = 10 * 60 * 1000

      const formData = new FormData()
      formData.append('material', file, file.name)
      options.onProgress?.(2, 'upload')
      xhr.send(formData)
    })
  }

  return {
    extractVoiceMaterial,
    resolveExtractErrorMessage: (error: unknown) =>
      resolveApiErrorMessage(error, '声音样本提取失败，请稍后重试'),
  }
}
