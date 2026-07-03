const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const API_PREFIX = ''
const FIXED_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMDczMDQ1OTE0MzIyMzQxODg4IiwianRpIjoiN2JkMGQ2NGVlN2UxNDUyOGIxMTNjYTZmMmJhMzkzODIiLCJ1c2VyX25vIjoiVTM0ODQ5NDgwMzQ2NzYzNjczNyIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiMjA3MzA0NTkxNDMyMjM0MTg4OCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6InVzZXIiLCJleHAiOjE3ODMxNzQwODUsImlzcyI6IkN1bHR1cmFsVG91cmlzbVN5c3RlbSIsImF1ZCI6IkN1bHR1cmFsVG91cmlzbVN5c3RlbS5DbGllbnQifQ.nFcsEbPBQnDMdu7MIR_t_IDV3Hzz9hNOjcRr7ufLuV8'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD'
type RequestPayload = string | Record<string, unknown> | ArrayBuffer | undefined
type QueryValue = string | number | boolean | null | undefined

export interface ApiResponse<T = void> {
  code: number
  message: string | null
  traceId: string | null
  data?: T | null
}

interface RequestOptions {
  method?: RequestMethod
  query?: Record<string, QueryValue>
  data?: RequestPayload
  header?: Record<string, string>
}

export class ApiRequestError extends Error {
  code?: number
  statusCode?: number
  traceId?: string | null
  payload?: unknown

  constructor(
    message: string,
    options: {
      code?: number
      statusCode?: number
      traceId?: string | null
      payload?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = options.code
    this.statusCode = options.statusCode
    this.traceId = options.traceId
    this.payload = options.payload
  }
}

function buildQueryString(query?: Record<string, QueryValue>) {
  const parts: string[] = []

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })

  return parts.join('&')
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const requestPath = `${API_PREFIX}${normalizedPath}`
  const requestUrl = API_BASE_URL ? `${API_BASE_URL}${requestPath}` : requestPath
  const searchString = buildQueryString(query)

  return searchString ? `${requestUrl}?${searchString}` : requestUrl
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (!value || typeof value !== 'object') {
    return false
  }

  return typeof (value as ApiResponse<T>).code === 'number'
}

function normalizeErrorMessage(message: unknown, fallback: string) {
  const normalized = typeof message === 'string' ? message.trim() : ''
  return normalized || fallback
}

function createStatusError(statusCode: number, payload: unknown) {
  const fallback = `请求失败（${statusCode}）`
  const payloadMessage = isApiResponse(payload)
    ? payload.message
    : (typeof payload === 'object' && payload && 'message' in payload ? (payload as { message?: unknown }).message : null)

  return new ApiRequestError(normalizeErrorMessage(payloadMessage, fallback), {
    statusCode,
    payload,
    traceId: isApiResponse(payload) ? payload.traceId : null,
    code: isApiResponse(payload) ? payload.code : undefined,
  })
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.code !== 0) {
    throw new ApiRequestError(
      normalizeErrorMessage(payload.message, '接口处理失败，请稍后重试'),
      {
        code: payload.code,
        traceId: payload.traceId,
        payload,
      },
    )
  }

  return (payload.data ?? null) as T
}

export function resolveRequestErrorMessage(error: unknown, fallback = '请求失败，请稍后重试') {
  if (error instanceof ApiRequestError) {
    return normalizeErrorMessage(error.message, fallback)
  }

  if (error instanceof Error) {
    return normalizeErrorMessage(error.message, fallback)
  }

  return fallback
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const {
    method = 'GET',
    query,
    data,
    header,
  } = options

  const response = await uni.request({
    url: buildUrl(path, query),
    method,
    data,
    header: {
      'content-type': 'application/json',
      Authorization: `Bearer ${FIXED_BEARER_TOKEN}`,
      ...header,
    },
  })

  const statusCode = response.statusCode ?? 500
  if (statusCode < 200 || statusCode >= 300) {
    throw createStatusError(statusCode, response.data)
  }

  if (isApiResponse<T>(response.data)) {
    return unwrapApiResponse(response.data)
  }

  return response.data as T
}
