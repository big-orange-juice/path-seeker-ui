import type { H3Event } from 'h3'
import {
  isTechnicalHttpMessage,
  resolveHttpStatusMessage,
} from '@path-seeker/ts-shared'
import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth'

const ADMIN_AUTH_STORE_COOKIE_KEY = 'admin-auth'

const normalizeAuthorization = (value: string | null | undefined) => {
  const token = String(value ?? '').trim()
  if (!token) {
    return ''
  }
  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`
}

const parsePersistedToken = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { token?: unknown }
    return typeof parsed.token === 'string' ? parsed.token : ''
  } catch {
    return ''
  }
}

const resolveAuthorization = (event: H3Event) => {
  const headerAuthorization = normalizeAuthorization(getHeader(event, 'authorization'))
  const directToken = getCookie(event, ADMIN_AUTH_COOKIE_KEY)
  const persistedToken = parsePersistedToken(getCookie(event, ADMIN_AUTH_STORE_COOKIE_KEY))
  const cookieAuthorization = normalizeAuthorization(directToken || persistedToken)
  return headerAuthorization || cookieAuthorization
}

/**
 * 代理导游音色试听音频。
 * 对齐 GET /api/Guide/voice-preview?guideId=
 * 返回上游音频二进制流，供 <audio> 同源播放（带登录 cookie）。
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const backendBaseUrl = config.backendBaseUrl

  if (!backendBaseUrl) {
    throw createError({
      statusCode: 500,
      message: '服务端未配置 backendBaseUrl。',
    })
  }

  const query = getQuery(event)
  // 雪花 ID 按 string 透传，禁止 Number()
  const guideId = String(query.guideId || '').trim()
  if (!guideId) {
    throw createError({
      statusCode: 400,
      message: '缺少导游 ID。',
    })
  }

  const authorization = resolveAuthorization(event)
  const normalizedBaseUrl = backendBaseUrl.endsWith('/') ? backendBaseUrl : `${backendBaseUrl}/`
  const targetUrl = new URL('api/Guide/voice-preview', normalizedBaseUrl)
  targetUrl.searchParams.set('guideId', guideId)

  const headers: Record<string, string> = {
    accept: 'audio/*,application/octet-stream,*/*',
  }
  if (authorization) {
    headers.authorization = authorization
  }

  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers,
  })

  if (!upstream.ok) {
    const rawText = await upstream.text()
    let backendMessage = ''
    let backendCode: number | undefined
    let backendTraceId: string | undefined

    try {
      const parsed = JSON.parse(rawText) as {
        code?: number
        message?: string | null
        traceId?: string | null
      }
      backendMessage = String(parsed.message || '').trim()
      backendCode = parsed.code
      backendTraceId = parsed.traceId ?? undefined
    } catch {
      if (rawText.trim()) {
        backendMessage = rawText.trim().slice(0, 300)
      }
    }

    const statusCode = backendCode === 10002 ? 401 : upstream.status
    const message =
      backendMessage && !isTechnicalHttpMessage(backendMessage)
        ? backendMessage
        : resolveHttpStatusMessage(statusCode, '音色试听获取失败')

    throw createError({
      statusCode,
      message,
      data: {
        code: backendCode,
        message: backendMessage || message,
        traceId: backendTraceId,
      },
    })
  }

  const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
  const contentLength = upstream.headers.get('content-length')
  const contentDisposition = upstream.headers.get('content-disposition')

  setResponseStatus(event, 200)
  setResponseHeader(event, 'Content-Type', contentType)
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  if (contentLength) {
    setResponseHeader(event, 'Content-Length', contentLength)
  }
  if (contentDisposition) {
    setResponseHeader(event, 'Content-Disposition', contentDisposition)
  }

  if (upstream.body) {
    return sendStream(event, upstream.body)
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  return buffer
})
