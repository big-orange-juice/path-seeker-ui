import { computed, onBeforeUnmount, shallowRef } from 'vue'

export type DuplexPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface DuplexMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}

interface AudioSentence {
  chunks: Uint8Array[]
  final: boolean
}

function bytesFromHex(hex: string) {
  const bytes = new Uint8Array(Math.floor(hex.length / 2))
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index += 1) view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, samples[index])) * (samples[index] < 0 ? 0x8000 : 0x7fff), true)
  return buffer
}

function resample(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)))
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    output[index] = input[left] * (1 - position + left) + input[right] * (position - left)
  }
  return output
}

export function useDuplexVoice() {
  const phase = shallowRef<DuplexPhase>('idle')
  const connected = shallowRef(false)
  const error = shallowRef('')
  const messages = shallowRef<DuplexMessage[]>([])
  const speakingId = shallowRef('')
  const session = `s-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)).replaceAll('-', '')}`
  const apiBase = String(import.meta.env.VITE_DUPLEX_API_BASE || '/duplex').replace(/\/$/, '')
  const turnKey = shallowRef('')
  const audioContext = shallowRef<AudioContext>()
  const eventSource = shallowRef<EventSource>()
  const stream = shallowRef<MediaStream>()
  const processor = shallowRef<ScriptProcessorNode>()
  const source = shallowRef<MediaStreamAudioSourceNode>()
  const recordedFrames: Float32Array[] = []
  const sentenceAudio = new Map<number, AudioSentence>()
  // index -> 句子文本；音频缺失时用于系统朗读兜底
  const sentenceText = new Map<number, string>()
  // 已确认排期播放的句子下标，避免兜底朗读与真实音频重复
  const spokenIndexes = new Set<number>()
  const playingSources = new Set<AudioBufferSourceNode>()
  const degraded = shallowRef('')
  let nextSentence = 0
  let audioBusy = false
  let flushingAudio = false
  let playhead = 0
  let speechStartedAt = 0
  let silenceStartedAt = 0
  let connectionWaiters: Array<() => void> = []
  // hello 事件同步服务端音频格式（mp3 / pcm）；pcm 需要手动解码，否则整轮无声
  let audioFormat = 'mp3'
  let audioSampleRate = 24000
  // 播放代次：stopAudio / 新一轮发送时递增，用于丢弃打断后仍在途的解码与排期
  let playbackGeneration = 0
  // 看门狗：文本已产生却长时间没有音频进展时，判定合成失败并降级
  let lastProgressAt = 0
  let stallTimer = 0
  let textSeen = false
  let fallbackActive = false
  let fallbackBusy = false
  const FALLBACK_STALL_MS = 15000
  const fallbackEnabled = typeof window !== 'undefined' && 'speechSynthesis' in window

  const isSupported = computed(() => typeof window !== 'undefined' && 'EventSource' in window && 'AudioContext' in window && !!navigator.mediaDevices)

  function appendMessage(role: DuplexMessage['role'], text: string, id = `${role}-${Date.now()}-${Math.random()}`) {
    if (!text.trim()) return
    messages.value = [...messages.value, { id, role, text }]
  }

  function connect() {
    if (eventSource.value || !isSupported.value) return
    const sourceEvent = new EventSource(`${apiBase}/api/events?session=${encodeURIComponent(session)}`)
    eventSource.value = sourceEvent
    sourceEvent.addEventListener('open', () => { connected.value = true; error.value = ''; connectionWaiters.splice(0).forEach(resolve => resolve()) })
    sourceEvent.addEventListener('error', event => {
      // 区分「连接断开」与业务 `event: error`（后者由下方带 payload 的分支处理，连接仍然健康）
      if ((event as MessageEvent).data) return
      connected.value = false; error.value = '语音服务连接中断，请稍后重试。'
    })
    sourceEvent.addEventListener('hello', event => {
      connected.value = true
      try {
        const data = JSON.parse((event as MessageEvent).data) as { audio?: { format?: string; sampleRate?: number } }
        if (data.audio?.format) audioFormat = data.audio.format.toLowerCase()
        if (data.audio?.sampleRate) audioSampleRate = data.audio.sampleRate
      } catch { /* hello 解析失败不致命，保持默认 mp3 */ }
    })
    sourceEvent.addEventListener('turn.start', () => { phase.value = 'thinking' })
    sourceEvent.addEventListener('asr.start', () => { phase.value = 'thinking' })
    sourceEvent.addEventListener('user.text', event => {
      const data = JSON.parse((event as MessageEvent).data) as { text?: string; turnKey?: string }
      if (data.turnKey === turnKey.value) appendMessage('user', data.text || '')
    })
    sourceEvent.addEventListener('text.delta', event => {
      const data = JSON.parse((event as MessageEvent).data) as { text?: string; index?: number; turnKey?: string }
      if (data.turnKey !== turnKey.value || !data.text) return
      if (data.index !== undefined) sentenceText.set(data.index, data.text)
      textSeen = true
      touchProgress()
      const id = `assistant-${data.turnKey}`
      const existing = messages.value.find(message => message.id === id)
      messages.value = existing ? messages.value.map(message => message.id === id ? { ...message, text: `${message.text}${data.text}` } : message) : [...messages.value, { id, role: 'assistant', text: data.text }]
    })
    sourceEvent.addEventListener('audio.chunk', event => {
      const data = JSON.parse((event as MessageEvent).data) as { turnKey?: string; index?: number; hex?: string; isFinal?: boolean }
      if (data.turnKey !== turnKey.value || data.index === undefined) return
      touchProgress()
      const sentence = sentenceAudio.get(data.index) || { chunks: [], final: false }
      if (data.hex) sentence.chunks.push(bytesFromHex(data.hex))
      sentence.final = !!data.isFinal
      sentenceAudio.set(data.index, sentence)
      void flushAudio()
    })
    sourceEvent.addEventListener('interrupted', event => {
      const data = JSON.parse((event as MessageEvent).data) as { turnKey?: string }
      if (data.turnKey === turnKey.value) stopAudio()
    })
    sourceEvent.addEventListener('turn.done', () => {
      finishStallWatch()
      if (!audioBusy && !flushingAudio) phase.value = 'listening'
      if (fallbackActive) void pumpFallback()
    })
    sourceEvent.addEventListener('error', event => {
      const payload = (event as MessageEvent).data
      if (!payload) return
      try {
        const data = JSON.parse(payload) as { message?: string }
        error.value = data.message || '语音服务请求失败。'
      } catch { error.value = '语音服务返回了无法识别的错误。' }
      finishStallWatch()
      if (sentenceText.size) {
        // 文字已产生但音频中断：播完已到齐的句子，其余用系统语音兜底
        degradeToFallback('语音合成中断，剩余内容已切换为系统朗读。')
      } else {
        phase.value = 'error'
      }
    })
  }

  function waitForConnection(timeout = 5000) {
    if (connected.value) return Promise.resolve(true)
    connect()
    return new Promise<boolean>(resolve => {
      let timer = 0
      const finish = () => { window.clearTimeout(timer); resolve(true) }
      timer = window.setTimeout(() => {
        connectionWaiters = connectionWaiters.filter(item => item !== finish)
        resolve(false)
      }, timeout)
      connectionWaiters.push(finish)
    })
  }

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`${apiBase}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`)
  }

  async function ensureAudio() {
    if (!audioContext.value) audioContext.value = new AudioContext({ latencyHint: 'interactive' })
    if (audioContext.value.state !== 'running') await audioContext.value.resume()
  }

  function markDegraded(reason: string) {
    if (!degraded.value) degraded.value = reason
  }

  function touchProgress() {
    lastProgressAt = performance.now()
    if (!stallTimer) startStallWatch()
  }

  // 看门狗：文本已产生但音频长时间没有进展时，判定合成失败并降级，避免整轮静音
  function startStallWatch() {
    finishStallWatch()
    stallTimer = window.setInterval(() => {
      if (!textSeen || !audioContext.value || (phase.value !== 'thinking' && phase.value !== 'speaking')) return
      if (playingSources.size) { lastProgressAt = performance.now(); return }
      if (performance.now() - lastProgressAt < FALLBACK_STALL_MS) return
      degradeToFallback('语音合成超时，剩余内容已切换为系统朗读。')
    }, 2500)
  }

  function finishStallWatch() {
    if (stallTimer) { window.clearInterval(stallTimer); stallTimer = 0 }
  }

  // 降级兜底：放弃卡住/中断的首句，已到齐的音频继续播，缺失部分交给系统朗读
  function degradeToFallback(reason: string) {
    markDegraded(reason)
    finishStallWatch()
    fallbackActive = true
    const head = sentenceAudio.get(nextSentence)
    if (head && !head.final) { sentenceAudio.delete(nextSentence); nextSentence += 1 }
    void flushAudio()
    void pumpFallback()
    if (!fallbackEnabled && !playingSources.size && !flushingAudio) phase.value = 'listening'
  }

  function settlePlaybackIfIdle() {
    if (playingSources.size || flushingAudio || sentenceAudio.size) return
    audioBusy = false; speakingId.value = ''
    if (phase.value === 'speaking') phase.value = 'listening'
    if (fallbackActive) void pumpFallback()
  }

  // 浏览器内置语音合成，作为音频缺失时的兜底（无需密钥，纯客户端）
  function speakWithSynthesis(text: string) {
    return new Promise<void>(resolve => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      let settled = false
      const finish = () => { if (!settled) { settled = true; window.clearTimeout(timer); resolve() } }
      // 个别浏览器不触发 onend/onerror，用时长估算兜底
      const timer = window.setTimeout(finish, Math.max(5000, text.length * 260))
      utterance.onend = finish
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    })
  }

  async function pumpFallback() {
    if (!fallbackActive || !fallbackEnabled || fallbackBusy || audioBusy) return
    const generation = playbackGeneration
    fallbackBusy = true
    try {
      // 只朗读「已有文本、且没有任何可播音频」的句子；真实音频还在队列中的句子让位给它
      const pending = [...sentenceText.keys()]
        .filter(index => !spokenIndexes.has(index) && !sentenceAudio.has(index))
        .sort((left, right) => left - right)
      for (const index of pending) {
        if (generation !== playbackGeneration || audioBusy) return
        const text = sentenceText.get(index)
        if (!text) continue
        spokenIndexes.add(index)
        await speakWithSynthesis(text)
      }
      if (generation === playbackGeneration) phase.value = 'listening'
    } finally {
      if (generation === playbackGeneration) fallbackBusy = false
    }
  }

  // 服务端 hello 声明 mp3 / pcm：pcm 为 Int16LE 单声道裸数据，decodeAudioData 无法直接解码
  async function decodeSentence(bytes: Uint8Array): Promise<AudioBuffer> {
    const context = audioContext.value!
    if (audioFormat === 'pcm') {
      const sampleCount = Math.floor(bytes.byteLength / 2)
      const samples = new Float32Array(sampleCount)
      const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2)
      for (let index = 0; index < sampleCount; index += 1) samples[index] = view.getInt16(index * 2, true) / 0x8000
      const resampled = resample(samples, audioSampleRate, context.sampleRate)
      const buffer = context.createBuffer(1, resampled.length, context.sampleRate)
      buffer.copyToChannel(resampled, 0)
      return buffer
    }
    return await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  }

  function stopAudio() {
    playbackGeneration += 1
    finishStallWatch()
    playingSources.forEach(current => { try { current.stop() } catch {} })
    playingSources.clear()
    sentenceAudio.clear(); sentenceText.clear(); spokenIndexes.clear()
    fallbackActive = false; fallbackBusy = false; textSeen = false
    if (fallbackEnabled) window.speechSynthesis.cancel()
    nextSentence = 0; audioBusy = false; flushingAudio = false; playhead = 0; speakingId.value = ''
  }

  async function flushAudio() {
    if (flushingAudio || !audioContext.value) return
    const generation = playbackGeneration
    flushingAudio = true
    try {
      while (sentenceAudio.get(nextSentence)?.final) {
        if (generation !== playbackGeneration) return
        const index = nextSentence
        const sentence = sentenceAudio.get(index)!
        sentenceAudio.delete(index)
        nextSentence += 1
        const length = sentence.chunks.reduce((total, chunk) => total + chunk.length, 0)
        const bytes = new Uint8Array(length); let offset = 0
        sentence.chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length })
        try {
          if (!length) throw new Error('empty sentence')
          const buffer = await decodeSentence(bytes)
          if (generation !== playbackGeneration) return
          const startAt = Math.max(audioContext.value.currentTime + 0.06, playhead)
          const node = audioContext.value.createBufferSource()
          node.buffer = buffer; node.connect(audioContext.value.destination); playingSources.add(node)
          spokenIndexes.add(index)
          audioBusy = true; phase.value = 'speaking'; speakingId.value = `assistant-${turnKey.value}`
          node.onended = () => {
            playingSources.delete(node)
            if (generation !== playbackGeneration) return
            settlePlaybackIfIdle()
          }
          node.start(startAt)
          playhead = startAt + buffer.duration
        } catch {
          // 单句空数据/解码失败：跳过该句继续推进，避免一条坏句卡死整个队列
          markDegraded('部分语音合成异常，已跳过对应片段。')
        }
      }
    } finally {
      if (generation === playbackGeneration) {
        flushingAudio = false
        if (sentenceAudio.get(nextSentence)?.final) void flushAudio()
        settlePlaybackIfIdle()
      }
    }
  }

  async function sendText(text: string, playAudio = true) {
    const value = text.trim(); if (!value) return
    if (!await waitForConnection()) { error.value = '语音服务尚未连接，请稍后重试。'; return }
    try { if (playAudio) await ensureAudio(); stopAudio(); error.value = ''; degraded.value = '' } catch (reason) { error.value = reason instanceof Error ? reason.message : '无法初始化语音播放'; return }
    const key = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; turnKey.value = key; phase.value = 'thinking'
    try { await post('turn', { session, turnKey: key, text: value }) } catch (reason) { error.value = reason instanceof Error ? reason.message : '语音服务请求失败'; phase.value = 'error' }
  }

  async function startListening() {
    if (!await waitForConnection()) throw new Error('语音服务尚未连接，请稍后重试。')
    await ensureAudio()
    if (stream.value) return
    stream.value = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    const ctx = audioContext.value!; source.value = ctx.createMediaStreamSource(stream.value); processor.value = ctx.createScriptProcessor(2048, 1, 1)
    const mute = ctx.createGain(); mute.gain.value = 0; recordedFrames.length = 0; speechStartedAt = 0; silenceStartedAt = 0
    source.value.connect(processor.value); processor.value.connect(mute); mute.connect(ctx.destination)
    processor.value.onaudioprocess = event => {
      const frame = new Float32Array(event.inputBuffer.getChannelData(0)); const rms = Math.sqrt(frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length); const now = performance.now()
      if (rms > 0.018) { if (!speechStartedAt) speechStartedAt = now; silenceStartedAt = 0; recordedFrames.push(frame); if (audioBusy || fallbackBusy) void interrupt() } else if (speechStartedAt) { recordedFrames.push(frame); if (!silenceStartedAt) silenceStartedAt = now; if (now - silenceStartedAt > 650) void stopListening(true) }
    }
    phase.value = 'listening'
  }

  async function stopListening(submit = false) {
    if (!stream.value) return
    processor.value?.disconnect(); source.value?.disconnect(); stream.value.getTracks().forEach(track => track.stop()); stream.value = undefined; processor.value = undefined; source.value = undefined
    const frames = recordedFrames.splice(0); speechStartedAt = 0; silenceStartedAt = 0; phase.value = 'idle'
    if (!submit || !frames.length) return
    const merged = new Float32Array(frames.reduce((total, frame) => total + frame.length, 0)); let offset = 0; frames.forEach(frame => { merged.set(frame, offset); offset += frame.length })
    const wav = encodeWav(resample(merged, audioContext.value?.sampleRate || 48000, 16000), 16000)
    const key = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; turnKey.value = key; phase.value = 'thinking'; error.value = ''; degraded.value = ''
    await post('turn', { session, turnKey: key, audioBase64: toBase64(wav) })
  }

  async function interrupt() {
    if (!turnKey.value && !audioBusy) return
    stopAudio(); phase.value = 'listening'
    await post('barge-in', { session, turnKey: turnKey.value }).catch(() => {})
  }

  function toggleListening() { return stream.value ? stopListening(false) : startListening().catch(reason => { error.value = reason instanceof Error ? reason.message : '无法打开麦克风'; phase.value = 'error' }) }
  function reset() { stopAudio(); void stopListening(false); void post('reset', { session }).catch(() => {}); messages.value = [] }

  connect()
  onBeforeUnmount(() => { stopAudio(); void stopListening(false); eventSource.value?.close() })

  return { phase, connected, error, degraded, messages, speakingId, isSupported, isListening: computed(() => !!stream.value), sendText, startListening, stopListening, toggleListening, interrupt, reset }
}
