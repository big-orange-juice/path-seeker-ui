/**
 * 串行播放 SSE 下发的 MP3 短句队列。
 * 按事件顺序入队，不得按网络完成顺序重排；同一时刻只播一个 Audio 元素。
 */

export type StreamAudioQueueStatus = "idle" | "loading" | "speaking"

export interface StreamAudioClip {
  id: string
  blob: Blob
  runId: string
}

export interface StreamAudioQueue {
  getStatus: () => StreamAudioQueueStatus
  getErrorMessage: () => string
  isBusy: () => boolean
  /** iOS：在用户手势回调里调用，解锁自动播放 */
  unlock: () => void
  bindRun: (runId: string) => void
  enqueueBlob: (blob: Blob, runId?: string) => void
  cancel: () => void
  /** 订阅状态变化（供 store / composable 同步 UI） */
  subscribe: (listener: () => void) => () => void
}

let clipSeq = 0

export function createStreamAudioQueue(): StreamAudioQueue {
  let status: StreamAudioQueueStatus = "idle"
  let errorMessage = ""
  const queue: StreamAudioClip[] = []
  let activeRunId = ""
  let processing = false
  let generation = 0
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // ignore subscriber errors
      }
    }
  }

  function setStatus(next: StreamAudioQueueStatus) {
    if (status === next) {
      return
    }
    status = next
    notify()
  }

  function setError(message: string) {
    errorMessage = message
    notify()
  }

  function ensureAudio() {
    if (!audio) {
      audio = new Audio()
      audio.preload = "auto"
    }
    return audio
  }

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

  function cancel() {
    generation += 1
    queue.length = 0
    stopAudioElement()
    processing = false
    errorMessage = ""
    setStatus("idle")
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

  function enqueueBlob(blob: Blob, runId = "") {
    if (!blob || blob.size <= 0) {
      return
    }

    const rid = String(runId || activeRunId || "").trim() || "local"
    if (activeRunId && rid !== activeRunId) {
      cancel()
    }
    activeRunId = rid

    clipSeq += 1
    queue.push({
      id: `sse-audio-${clipSeq}`,
      blob,
      runId: rid,
    })

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

      setStatus("speaking")
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
        if (!item) {
          break
        }
        if (item.runId !== activeRunId) {
          continue
        }

        errorMessage = ""
        setStatus("loading")

        try {
          await playBlob(item.blob, gen)
        } catch (error) {
          if (gen !== generation) {
            break
          }
          setError(error instanceof Error ? error.message : "播放失败。")
        }
      }
    } finally {
      if (gen !== generation) {
        return
      }
      processing = false
      setStatus("idle")
      if (queue.length > 0) {
        void pump()
      }
    }
  }

  return {
    getStatus: () => status,
    getErrorMessage: () => errorMessage,
    isBusy: () => status === "loading" || status === "speaking",
    unlock,
    bindRun,
    enqueueBlob,
    cancel,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Ask 语音 SSE 共用单例，避免多个组件各自 new Audio */
let sharedQueue: StreamAudioQueue | null = null

export function getSharedStreamAudioQueue() {
  if (!sharedQueue) {
    sharedQueue = createStreamAudioQueue()
  }
  return sharedQueue
}
