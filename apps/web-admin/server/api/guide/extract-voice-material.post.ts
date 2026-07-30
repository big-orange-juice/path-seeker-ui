import {
  GUIDE_VOICE_MATERIAL_FIELD,
  extractGuideVoiceMaterialFile,
  isVideoMaterial,
} from '~~/server/utils/extractGuideVoiceMaterial'

/**
 * 选择视频后立即抽音频：multipart 字段 `material`，成功返回 mp3 二进制。
 * 前端拿到结果后才允许提交保存。
 */
export default defineEventHandler(async (event) => {
  const formData = await readFormData(event)
  const raw = formData.get(GUIDE_VOICE_MATERIAL_FIELD)

  if (!(raw instanceof File) || raw.size <= 0) {
    throw createError({
      statusCode: 400,
      message: '请上传声音样本文件。',
    })
  }

  const fromVideo = isVideoMaterial(raw)
  const audio = await extractGuideVoiceMaterialFile(raw)
  const buffer = Buffer.from(await audio.arrayBuffer())
  const fileName = audio.name || 'material.mp3'

  setResponseHeader(event, 'Content-Type', audio.type || 'audio/mpeg')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  )
  setResponseHeader(event, 'X-Extracted-File-Name', encodeURIComponent(fileName))
  setResponseHeader(event, 'X-From-Video', fromVideo ? '1' : '0')
  setResponseHeader(event, 'X-Extracted-File-Size', String(buffer.byteLength))
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Content-Length', buffer.byteLength)

  return send(event, buffer)
})
