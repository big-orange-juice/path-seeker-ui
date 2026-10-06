/**
 * 业务错误码解析（B 端统一入口）。
 *
 * 后端所有业务失败都走 `GlobalExceptionFilter`，HTTP 状态码 + `ApiResponse.code` 同时返回；
 * Nuxt 代理层（`server/utils/backend.ts`）把该 code 透传到 h3 错误的 `data.code`。
 * `$fetch` 抛出的错误里这一层可能嵌套多层（ofetch body → h3 data → 业务 data），
 * 因此这里按优先级逐层兼容读取，供 12011（景点范围越界）、10005（并发冲突）等分支使用。
 *
 * 不要在各组件里各写一份 `error.data.data.code` 的探测逻辑。
 */

/** 后端 ErrorCodes.Conflict：版本不一致 / 状态冲突 */
export const CONFLICT_ERROR_CODE = 10005

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

const normalizeCode = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/**
 * 逐层查找业务错误码；找不到返回 null。
 * 遍历 `data` / `cause` 链，最多 6 层，避免异常对象自引用导致死循环。
 */
export function resolveBusinessErrorCode(error: unknown): number | null {
  let current: unknown = error
  for (let depth = 0; depth < 6; depth += 1) {
    const record = readRecord(current)
    if (!record) return null

    const code = normalizeCode(record.code)
    if (code !== null) return code

    current = record.data ?? record.cause
  }
  return null
}

/** 错误是否命中指定业务错误码 */
export const isBusinessErrorCode = (error: unknown, code: number): boolean =>
  resolveBusinessErrorCode(error) === code

/** 错误是否为并发冲突（10005） */
export const isConflictError = (error: unknown): boolean =>
  isBusinessErrorCode(error, CONFLICT_ERROR_CODE)
