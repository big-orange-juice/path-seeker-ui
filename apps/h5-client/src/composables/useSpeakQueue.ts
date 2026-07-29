import { computed, onUnmounted, shallowRef } from "vue"
import { v4 as uuidv4 } from "uuid"
import { synthesizeSpeech } from "@/services/minimaxTts"
import { useAskStore } from "@/stores/useAskStore"

export type SpeakQueueStatus = "idle" | "loading" | "speaking"

interface SpeakQueueItem {
  id: string
  text: string
  runId: string
  /** 预取或同步合成得到的音频 */
  blob?: Blob
  /** 预取/合成中的 Promise（同一 item 只发起一次） */
  synthPromise?: Promise<Blob | null>
  synthAbort?: AbortController
}

/**
 * 句级串行 TTS 播放队列 + 下一句预取（非 stream）。
 * - 播放当前句时并行合成 queue[0]（下一句），缩短句间静音
 * - 同 run 顺序播报；cancel / 换 run 清空队列并 abort 所有 in-flight
 */
export function useSpeakQueue() {
  const askStore = useAskStore()
  const status = shallowRef<SpeakQueueStatus>("idle")
  const errorMessage = shallowRef("")
  const currentText = shallowRef("")
  const queueLength = shallowRef(0)

  const queue: SpeakQueueItem[] = []
  let activeRunId = ""
  let processing = false
  let generation = 0
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null

  const isBusy = computed(() => status.value === "loading" || status.value === "speaking")

  function ensureAudio() {
    if (!audio) {
      audio = new Audio()
      audio.preload = "auto"
    }
    return audio
  }

  /** iOS：在用户手势回调里调用，解锁自动播放。 */
  function unlock() {
    try {
      const el = ensureAudio()
      el.muted = true
      const playPromise = el.play()
      if (playPromise && typeof playPromise.then === "function") {
        void playPromise
          .then(() => {
            el.pause()
            el.currentTime = 0
            el.muted = false
          })
          .catch(() => {
            el.muted = false
          })
      } else {
        el.muted = false
      }
    } catch {
      // ignore
    }
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  function stopAudioElement() {
    if (!audio) {
      return
    }
    try {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
    } catch {
      // ignore
    }
    revokeObjectUrl()
  }

  function syncQueueLength() {
    queueLength.value = queue.length
  }

  function abortItemSynth(item: SpeakQueueItem) {
    if (item.synthAbort) {
      item.synthAbort.abort()
      item.synthAbort = undefined
    }
  }

  function abortAllSynth() {
    for (const item of queue) {
      abortItemSynth(item)
    }
  }

  /**
   * 为某一句发起（或复用）合成 Promise。
   * 同一 item 只会打一次 MiniMax 请求。
   */
  function startSynth(item: SpeakQueueItem, gen: number): Promise<Blob | null> {
    if (item.blob) {
      return Promise.resolve(item.blob)
    }
    if (item.synthPromise) {
      return item.synthPromise
    }

    const controller = new AbortController()
    item.synthAbort = controller

    // 用户全局音色优先；未设置时 synthesizeSpeech 内回落 env VOICE_ID
    const preferredVoiceId = String(askStore.voiceId || "").trim() || undefined
    item.synthPromise = synthesizeSpeech({
      text: item.text,
      signal: controller.signal,
      voiceId: preferredVoiceId,
    })
      .then((blob) => {
        if (gen !== generation) {
          return null
        }
        item.blob = blob
        item.synthAbort = undefined
        return blob
      })
      .catch((error: unknown) => {
        item.synthAbort = undefined
        if (error instanceof DOMException && error.name === "AbortError") {
          return null
        }
        if (gen !== generation) {
          return null
        }
        throw error
      })

    return item.synthPromise
  }

  /** 预取队列头（下一句）；失败静默，播放时再表面错误 */
  function prefetchHead(gen: number) {
    const next = queue[0]
    if (!next || next.runId !== activeRunId) {
      return
    }
    if (next.blob || next.synthPromise) {
      return
    }
    void startSynth(next, gen).catch(() => {
      // 预取失败不打断当前播放；轮到该句时再处理
    })
  }

  async function resolveItemBlob(item: SpeakQueueItem, gen: number): Promise<Blob | null> {
    if (item.blob) {
      return item.blob
    }
    try {
      return await startSynth(item, gen)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null
      }
      if (gen !== generation) {
        return null
      }
      errorMessage.value = error instanceof Error ? error.message : "语音合成失败。"
      return null
    }
  }

  function cancel() {
    generation += 1
    abortAllSynth()
    queue.length = 0
    syncQueueLength()
    stopAudioElement()
    processing = false
    currentText.value = ""
    status.value = "idle"
  }

  function bindRun(runId: string) {
    const next = String(runId || "").trim()
    if (next && next !== activeRunId) {
      cancel()
      activeRunId = next
    } else if (!activeRunId && next) {
      activeRunId = next
    }
  }

  function enqueue(text: string, runId = "") {
    const cleaned = String(text || "").trim()
    if (!cleaned) {
      return
    }

    const rid = String(runId || activeRunId || "").trim() || "local"
    if (activeRunId && rid !== activeRunId) {
      // 新 run：清空旧队列
      cancel()
    }
    activeRunId = rid

    queue.push({
      id: uuidv4(),
      text: cleaned,
      runId: rid,
    })
    syncQueueLength()

    // 已在播放时，确保下一句处于预取中
    if (processing) {
      prefetchHead(generation)
    }

    void pump()
  }

  function playBlob(blob: Blob, gen: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (gen !== generation) {
        resolve()
        return
      }

      const el = ensureAudio()
      revokeObjectUrl()
      objectUrl = URL.createObjectURL(blob)
      el.src = objectUrl

      const cleanup = () => {
        el.onended = null
        el.onerror = null
      }

      el.onended = () => {
        cleanup()
        resolve()
      }
      el.onerror = () => {
        cleanup()
        reject(new Error("音频播放失败。"))
      }

      status.value = "speaking"
      const playPromise = el.play()
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch((error: unknown) => {
          cleanup()
          reject(error instanceof Error ? error : new Error("无法播放语音。"))
        })
      }
    })
  }

  async function pump() {
    if (processing) {
      return
    }
    processing = true
    const gen = generation

    try {
      while (queue.length > 0 && gen === generation) {
        const item = queue.shift()
        syncQueueLength()
        if (!item) {
          break
        }
        if (item.runId !== activeRunId) {
          abortItemSynth(item)
          continue
        }

        currentText.value = item.text
        errorMessage.value = ""

        // 播放当前句前：并行预取「新的」下一句
        prefetchHead(gen)

        if (!item.blob) {
          status.value = "loading"
        }

        const blob = await resolveItemBlob(item, gen)
        if (gen !== generation) {
          break
        }
        if (!blob) {
          // 合成失败或 abort：跳过该句，继续后续
          currentText.value = ""
          if (status.value === "loading") {
            status.value = "idle"
          }
          continue
        }

        if (item.runId !== activeRunId) {
          break
        }

        // 进入播放时再确保下一句在预取（队列可能在 loading 期间又 enqueue 了）
        prefetchHead(gen)

        try {
          await playBlob(blob, gen)
        } catch (error) {
          if (gen !== generation) {
            break
          }
          errorMessage.value = error instanceof Error ? error.message : "播放失败。"
        }
      }
    } finally {
      // 已被 cancel / 新 generation 接管时，禁止改 processing，否则会 concurrent pump 或丢尾句
      if (gen !== generation) {
        return
      }
      processing = false
      currentText.value = ""
      status.value = "idle"
      if (queue.length > 0) {
        void pump()
      }
    }
  }

  onUnmounted(() => {
    cancel()
    audio = null
  })

  return {
    status,
    errorMessage,
    currentText,
    queueLength,
    isBusy,
    unlock,
    enqueue,
    cancel,
    bindRun,
  }
}
