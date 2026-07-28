import { execFile, execFileSync } from 'node:child_process'
import { accessSync, chmodSync, constants as fsConstants } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { createError } from 'h3'
import ffmpegStaticPath from 'ffmpeg-static'

const execFileAsync = promisify(execFile)

/** multipart 字段名：音色材料 */
export const GUIDE_VOICE_MATERIAL_FIELD = 'material'

/** 可直接透传的音频类型 */
const AUDIO_EXTENSIONS = new Set(['.mp3', '.mpeg', '.mpga', '.wav', '.m4a', '.aac', '.ogg', '.flac'])

/** 需 ffmpeg 抽轨的视频类型 */
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

const AUDIO_MIME_PREFIX = 'audio/'
const VIDEO_MIME_PREFIX = 'video/'

function normalizeExt(name: string) {
  return extname(name || '').toLowerCase()
}

function isAudioMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith(AUDIO_MIME_PREFIX)) return true
  if (AUDIO_EXTENSIONS.has(ext) && !type.startsWith(VIDEO_MIME_PREFIX)) return true
  // .mpeg 可能是音/视；仅当 mime 明确 audio 时上面已命中
  return ext === '.mp3' || ext === '.mpga' || ext === '.wav' || ext === '.m4a' || ext === '.aac' || ext === '.ogg' || ext === '.flac'
}

function isVideoMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const ext = normalizeExt(file.name)
  if (type.startsWith(VIDEO_MIME_PREFIX)) return true
  return VIDEO_EXTENSIONS.has(ext) && !isAudioMaterial(file)
}

function canExecute(binPath: string) {
  try {
    accessSync(binPath, fsConstants.X_OK)
    return true
  } catch {
    try {
      chmodSync(binPath, 0o755)
      accessSync(binPath, fsConstants.X_OK)
      return true
    } catch {
      return false
    }
  }
}

function probeFfmpeg(binPath: string) {
  if (!binPath || !canExecute(binPath)) return false
  try {
    execFileSync(binPath, ['-version'], {
      timeout: 8_000,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

/**
 * 解析可用的 ffmpeg（优先 npm 包 `ffmpeg-static` 自带二进制）：
 * 1) 环境变量 FFMPEG_PATH / FFMPEG_BIN（运维覆盖）
 * 2) ffmpeg-static（pnpm 依赖，随平台下载 arm64/x64 可执行文件）
 * 3) 系统 PATH / 常见 brew 路径（本机已装 ffmpeg 时的兜底）
 *
 * 说明：不是纯 JS 实现；npm 包只是把官方 ffmpeg 二进制打进 node_modules。
 * 纯 WASM（@ffmpeg/ffmpeg）体积大、抽音慢，后台 BFF 更适合原生二进制。
 */
function resolveFfmpegBinary() {
  const envPath = String(process.env.FFMPEG_PATH || process.env.FFMPEG_BIN || '').trim()
  const candidates: string[] = []

  if (envPath) {
    candidates.push(envPath)
  }

  if (typeof ffmpegStaticPath === 'string' && ffmpegStaticPath) {
    candidates.push(ffmpegStaticPath)
  }

  try {
    const whichOut = execFileSync('which', ['ffmpeg'], {
      encoding: 'utf8',
      timeout: 3_000,
    }).trim()
    if (whichOut) {
      candidates.push(whichOut.split(/\r?\n/)[0] || '')
    }
  } catch {
    /* PATH 无 ffmpeg */
  }

  candidates.push(
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  )

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const path = String(candidate || '').trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    if (probeFfmpeg(path)) {
      return path
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage:
      '未找到可用的 ffmpeg（npm 包 ffmpeg-static 或系统安装）。无法从视频提取声音样本。',
  })
}

function audioOutputName(originalName: string) {
  const base = basename(originalName || 'sample', extname(originalName || ''))
  const safe = (base || 'sample').replace(/[^\w\u4e00-\u9fff.-]+/g, '_').slice(0, 80)
  return `${safe || 'sample'}.mp3`
}

/**
 * 用 ffmpeg 从视频抽出音频轨，转成 mp3 File。
 * -vn 丢弃画面；libmp3lame 输出通用 mp3，供后端 ASR / 音色克隆。
 */
async function extractAudioMp3FromVideo(file: File): Promise<File> {
  const binary = resolveFfmpegBinary()
  const workDir = await mkdtemp(join(tmpdir(), 'guide-voice-'))
  const inputName = `input${normalizeExt(file.name) || '.mp4'}`
  const outputName = 'output.mp3'
  const inputPath = join(workDir, inputName)
  const outputPath = join(workDir, outputName)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    try {
      await execFileAsync(
        binary,
        [
          '-y',
          '-i',
          inputPath,
          '-vn',
          '-acodec',
          'libmp3lame',
          '-q:a',
          '2',
          '-ar',
          '44100',
          '-ac',
          '1',
          outputPath,
        ],
        { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      throw createError({
        statusCode: 400,
        statusMessage: `视频「${file.name}」提取音频失败：${detail}`,
      })
    }

    const audioBuffer = await readFile(outputPath)
    if (!audioBuffer.byteLength) {
      throw createError({
        statusCode: 400,
        statusMessage: `视频「${file.name}」未提取到有效音频。`,
      })
    }

    return new File([audioBuffer], audioOutputName(file.name), {
      type: 'audio/mpeg',
      lastModified: Date.now(),
    })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * 处理导游音色 multipart：
 * - 音频原样保留
 * - 视频经 ffmpeg 抽成 mp3 后再写入 material 字段
 * - 其它字段透传
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
      const audio = await extractAudioMp3FromVideo(file)
      next.append(GUIDE_VOICE_MATERIAL_FIELD, audio, audio.name)
      continue
    }
    if (isAudioMaterial(file) || file.size > 0) {
      // 已是音频或未知但非空：原样转发（后端再校验）
      next.append(GUIDE_VOICE_MATERIAL_FIELD, file, file.name || 'material.mp3')
    }
  }

  return next
}
