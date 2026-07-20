import { resolveHttpStatusMessage } from '@path-seeker/ts-shared'

/**
 * 服务端拉取风格参考文件文本，避免浏览器跨域限制。
 * query.url = 文件完整地址（来自 style-reference-files）。
 */
export default defineEventHandler(async (event): Promise<{ text: string }> => {
  const query = getQuery(event)
  const rawUrl = String(query.url || '').trim()
  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      message: '缺少文件地址。',
    })
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    throw createError({
      statusCode: 400,
      message: '文件地址无效。',
    })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw createError({
      statusCode: 400,
      message: '仅支持 http/https 文件地址。',
    })
  }

  const upstream = await fetch(target, {
    method: 'GET',
    headers: {
      accept: 'text/plain,text/*,application/json,application/octet-stream,*/*',
    },
  })

  if (!upstream.ok) {
    const statusCode =
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    throw createError({
      statusCode,
      message: resolveHttpStatusMessage(statusCode, '风格参考文件读取失败。'),
    })
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  // 优先按 UTF-8 解码；去掉 BOM
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '')

  return { text }
})
