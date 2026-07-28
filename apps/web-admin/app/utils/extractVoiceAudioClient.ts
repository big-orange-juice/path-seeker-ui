/**
 * 浏览器端从视频抽取音频（@ffmpeg/ffmpeg WASM）。
 * 选文件时调用，提交时 material 已是音频，BFF 不再跑 ffmpeg。
 *
 * core 自托管在 `public/ffmpeg/`（由 scripts/sync-ffmpeg-core.mjs 从
 * @ffmpeg/core 同步），不依赖外网 CDN。
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let shared: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

/** 与 nuxt `app.baseURL` 对齐，例如 `/path-seeker/admin/ffmpeg` */
function resolveFfmpegAssetBase() {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}ffmpeg`
}

function normalizeExt(name: string) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return '.mp4'
  return name.slice(dot).toLowerCase() || '.mp4'
}

function audioOutputName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, '') || 'sample'
  const safe = base.replace(/[^\w\u4e00-\u9fff.-]+/g, '_').slice(0, 80)
  return `${safe || 'sample'}.mp3`
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (shared?.loaded) {
    return shared
  }
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    const assetBase = resolveFfmpegAssetBase()
    // 同源静态资源 + toBlobURL，避免 Worker 跨域问题
    await ffmpeg.load({
      coreURL: await toBlobURL(`${assetBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${assetBase}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    shared = ffmpeg
    return ffmpeg
  })()

  try {
    return await loadPromise
  } catch (error) {
    loadPromise = null
    shared = null
    throw error
  }
}

/**
 * 从视频文件抽出单声道 mp3，供音色材料上传。
 * 首次调用会下载并缓存 WASM core。
 */
export async function extractAudioMp3FromVideo(file: File): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('视频抽音仅支持浏览器环境。')
  }

  const ffmpeg = await getFfmpeg()
  const inputName = `input${normalizeExt(file.name)}`
  const outputName = 'output.mp3'

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    const code = await ffmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      '-ar',
      '44100',
      '-ac',
      '1',
      outputName,
    ])

    if (code !== 0) {
      throw new Error(`ffmpeg 退出码 ${code}`)
    }

    const data = await ffmpeg.readFile(outputName)
    const bytes = data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data))

    if (!bytes.byteLength) {
      throw new Error('未提取到有效音频')
    }

    // 拷贝到独立 ArrayBuffer，避免 SharedArrayBuffer 与 File 构造不兼容
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)

    return new File([copy], audioOutputName(file.name), {
      type: 'audio/mpeg',
      lastModified: Date.now(),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误'
    throw new Error(`视频「${file.name}」提取音频失败：${detail}`)
  } finally {
    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      /* ignore */
    }
    try {
      await ffmpeg.deleteFile(outputName)
    } catch {
      /* ignore */
    }
  }
}

export function isVideoVoiceMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  if (type.startsWith('video/')) return true
  return (
    name.endsWith('.mp4')
    || name.endsWith('.m4v')
    || name.endsWith('.mov')
    || name.endsWith('.webm')
    || name.endsWith('.avi')
    || name.endsWith('.mkv')
    || name.endsWith('.mpeg')
    || name.endsWith('.mpg')
  )
}

export function isAudioVoiceMaterial(file: File) {
  const type = String(file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  if (type.startsWith('audio/')) return true
  if (isVideoVoiceMaterial(file)) return false
  return (
    name.endsWith('.mp3')
    || name.endsWith('.wav')
    || name.endsWith('.m4a')
    || name.endsWith('.aac')
    || name.endsWith('.ogg')
    || name.endsWith('.flac')
    || name.endsWith('.mpga')
  )
}
