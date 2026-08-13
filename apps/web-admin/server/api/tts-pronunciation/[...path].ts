import { backendFetch } from '~~/server/utils/backend'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT'])

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    throw createError({ statusCode: 405, message: '不支持的请求方式。' })
  }

  const rawPath = getRouterParam(event, 'path') || ''
  const segments = rawPath.split('/').filter(Boolean)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) {
    throw createError({ statusCode: 400, message: '请求路径无效。' })
  }

  const query = getQuery(event)
  const normalizedQuery = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0] ?? '') : String(value ?? ''),
    ]),
  )
  const body = method === 'GET' ? undefined : await readBody<Record<string, unknown> | undefined>(event)

  return backendFetch(event, `/tts-pronunciation/${segments.map(encodeURIComponent).join('/')}`, {
    method,
    query: normalizedQuery,
    body,
  })
})
