/**
 * 导游音色 multipart 预处理（BFF）。
 * 视频抽音已改到浏览器 @ffmpeg/ffmpeg；此处仅校验并透传音频。
 */
import { createError } from 'h3'

/** multipart 字段名：音色材料 */
export const GUIDE_VOICE_MATERIAL_FIELD = 'material'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.mpeg',
  '.mpga',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.flac',
])

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.mpeg',
  '.mpg',
])

function normalizeExt(name: string) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot).toLowerCase()
}

function isVideoMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith('video/')) return true
  return VIDEO_EXTENSIONS.has(ext) && !type.startsWith('audio/')
}

function isAudioMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith('audio/')) return true
  if (AUDIO_EXTENSIONS.has(ext) && !type.startsWith('video/')) return true
  return false
}

/**
 * 透传 multipart：
 * - 音频原样保留
 * - 若仍收到视频（客户端未抽音），直接拒绝，不在服务端转码
 */
export async function prepareGuideMaterialFormData(source: FormData): Promise<FormData> {
  const next = new FormData()
  const materialEntries: File[] = []

  for (const [key, value] of source.entries()) {
    if (key === GUIDE_VOICE_MATERIAL_FIELD) {
      if (value instanceof File && value.size > 0) {
        materialEntries.push(value)
      }
      continue
    }
    next.append(key, value)
  }

  for (const file of materialEntries) {
    if (isVideoMaterial(file)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          `「${file.name}」仍是视频。请在浏览器完成音频提取后再提交，服务端不再处理视频。`,
      })
    }
    if (isAudioMaterial(file) || file.size > 0) {
      next.append(GUIDE_VOICE_MATERIAL_FIELD, file, file.name || 'material.mp3')
    }
  }

  return next
}
