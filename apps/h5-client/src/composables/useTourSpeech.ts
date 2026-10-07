import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'
import type { ClientStopExtraAudio, ClientTourStop, TourNarrationChapter } from '@/types/clientCatalog'
import { resolveFileSeekTarget, resolveSentenceSeek, splitSentences } from '@/utils/tourSeek'

/**
 * 站点播放队列（设计文档 §3.3）：
 *   before extra audio[] → narration chapter[] → after extra audio[]
 *
 * 播放器统一管理 stageId、队列版本、当前条目 ID、条目类型、文件播放时间与播放状态；
 * 切换站点时队列版本自增，旧的异步结束事件按版本号丢弃，不会推进新节点。
 *
 * v5 追加：`seekBy`（±15 秒，文件精确 / 系统语音按句近似）、断点快照与断点恢复。
 */
export type TourQueueItemType = 'extra-before' | 'chapter' | 'extra-after'

export interface TourQueueItem {
  /** 条目 ID：额外音频用关联记录 ID，讲解章节用章节 ID */
  id: string
  type: TourQueueItemType
  /** 展示名称 */
  title: string | null
  /** 讲解正文（文件音频失败时回退系统语音用） */
  text: string
  /** 文件音频地址；系统语音回退的讲解章节为空 */
  audioUrl: string | null
  durationSeconds: number | null
  /** 额外音频记录 ID，用于"本次游览内已播过的前置音频不重复播放" */
  extraAudioId: string | null
  chapterId: string | null
}

/** 恢复精度：文件音频可精确恢复到已记录时间；系统语音按句恢复，只能算近似 */
export type TourRestorePrecision = 'exact' | 'approximate'

/** ±15 秒定位结果：exact=文件音频精确 seek，approximate=系统语音按句近似，unavailable=当前不可定位 */
export type TourSeekPrecision = 'exact' | 'approximate' | 'unavailable'

export interface TourSeekResult {
  /** 位置是否真的变了 */
  moved: boolean
  precision: TourSeekPrecision
  /** 没有移动时的原因，供 UI 决定是否提示 */
  reason?: 'idle' | 'at-start' | 'at-end' | 'not-seekable'
}

export interface TourQueueOptions {
  /** 与 C 端"跳过额外音频"开关一致：队列只含讲解章节 */
  skipExtraAudio?: boolean
  /** 本次游览已播过的前置额外音频；播放时就地写入新播过的 ID */
  playedBeforeExtraIds?: Set<string>
  /** 浏览模式（上一／下一节点）：前置额外音频不去重，也不写入已播记录 */
  skipBeforeAudioDedupe?: boolean
}

/** 断点恢复目标：条目优先按 ID 匹配，匹配不到时退回队列下标 */
export interface TourResumeTarget {
  queueIndex: number
  itemId?: string | null
  /** 文件音频：精确秒数 */
  currentTimeSeconds?: number
  /** 系统语音：当前句序号 */
  sentenceIndex?: number
  /** 断点记录的是"暂停中"：恢复出条目与位置但不自动播放，等用户点继续 */
  paused?: boolean
}

/** 供 sessionStorage 持久化的播放断点快照 */
export interface TourSpeechCheckpoint {
  itemId: string | null
  itemType: TourQueueItemType | null
  queueIndex: number
  currentTimeSeconds: number
  sentenceIndex: number
  status: 'idle' | 'playing' | 'paused'
}

const FILE_START_TIMEOUT_MS = 10000
const SPEECH_START_TIMEOUT_MS = 10000
const VOICE_WAIT_TIMEOUT_MS = 1500

function extraQueueItem(audio: ClientStopExtraAudio): TourQueueItem | null {
  // 没有可播放地址的额外音频直接不入队（配置缺失，不占用播放时间）
  if (!audio.url) return null
  return {
    id: audio.id,
    type: audio.position === 'after' ? 'extra-after' : 'extra-before',
    title: audio.title,
    text: '',
    audioUrl: audio.url,
    durationSeconds: audio.durationSeconds ?? null,
    extraAudioId: audio.id,
    chapterId: null,
  }
}

/** 同组内按 order 升序，order 相同按 ID 稳定排序（与后端下发顺序一致） */
function sortExtraAudios(extraAudios: ClientStopExtraAudio[] | null | undefined, position: 'before' | 'after') {
  return (extraAudios ?? [])
    .filter(item => item.position === position)
    .slice()
    .sort((left, right) => (left.order - right.order) || left.id.localeCompare(right.id))
}

/** 构造站点队列：before extra audio[] → narration chapter[] → after extra audio[] */
export function buildTourQueue(
  extraAudios: ClientStopExtraAudio[] | null | undefined,
  chapters: TourNarrationChapter[] | null | undefined,
  options: TourQueueOptions = {},
): TourQueueItem[] {
  const queue: TourQueueItem[] = []
  if (!options.skipExtraAudio) {
    for (const audio of sortExtraAudios(extraAudios, 'before')) {
      // 本次游览已播过的前置音频不再重复播放；浏览模式下去重关闭（方案 §4.4）
      if (!options.skipBeforeAudioDedupe && options.playedBeforeExtraIds?.has(audio.id)) continue
      const item = extraQueueItem(audio)
      if (item) queue.push(item)
    }
  }
  for (const [index, chapter] of (chapters ?? []).entries()) {
    // 既无正文也无音频的章节不参与播放（沿用既有过滤规则）
    if (!chapter.text?.trim() && !chapter.audioUrl) continue
    queue.push({
      id: chapter.id || `chapter-${chapter.order || index + 1}`,
      type: 'chapter',
      title: chapter.title,
      text: chapter.text ?? '',
      audioUrl: chapter.audioUrl ?? null,
      durationSeconds: chapter.durationSeconds ?? null,
      extraAudioId: null,
      chapterId: chapter.id || null,
    })
  }
  if (!options.skipExtraAudio) {
    for (const audio of sortExtraAudios(extraAudios, 'after')) {
      const item = extraQueueItem(audio)
      if (item) queue.push(item)
    }
  }
  return queue
}

/** 单条额外音频队列：站点没有讲解章节时也能单独播放 */
export function buildExtraAudioQueue(audio: ClientStopExtraAudio): TourQueueItem[] {
  const item = extraQueueItem(audio)
  return item ? [item] : []
}

export { splitSentences }

/** 浏览器自动播放被阻止（需要用户手势）：保留待播条目，等用户点"继续播放" */
function isAutoplayBlocked(reason: unknown) {
  return (reason as { name?: string } | null)?.name === 'NotAllowedError'
}

/** 元数据未就绪时把起播位置挂到 loadedmetadata 上，避免 seek 被丢弃 */
function applyStartTime(element: HTMLAudioElement, seconds: number) {
  if (!(seconds > 0)) return
  const assign = () => {
    try { element.currentTime = seconds } catch { /* 不可寻址时从头播放 */ }
  }
  if (element.readyState >= 1) assign()
  else element.addEventListener('loadedmetadata', assign, { once: true })
}

export function useTourSpeech(onNarrationEnd: () => void) {
  const status = shallowRef<'idle' | 'playing' | 'paused'>('idle')
  const error = shallowRef<'unavailable' | 'voiceMissing' | 'playback' | null>(null)
  const blocked = shallowRef(false)
  /** 额外音频播放失败被跳过时记下标题，空串表示没有提示 */
  const skippedExtraAudio = shallowRef('')
  const restorePrecision = shallowRef<TourRestorePrecision>('exact')
  const stageId = shallowRef<string | null>(null)
  /** 队列版本号：每次重建队列自增，过期回调据此丢弃 */
  const queueVersion = shallowRef(0)
  const queue = shallowRef<TourQueueItem[]>([])
  const currentIndex = shallowRef(-1)
  const currentItemId = shallowRef<string | null>(null)
  const currentItemType = shallowRef<TourQueueItemType | null>(null)
  /** 当前文件音频的播放时间（秒），暂停/继续/断点据此恢复 */
  const playedSeconds = shallowRef(0)
  /** 当前文件音频的总时长（秒）；系统语音时为估算总时长 */
  const currentItemDuration = shallowRef(0)
  /** 当前系统语音读到第几句（文件音频时保持 0） */
  const currentSentenceIndex = shallowRef(0)
  const currentItem = computed(() => queue.value[currentIndex.value] ?? null)
  /** 当前条目是否可定位：有在播条目即可，文件与系统语音都支持（精度不同） */
  const canSeek = computed(() => status.value !== 'idle' && Boolean(currentItem.value))

  let items: TourQueueItem[] = []
  let index = 0
  let options: TourQueueOptions = {}
  let locale: TourLocale = 'zh'
  let audio: HTMLAudioElement | null = null
  let utterance: SpeechSynthesisUtterance | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let voicesChanged: (() => void) | undefined
  /** 文件音频恢复位置（秒） */
  let resumeSeconds = 0
  /** 系统语音恢复位置：句子序号 */
  let sentences: string[] = []
  let sentenceIndex = 0
  /** 待消费的恢复句序号（只对队列首个条目生效） */
  let resumeSentence = 0
  /** 本队列内已回退过系统语音的条目，避免反复回退 */
  const fallenBack = new Set<string>()
  let narrationTotal = 0
  let narrationPlayed = 0
  let narrationCompleted = false

  function invalidateQueue() {
    queueVersion.value += 1
  }

  function clearWait() {
    clearTimeout(timer)
    if (voicesChanged) window.speechSynthesis?.removeEventListener('voiceschanged', voicesChanged)
    voicesChanged = undefined
  }

  function releaseAudio() {
    if (!audio) return
    audio.onplaying = null
    audio.ontimeupdate = null
    audio.onloadedmetadata = null
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = null
  }

  function releaseUtterance() {
    if (!utterance) return
    utterance.onstart = null
    utterance.onend = null
    utterance.onerror = null
    window.speechSynthesis?.cancel()
    utterance = null
  }

  function releaseMedia() {
    clearWait()
    releaseAudio()
    releaseUtterance()
  }

  function resetQueueState() {
    items = []
    queue.value = []
    index = 0
    currentIndex.value = -1
    currentItemId.value = null
    currentItemType.value = null
    playedSeconds.value = 0
    currentItemDuration.value = 0
    currentSentenceIndex.value = 0
    resumeSeconds = 0
    resumeSentence = 0
    sentences = []
    sentenceIndex = 0
    narrationTotal = 0
    narrationPlayed = 0
    narrationCompleted = false
    blocked.value = false
  }

  /** 中止整个队列：队列版本自增后，旧队列的 ended / onend 回调全部失效 */
  function stop() {
    invalidateQueue()
    releaseMedia()
    resetQueueState()
    status.value = 'idle'
  }

  /** 主讲解失败：沿用既有讲解错误与回退策略（不因额外音频结束就判定讲解完成） */
  function failNarration(reason: 'unavailable' | 'voiceMissing' | 'playback') {
    invalidateQueue()
    releaseMedia()
    status.value = 'idle'
    currentItemId.value = null
    currentItemType.value = null
    blocked.value = false
    error.value = reason
  }

  function advance(version: number) {
    if (version !== queueVersion.value) return
    const item = items[index]
    if (item?.type === 'chapter') {
      narrationPlayed += 1
      if (narrationPlayed >= narrationTotal) narrationCompleted = true
    }
    releaseMedia()
    index += 1
    playItem(version)
  }

  function finish(version: number) {
    if (version !== queueVersion.value) return
    releaseMedia()
    status.value = 'idle'
    currentIndex.value = -1
    currentItemId.value = null
    currentItemType.value = null
    playedSeconds.value = 0
    currentItemDuration.value = 0
    currentSentenceIndex.value = 0
    index = 0
    // 后置额外音频播完才算队列结束；只有讲解章节真的播完才推进下一站
    if (narrationCompleted) {
      narrationCompleted = false
      onNarrationEnd()
    }
  }

  /** 条目播放失败：额外音频提示并跳过；讲解章节先按既有策略回退系统语音 */
  function failItem(item: TourQueueItem, version: number) {
    if (version !== queueVersion.value) return
    releaseMedia()
    if (item.type === 'chapter') {
      if (fallenBack.has(item.id)) { failNarration('playback'); return }
      fallenBack.add(item.id)
      speakItem(item, version, 0)
      return
    }
    skippedExtraAudio.value = item.title || item.id
    index += 1
    playItem(version)
  }

  function skipItem(item: TourQueueItem, version: number) {
    if (version !== queueVersion.value) return
    releaseMedia()
    skippedExtraAudio.value = item.title || item.id
    index += 1
    playItem(version)
  }

  function playFile(item: TourQueueItem, version: number) {
    const source = item.audioUrl
    if (!source) { failItem(item, version); return }
    const element = new Audio(source)
    audio = element
    const startAt = resumeSeconds
    resumeSeconds = 0
    currentItemDuration.value = item.durationSeconds ?? 0
    element.onloadedmetadata = () => {
      if (version !== queueVersion.value) return
      if (Number.isFinite(element.duration) && element.duration > 0) currentItemDuration.value = element.duration
    }
    element.onplaying = () => {
      if (version !== queueVersion.value) return
      clearWait()
      blocked.value = false
      // 已经开始播放的前置音频计入"本次游览已播过"，切换导游后不再重复
      if (item.type === 'extra-before' && item.extraAudioId && !options.skipBeforeAudioDedupe) {
        options.playedBeforeExtraIds?.add(item.extraAudioId)
      }
    }
    element.ontimeupdate = () => {
      if (version !== queueVersion.value) return
      if (Number.isFinite(element.currentTime)) playedSeconds.value = element.currentTime
      if (Number.isFinite(element.duration) && element.duration > 0) currentItemDuration.value = element.duration
    }
    element.onended = () => advance(version)
    element.onerror = () => failItem(item, version)
    applyStartTime(element, startAt)
    timer = setTimeout(() => failItem(item, version), FILE_START_TIMEOUT_MS)
    void element.play().catch((caught: unknown) => {
      if (version !== queueVersion.value) return
      if (isAutoplayBlocked(caught)) {
        // 保留待播条目与恢复位置，等用户点"继续播放"
        clearWait()
        status.value = 'paused'
        blocked.value = true
        return
      }
      failItem(item, version)
    })
  }

  function speakItem(item: TourQueueItem, version: number, startSentence = 0) {
    const text = item.text?.trim() ?? ''
    if (!text) {
      if (item.type === 'chapter') failNarration('unavailable')
      else skipItem(item, version)
      return
    }
    sentences = splitSentences(text)
    sentenceIndex = Math.min(Math.max(0, startSentence), Math.max(0, sentences.length - 1))
    currentSentenceIndex.value = sentenceIndex
    speakSentence(item, version)
  }

  function speakSentence(item: TourQueueItem, version: number) {
    const synthesis = window.speechSynthesis
    if (!synthesis) { failNarration('unavailable'); return }
    const sentence = sentences[sentenceIndex]
    if (!sentence) { advance(version); return }
    const begin = () => {
      if (version !== queueVersion.value || status.value !== 'playing') return
      clearWait()
      const voice = synthesis.getVoices().find(item => item.lang.toLowerCase().split(/[-_]/)[0] === locale)
      if (!voice) { failNarration('voiceMissing'); return }
      utterance = new SpeechSynthesisUtterance(sentence)
      utterance.voice = voice
      utterance.lang = TOUR_LANGUAGES.find(language => language.value === locale)!.speech
      utterance.rate = 0.95
      utterance.onstart = () => clearTimeout(timer)
      utterance.onend = () => {
        if (version !== queueVersion.value) return
        releaseUtterance()
        sentenceIndex += 1
        currentSentenceIndex.value = sentenceIndex
        speakSentence(item, version)
      }
      utterance.onerror = () => failNarration('playback')
      timer = setTimeout(() => failNarration('playback'), SPEECH_START_TIMEOUT_MS)
      synthesis.resume()
      synthesis.speak(utterance)
    }
    if (synthesis.getVoices().length) begin()
    else {
      voicesChanged = begin
      synthesis.addEventListener('voiceschanged', begin)
      timer = setTimeout(begin, VOICE_WAIT_TIMEOUT_MS)
    }
  }

  function playItem(version: number, startSentence = 0) {
    if (version !== queueVersion.value) return
    const item = items[index]
    if (!item) { finish(version); return }
    currentIndex.value = index
    currentItemId.value = item.id
    currentItemType.value = item.type
    playedSeconds.value = 0
    currentItemDuration.value = item.durationSeconds ?? 0
    sentences = []
    sentenceIndex = startSentence
    currentSentenceIndex.value = startSentence
    // 新条目从头发起，恢复精度重新按精确计
    restorePrecision.value = 'exact'
    // 讲解章节只有中文走文件音频，其余语言沿用既有系统语音策略；额外音频一律是文件
    if (item.audioUrl && (item.type !== 'chapter' || locale === 'zh')) { playFile(item, version); return }
    speakItem(item, version, startSentence)
  }

  /** 只准备条目与位置，不发起播放（断点记录的是"暂停中"时用） */
  function prepareItemAt(targetIndex: number, seconds: number, sentence: number) {
    const item = items[targetIndex]
    if (!item) return
    const isFile = Boolean(item.audioUrl && (item.type !== 'chapter' || locale === 'zh'))
    index = targetIndex
    currentIndex.value = targetIndex
    currentItemId.value = item.id
    currentItemType.value = item.type
    playedSeconds.value = isFile ? seconds : 0
    currentItemDuration.value = item.durationSeconds ?? 0
    sentences = isFile ? [] : splitSentences(item.text?.trim() ?? '')
    sentenceIndex = isFile ? 0 : sentence
    currentSentenceIndex.value = sentenceIndex
    restorePrecision.value = isFile ? 'exact' : 'approximate'
  }

  function startQueue(
    nextStageId: string | null,
    built: TourQueueItem[],
    language: TourLocale,
    queueOptions: TourQueueOptions,
    resume?: TourResumeTarget | null,
  ) {
    invalidateQueue()
    releaseMedia()
    error.value = null
    skippedExtraAudio.value = ''
    restorePrecision.value = 'exact'
    locale = language
    options = queueOptions
    stageId.value = nextStageId
    resetQueueState()
    items = built
    queue.value = built
    fallenBack.clear()
    narrationTotal = built.filter(item => item.type === 'chapter').length
    if (!built.length) {
      status.value = 'idle'
      error.value = 'unavailable'
      return
    }
    // 断点恢复：条目按 ID 优先匹配，匹配不到时退回下标；越界则从头播放
    let startIndex = 0
    let startSeconds = 0
    let startSentence = 0
    let startPaused = false
    if (resume) {
      const byId = resume.itemId ? built.findIndex(item => item.id === resume.itemId) : -1
      const byIndex = Number.isFinite(resume.queueIndex) ? Math.floor(resume.queueIndex) : -1
      const candidate = byId >= 0 ? byId : byIndex
      startIndex = candidate >= 0 && candidate < built.length ? candidate : 0
      startSeconds = Math.max(0, resume.currentTimeSeconds ?? 0)
      startSentence = Math.max(0, resume.sentenceIndex ?? 0)
      startPaused = Boolean(resume.paused)
    }
    // 恢复时要把前面的讲解章节记为"已播"，否则完成判定会错位
    narrationPlayed = built.slice(0, startIndex).filter(item => item.type === 'chapter').length
    if (startPaused) {
      prepareItemAt(startIndex, startSeconds, startSentence)
      resumeSeconds = startSeconds
      resumeSentence = startSentence
      status.value = 'paused'
      return
    }
    resumeSeconds = startSeconds
    resumeSentence = 0
    if (startSeconds > 0) restorePrecision.value = 'exact'
    else if (startSentence > 0) restorePrecision.value = 'approximate'
    index = startIndex
    status.value = 'playing'
    playItem(queueVersion.value, startSentence)
  }

  /** 播放一个站点的完整队列：额外音频来自站点本身，讲解章节来自当前导游 */
  function play(
    stop: ClientTourStop | null,
    chapters: TourNarrationChapter[] | null | undefined,
    language: TourLocale,
    queueOptions: TourQueueOptions = {},
    resume?: TourResumeTarget | null,
  ) {
    startQueue(stop?.id ?? null, buildTourQueue(stop?.extraAudios, chapters, queueOptions), language, queueOptions, resume)
  }

  /** 单独播放一条额外音频：站点没有讲解章节时也能用；不影响"已播过"记录 */
  function playExtra(stop: ClientTourStop | null, extraAudio: ClientStopExtraAudio, language: TourLocale) {
    const built = buildExtraAudioQueue(extraAudio)
    if (!built.length) { error.value = 'unavailable'; return false }
    startQueue(stop?.id ?? null, built, language, {}, null)
    return true
  }

  /** 暂停：保留当前条目；文件音频记住播放时间，系统语音记住当前句 */
  function pause() {
    if (status.value !== 'playing') return
    status.value = 'paused'
    clearWait()
    if (audio) {
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
      resumeSeconds = current
      playedSeconds.value = current
      restorePrecision.value = 'exact'
      audio.pause()
      return
    }
    if (utterance) {
      // 系统语音无法读回精确时间：回到当前句开头，UI 按"近似"标注
      restorePrecision.value = 'approximate'
      resumeSentence = sentenceIndex
      releaseUtterance()
    }
  }

  /** 继续：文件音频恢复到已记录时间；系统语音从当前句重播（近似） */
  function resume() {
    if (status.value !== 'paused') return
    const version = queueVersion.value
    const item = items[index]
    if (!item) { status.value = 'idle'; return }
    status.value = 'playing'
    blocked.value = false
    if (audio) {
      restorePrecision.value = 'exact'
      if (resumeSeconds > 0) {
        try { audio.currentTime = resumeSeconds } catch { /* 不可寻址时从头播放 */ }
      }
      timer = setTimeout(() => { if (version === queueVersion.value) failItem(item, version) }, FILE_START_TIMEOUT_MS)
      void audio.play().catch((caught: unknown) => {
        if (version !== queueVersion.value) return
        if (isAutoplayBlocked(caught)) {
          clearWait()
          status.value = 'paused'
          blocked.value = true
          return
        }
        failItem(item, version)
      })
      return
    }
    // 断点恢复出来的"暂停中"条目还没有建立音频元素，这里补建
    if (item.audioUrl && (item.type !== 'chapter' || locale === 'zh')) {
      restorePrecision.value = 'exact'
      playFile(item, version)
      return
    }
    restorePrecision.value = 'approximate'
    speakItem(item, version, sentenceIndex)
  }

  /**
   * ±15 秒定位（方案 §4.2）：
   * - 文件音频：精确 seek，只在本条目内 clamp，不跨条目；
   * - 系统语音：按句子估算时长近似跳转，跳句不参与"讲解是否播完"的判定。
   */
  function seekBy(deltaSeconds: number): TourSeekResult {
    if (status.value === 'idle') return { moved: false, precision: 'unavailable', reason: 'idle' }
    const version = queueVersion.value
    const item = items[index]
    if (!item) return { moved: false, precision: 'unavailable', reason: 'idle' }

    if (audio || (status.value === 'paused' && item.audioUrl && (item.type !== 'chapter' || locale === 'zh'))) {
      const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : (item.durationSeconds ?? 0)
      const previous = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : resumeSeconds
      if (!Number.isFinite(duration) || duration <= 0) return { moved: false, precision: 'unavailable', reason: 'not-seekable' }
      const target = resolveFileSeekTarget(previous, duration, deltaSeconds)
      try { if (audio) audio.currentTime = target.time } catch { return { moved: false, precision: 'unavailable', reason: 'not-seekable' } }
      playedSeconds.value = target.time
      resumeSeconds = target.time
      restorePrecision.value = 'exact'
      if (target.atStart) return { moved: target.time !== previous, precision: 'exact', reason: 'at-start' }
      if (target.atEnd) return { moved: target.time !== previous, precision: 'exact', reason: 'at-end' }
      return { moved: target.time !== previous, precision: 'exact' }
    }

    if (!sentences.length) return { moved: false, precision: 'unavailable', reason: 'not-seekable' }
    const result = resolveSentenceSeek(sentences, locale, sentenceIndex, deltaSeconds)
    if (!result.moved) {
      return {
        moved: false,
        precision: 'approximate',
        reason: deltaSeconds < 0 ? 'at-start' : 'at-end',
      }
    }
    releaseUtterance()
    sentenceIndex = result.index
    currentSentenceIndex.value = result.index
    resumeSentence = result.index
    restorePrecision.value = 'approximate'
    if (status.value === 'playing') speakItem(item, version, result.index)
    return { moved: true, precision: 'approximate' }
  }

  /** 断点快照：文件音频取精确秒数，系统语音取当前句序号 */
  function captureCheckpoint(): TourSpeechCheckpoint {
    const item = items[index]
    const fileSeconds = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : playedSeconds.value
    return {
      itemId: item?.id ?? currentItemId.value,
      itemType: item?.type ?? currentItemType.value,
      queueIndex: index,
      currentTimeSeconds: item?.audioUrl && (item.type !== 'chapter' || locale === 'zh') ? Math.max(0, fileSeconds) : 0,
      sentenceIndex: item?.audioUrl && (item.type !== 'chapter' || locale === 'zh') ? 0 : sentenceIndex,
      status: status.value,
    }
  }

  function dismissSkipped() {
    skippedExtraAudio.value = ''
  }

  onBeforeUnmount(stop)
  return {
    status,
    error,
    blocked,
    skippedExtraAudio,
    restorePrecision,
    stageId,
    queueVersion,
    queue,
    currentIndex,
    currentItem,
    currentItemId,
    currentItemType,
    playedSeconds,
    currentItemDuration,
    currentSentenceIndex,
    canSeek,
    play,
    playExtra,
    pause,
    resume,
    stop,
    seekBy,
    captureCheckpoint,
    dismissSkipped,
  }
}
