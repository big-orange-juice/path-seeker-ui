/**
 * 导游音色 multipart 预处理（BFF）。
 * 视频由 Nuxt BFF 临时落盘后转换为 mp3，再透传给后端。
 */
import { execFile, execFileSync } from 'node:child_process'
import { accessSync, constants as fsConstants } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { createError } from 'h3'

const execFileAsync = promisify(execFile)

/** multipart 字段名：音色材料 */
export const GUIDE_VOICE_MATERIAL_FIELD = 'material'

/** 音频样本体积上限 */
export const MAX_VOICE_AUDIO_BYTES = 20 * 1024 * 1024
/** 视频样本体积上限（选中后由服务端抽音频） */
export const MAX_VOICE_VIDEO_BYTES = 400 * 1024 * 1024

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
  return extname(name || '').toLowerCase()
}

function canExecute(binaryPath: string) {
  try {
    accessSync(binaryPath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

function resolveFfmpegBinary() {
  const binaryPath = String(process.env.FFMPEG_PATH || '').trim()
  if (!binaryPath) {
    throw createError({
      statusCode: 500,
      message: '未配置 FFMPEG_PATH，无法从视频提取声音样本。',
    })
  }

  if (!canExecute(binaryPath)) {
    throw createError({
      statusCode: 500,
      message: 'FFMPEG_PATH 指向的 ffmpeg 不可执行，无法从视频提取声音样本。',
    })
  }

  try {
    execFileSync(binaryPath, ['-version'], { timeout: 8_000, stdio: 'ignore' })
    return binaryPath
  } catch {
    throw createError({
      statusCode: 500,
      message: 'FFMPEG_PATH 指向的 ffmpeg 不可用，无法从视频提取声音样本。',
    })
  }
}

function audioOutputName(originalName: string) {
  const base = basename(originalName || 'sample', extname(originalName || ''))
  const safe = (base || 'sample').replace(/[^\w\u4e00-\u9fff.-]+/g, '_').slice(0, 80)
  return `${safe || 'sample'}.mp3`
}

export function isVideoMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith('video/')) return true
  return VIDEO_EXTENSIONS.has(ext) && !type.startsWith('audio/')
}

export function isAudioMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith('audio/')) return true
  if (AUDIO_EXTENSIONS.has(ext) && !type.startsWith('video/')) return true
  return false
}

export function assertVoiceMaterialSize(file: File) {
  if (isVideoMaterial(file)) {
    if (file.size > MAX_VOICE_VIDEO_BYTES) {
      throw createError({
        statusCode: 400,
        message: `视频「${file.name}」超过 400MB，请压缩后重试。`,
      })
    }
    return
  }

  if (file.size > MAX_VOICE_AUDIO_BYTES) {
    throw createError({
      statusCode: 400,
      message: `音频「${file.name}」超过 20MB，请压缩后重试。`,
    })
  }
}

async function extractAudioMp3FromVideo(file: File): Promise<File> {
  const workDir = await mkdtemp(join(tmpdir(), 'guide-voice-'))
  const inputPath = join(workDir, `input${normalizeExt(file.name) || '.mp4'}`)
  const outputPath = join(workDir, 'output.mp3')

  try {
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()))
    try {
      // 大视频抽音频可能较久，超时放宽到 10 分钟
      await execFileAsync(resolveFfmpegBinary(), [
        '-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2',
        '-ar', '44100', '-ac', '1', outputPath,
      ], { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      throw createError({ statusCode: 400, message: `视频「${file.name}」提取音频失败：${detail}` })
    }

    const audioBuffer = await readFile(outputPath)
    if (!audioBuffer.byteLength) {
      throw createError({ statusCode: 400, message: `视频「${file.name}」未提取到有效音频。` })
    }
    return new File([audioBuffer], audioOutputName(file.name), { type: 'audio/mpeg', lastModified: Date.now() })
  } finally {
    // 视频与转换结果只存在于请求专属临时目录，处理结束后立即删除。
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * 单文件预处理：视频抽成 mp3，音频原样返回。
 */
export async function extractGuideVoiceMaterialFile(file: File): Promise<File> {
  if (!(file instanceof File) || file.size <= 0) {
    throw createError({ statusCode: 400, message: '请上传有效的声音样本文件。' })
  }

  assertVoiceMaterialSize(file)

  if (isVideoMaterial(file)) {
    return extractAudioMp3FromVideo(file)
  }

  if (!isAudioMaterial(file) && file.size > 0) {
    // 无法识别扩展名时仍按音频透传，由下游校验
    return file
  }

  return file
}

/**
 * 透传 multipart：
 * - 音频原样保留
 * - 视频临时转换为 mp3 后透传（兼容未预先抽取的旧提交）
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
    const prepared = await extractGuideVoiceMaterialFile(file)
    next.append(GUIDE_VOICE_MATERIAL_FIELD, prepared, prepared.name || 'material.mp3')
  }

  return next
}
