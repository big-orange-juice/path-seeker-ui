/**
 * 播放进度定位（±15 秒）的纯函数实现。
 *
 * - 文件音频：精确 seek，只允许在当前条目内移动（不跨条目）。
 * - 系统语音：没有精确时间轴，按"句子 + 估算时长"做近似跳转。
 *
 * 估算只用于定位，不作为进度展示或"讲解是否播完"的判据（见开发方案 §4.2）。
 */

/** 单句超过这个长度再按标点粗切，保证恢复颗粒度 */
export const SENTENCE_SOFT_LIMIT = 120

/** 各语言估算语速（字符/秒）：中文 5、拉丁语系 14、其它 10（方案 §4.2 固定口径） */
const CHARS_PER_SECOND: Record<string, number> = { zh: 5, en: 14, ru: 14, es: 14, fr: 14 }
const DEFAULT_CHARS_PER_SECOND = 10
/** 单句最短估算时长，避免短句被估成 0 秒 */
const MIN_SENTENCE_SECONDS = 1.2

/** 讲解正文按句切分：系统语音读不回精确时间，定位至少要落到句 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const sentences: string[] = []
  let buffer = ''
  for (const char of normalized) {
    buffer += char
    if ('。！？!?;；'.includes(char)) {
      if (buffer.trim()) sentences.push(buffer.trim())
      buffer = ''
    }
  }
  if (buffer.trim()) sentences.push(buffer.trim())
  return sentences.flatMap(sentence => sentence.length <= SENTENCE_SOFT_LIMIT ? [sentence] : splitLongSentence(sentence))
}

/** 长句再按标点粗切，避免一句十几秒都定位不了 */
function splitLongSentence(sentence: string): string[] {
  const chunks: string[] = []
  let buffer = ''
  for (const char of sentence) {
    buffer += char
    if (buffer.length >= SENTENCE_SOFT_LIMIT - 40 && '，,、 '.includes(char)) {
      if (buffer.trim()) chunks.push(buffer.trim())
      buffer = ''
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks.length ? chunks : [sentence]
}

function charsPerSecond(locale: string) {
  return CHARS_PER_SECOND[locale] ?? DEFAULT_CHARS_PER_SECOND
}

/** 单句估算时长（秒） */
export function estimateSentenceSeconds(sentence: string, locale: string): number {
  const count = [...sentence.replace(/\s+/g, '')].length
  if (!count) return MIN_SENTENCE_SECONDS
  return Math.max(MIN_SENTENCE_SECONDS, count / charsPerSecond(locale))
}

/** 每句估算时长（秒），下标与句子一一对应 */
export function sentenceDurations(sentences: string[], locale: string): number[] {
  return sentences.map(sentence => estimateSentenceSeconds(sentence, locale))
}

/** 每句起点（秒）的累计估算 */
export function sentenceOffsets(sentences: string[], locale: string): number[] {
  const offsets: number[] = []
  let cursor = 0
  for (const duration of sentenceDurations(sentences, locale)) {
    offsets.push(cursor)
    cursor += duration
  }
  return offsets
}

/** 系统语音近似总时长（秒），仅用于 UI 展示与定位，不代表真实播放时间 */
export function estimatedTotalSeconds(sentences: string[], locale: string): number {
  return sentenceDurations(sentences, locale).reduce((sum, value) => sum + value, 0)
}

export interface SentenceSeekResult {
  /** 目标句下标 */
  index: number
  /** 是否发生了移动（false 表示已在边界，调用方可以不做任何事） */
  moved: boolean
}

/**
 * 系统语音按 ±delta 秒近似定位：先把当前句起点 + delta 换算成估算时间轴上的目标点，
 * 再取"包含该目标点的句子"（落在句首播放），两端做 clamp。
 */
export function resolveSentenceSeek(
  sentences: string[],
  locale: string,
  currentSentenceIndex: number,
  deltaSeconds: number,
): SentenceSeekResult {
  if (!sentences.length) return { index: 0, moved: false }
  const last = sentences.length - 1
  const offsets = sentenceOffsets(sentences, locale)
  const current = Math.min(Math.max(0, currentSentenceIndex), last)
  const target = offsets[current]! + deltaSeconds
  let index = current
  if (target <= offsets[0]!) {
    index = 0
  } else if (target >= offsets[last]!) {
    index = last
  } else {
    for (let cursor = last; cursor >= 0; cursor -= 1) {
      if (offsets[cursor]! <= target) {
        index = cursor
        break
      }
    }
  }
  return { index, moved: index !== current }
}

export interface FileSeekTarget {
  /** clamp 之后的播放时间（秒） */
  time: number
  /** 是否撞到了条目开头 */
  atStart: boolean
  /** 是否撞到了条目结尾 */
  atEnd: boolean
}

/**
 * 文件音频的 ±delta 秒定位：只在当前条目内 clamp，不跨条目。
 * duration 未知（流式/元数据未就绪）时按 0 处理，避免把位置推到未加载的区域。
 */
export function resolveFileSeekTarget(currentTime: number, duration: number, deltaSeconds: number): FileSeekTarget {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeCurrent = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0
  const raw = safeCurrent + deltaSeconds
  const time = safeDuration > 0 ? Math.min(Math.max(0, raw), safeDuration) : Math.max(0, raw)
  return { time, atStart: time <= 0 && deltaSeconds < 0, atEnd: safeDuration > 0 && time >= safeDuration && deltaSeconds > 0 }
}
