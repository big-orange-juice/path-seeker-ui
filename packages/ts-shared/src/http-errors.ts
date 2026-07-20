/**
 * 常见 HTTP 状态码友好提示（B / C 端与 server proxy 共用）。
 *
 * 约定：
 * - 业务接口若返回可读 message，优先展示业务文案
 * - 无业务文案或仅为技术性 HTTP 文案时，回落到本表
 * - 5xx 未枚举的状态码统一按 500 文案处理
 */

/** 常见 HTTP 状态码 → 用户可读提示 */
export const HTTP_STATUS_FRIENDLY_MESSAGES: Readonly<Record<number, string>> = {
  400: '请求参数有误，请检查后重试',
  401: '登录已失效，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  405: '当前操作不被允许',
  408: '请求超时，请稍后重试',
  409: '数据冲突，请刷新后重试',
  413: '提交内容过大，请精简后重试',
  415: '不支持的内容类型',
  422: '提交内容无法处理，请检查后重试',
  429: '操作过于频繁，请稍后再试',
  500: '服务暂时异常，请稍后重试',
  501: '服务暂不支持该操作',
  502: '网关错误，请稍后重试',
  503: '服务暂不可用，请稍后重试',
  504: '网关超时，请稍后重试',
} as const

const DEFAULT_HTTP_ERROR_FALLBACK = '请求失败，请稍后重试'

/** 技术性 / 英文 HTTP 文案，不应直接暴露给用户 */
const TECHNICAL_HTTP_MESSAGE_PATTERNS: readonly RegExp[] = [
  /^\[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\]\s+"/i,
  /^\d{3}\s+\S+/,
  /^(bad request|unauthorized|forbidden|not found|method not allowed|request timeout|conflict|payload too large|unsupported media type|unprocessable entity|too many requests)$/i,
  /^(internal server error|not implemented|bad gateway|service unavailable|gateway timeout)$/i,
  /^(server error|fetch failed|network error|failed to fetch|networkerror when attempting to fetch resource\.?)$/i,
  /^http error/i,
  /^request failed$/i,
  /^backend request failed$/i,
]

const normalizeText = (value: unknown) => String(value ?? '').trim()

/**
 * 按状态码解析友好提示。
 * 未配置的 5xx 回落到 500 文案；其余未知码使用 fallback。
 */
export const resolveHttpStatusMessage = (
  statusCode: number | null | undefined,
  fallback: string = DEFAULT_HTTP_ERROR_FALLBACK,
): string => {
  if (typeof statusCode !== 'number' || !Number.isFinite(statusCode)) {
    return fallback
  }

  const code = Math.trunc(statusCode)
  const mapped = HTTP_STATUS_FRIENDLY_MESSAGES[code]
  if (mapped) {
    return mapped
  }

  if (code >= 500 && code < 600) {
    return HTTP_STATUS_FRIENDLY_MESSAGES[500] ?? fallback
  }

  if (code >= 400 && code < 500) {
    return HTTP_STATUS_FRIENDLY_MESSAGES[400] ?? fallback
  }

  return fallback
}

/** 判断文案是否为技术性 HTTP 错误描述（ofetch / 浏览器原生等） */
export const isTechnicalHttpMessage = (message: string | null | undefined): boolean => {
  const text = normalizeText(message)
  if (!text) {
    return true
  }

  return TECHNICAL_HTTP_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))
}

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  return value as Record<string, unknown>
}

const pickString = (...candidates: unknown[]) => {
  for (const item of candidates) {
    const text = normalizeText(item)
    if (text) {
      return text
    }
  }
  return ''
}

/**
 * 从 ofetch / h3 / fetch / 自定义错误对象中提取 HTTP 状态码。
 */
export const extractHttpStatusCode = (error: unknown): number | null => {
  if (typeof error === 'number' && Number.isFinite(error)) {
    return Math.trunc(error)
  }

  const record = readRecord(error)
  if (!record) {
    return null
  }

  const direct = record.statusCode ?? record.status ?? record.status_code
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) {
    return Math.trunc(direct)
  }
  if (typeof direct === 'string' && /^\d{3}$/.test(direct.trim())) {
    return Number(direct.trim())
  }

  const response = readRecord(record.response)
  const responseStatus = response?.status ?? response?.statusCode
  if (typeof responseStatus === 'number' && Number.isFinite(responseStatus) && responseStatus > 0) {
    return Math.trunc(responseStatus)
  }

  const data = readRecord(record.data)
  const dataStatus = data?.statusCode ?? data?.status
  if (typeof dataStatus === 'number' && Number.isFinite(dataStatus) && dataStatus > 0) {
    return Math.trunc(dataStatus)
  }

  // ofetch 常见：`[GET] "/path": 400 Server Error`
  const message = pickString(record.message, record.statusMessage)
  const matched = message.match(/:\s*(\d{3})\b/) || message.match(/^(\d{3})\b/)
  if (matched?.[1]) {
    return Number(matched[1])
  }

  return null
}

/**
 * 提取错误对象中的业务 / 展示文案（未做友好化）。
 */
export const extractRawErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return normalizeText(error)
  }

  const record = readRecord(error)
  if (!record) {
    return ''
  }

  const data = readRecord(record.data)
  const nestedData = readRecord(data?.data)

  return pickString(
    data?.message,
    nestedData?.message,
    data?.statusMessage,
    record.message,
    record.statusMessage,
    record.statusText,
  )
}

export interface ResolveHttpErrorMessageOptions {
  /** 最终兜底文案 */
  fallback?: string
  /**
   * 若已知 HTTP 状态码可直接传入（优先于从 error 上解析）。
   * 适用于仅拿到 status 的场景。
   */
  statusCode?: number | null
}

/**
 * 解析可对用户展示的错误文案。
 *
 * 优先级：
 * 1. 非技术性业务 message
 * 2. HTTP 状态码友好提示
 * 3. fallback
 */
export const resolveHttpErrorMessage = (
  error: unknown,
  options: ResolveHttpErrorMessageOptions | string = {},
): string => {
  const normalizedOptions: ResolveHttpErrorMessageOptions =
    typeof options === 'string' ? { fallback: options } : options

  const fallback = normalizeText(normalizedOptions.fallback) || DEFAULT_HTTP_ERROR_FALLBACK
  const statusCode =
    typeof normalizedOptions.statusCode === 'number'
      ? normalizedOptions.statusCode
      : extractHttpStatusCode(error)

  const rawMessage = extractRawErrorMessage(error)
  if (rawMessage && !isTechnicalHttpMessage(rawMessage)) {
    return rawMessage
  }

  if (statusCode != null) {
    return resolveHttpStatusMessage(statusCode, fallback)
  }

  return fallback
}
