import { computed, watch, type Ref, type WatchStopHandle } from "vue"
import { storeToRefs } from "pinia"
import { useSpeakQueue } from "@/composables/useSpeakQueue"
import { isMiniMaxTtsConfigured } from "@/services/minimaxTts"
import {
  extractAskUserInstruction,
  useAskStore,
  type AskInteractionMode,
} from "@/stores/useAskStore"
import { pullSpeakableSentences } from "@/utils/sentenceSplit"
import type { AskUiMessage } from "@/types/exhibitChat"

/**
 * 语音模式下：订阅 Ask 流式 assistant 文本 → 句切分 → TTS 队列。
 * 仅朗读「进入语音模式之后」产生的新 run，不回放历史。
 *
 * 注意：speechRunKey 必须用本地 message.id，不能用服务端 runId。
 * done 事件才会写入 runId，若中途切换 key 会 cancel 队列导致丢句（含最后一句）。
 */
export function useAskSpeech() {
  const askStore = useAskStore()
  const { interactionMode, messages, typing } = storeToRefs(askStore)
  const speak = useSpeakQueue()

  let buffer = ""
  let trackedMessageId = ""
  let trackedContentLength = 0
  let lastFlushedMessageId = ""
  /** 仅追踪这些消息的增量（进入 voice 后新出现的 pending/streaming） */
  let activeSpeechMessageId = ""

  const liveAssistant = computed(() => {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const msg = messages.value[i]
      if (!msg || msg.role !== "assistant") {
        continue
      }
      if (msg.status === "pending" || msg.status === "streaming" || msg.status === "completed") {
        return msg
      }
    }
    return null as AskUiMessage | null
  })

  const lastUserText = computed(() => {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const msg = messages.value[i]
      if (msg?.role === "user" && msg.content) {
        // 语音字幕同样不展示【上下文】/routeId
        return extractAskUserInstruction(msg.content)
      }
    }
    return ""
  })

  const captionText = computed(() => {
    const live = liveAssistant.value
    if (live?.content) {
      return live.content
    }
    return speak.currentText.value || ""
  })

  const voicePhase = computed<"idle" | "thinking" | "speaking">(() => {
    if (speak.isBusy.value) {
      return "speaking"
    }
    if (typing.value) {
      return "thinking"
    }
    const live = liveAssistant.value
    if (live && (live.status === "pending" || live.status === "streaming")) {
      return "thinking"
    }
    return "idle"
  })

  function resetTracker() {
    buffer = ""
    trackedMessageId = ""
    trackedContentLength = 0
    lastFlushedMessageId = ""
    activeSpeechMessageId = ""
  }

  /** 队列 run 键：固定本地消息 id，避免 done 写入服务端 runId 后整队被 cancel */
  function speechRunKey(msg: AskUiMessage) {
    return msg.id
  }

  function enqueueSentences(sentences: string[], runKey: string) {
    for (const sentence of sentences) {
      speak.enqueue(sentence, runKey)
    }
  }

  /**
   * 忽略历史/切入语音前已存在的完成消息；
   * 仅当消息处于 pending/streaming，或已登记为 activeSpeechMessageId 时才朗读。
   */
  function shouldFollow(msg: AskUiMessage): boolean {
    if (msg.status === "pending" || msg.status === "streaming") {
      return true
    }
    if (msg.status === "completed" && msg.id === activeSpeechMessageId) {
      return true
    }
    return false
  }

  function processAssistant(msg: AskUiMessage | null, mode: AskInteractionMode) {
    if (mode !== "voice") {
      return
    }
    if (!msg || !shouldFollow(msg)) {
      return
    }

    const runKey = speechRunKey(msg)

    if (msg.status === "pending" || msg.status === "streaming") {
      activeSpeechMessageId = msg.id
    }

    if (msg.id !== trackedMessageId) {
      buffer = ""
      trackedMessageId = msg.id
      trackedContentLength = 0
      speak.bindRun(runKey)
    }

    const content = msg.content || ""
    if (content.length < trackedContentLength) {
      // 内容被重置（重试等）
      buffer = content
      trackedContentLength = content.length
      lastFlushedMessageId = ""
    } else if (content.length > trackedContentLength) {
      buffer += content.slice(trackedContentLength)
      trackedContentLength = content.length
    }

    const shouldFlush = msg.status === "completed" || msg.status === "failed"

    // 已对同一消息 flush 过且无新缓冲，跳过
    if (shouldFlush && lastFlushedMessageId === msg.id && !buffer.trim()) {
      return
    }

    const { sentences, rest } = pullSpeakableSentences(buffer, { flush: shouldFlush })
    buffer = shouldFlush ? "" : rest

    if (sentences.length) {
      enqueueSentences(sentences, runKey)
    }

    if (shouldFlush) {
      lastFlushedMessageId = msg.id
      // 防御：flush 后若 strip 后为空仍清 buffer
      buffer = ""
      if (msg.status === "failed") {
        activeSpeechMessageId = ""
      }
    }
  }

  const stopWatch: WatchStopHandle = watch(
    [interactionMode, liveAssistant, typing, messages] as const,
    ([mode, assistant]) => {
      if (mode !== "voice") {
        return
      }
      if (!isMiniMaxTtsConfigured()) {
        return
      }
      processAssistant(assistant, mode)
    },
    { flush: "post" },
  )

  watch(interactionMode, (mode, prev) => {
    if (mode === "voice") {
      speak.unlock()
      // 切入语音：不回放历史；若此刻正在流式生成，从当前长度之后跟增量
      const live = liveAssistant.value
      if (live && (live.status === "pending" || live.status === "streaming")) {
        activeSpeechMessageId = live.id
        trackedMessageId = live.id
        trackedContentLength = live.content.length
        buffer = ""
        lastFlushedMessageId = ""
        speak.bindRun(speechRunKey(live))
      } else {
        resetTracker()
        speak.cancel()
      }
      return
    }

    if (prev === "voice" && mode === "text") {
      speak.cancel()
      resetTracker()
    }
  })

  function stopSpeaking() {
    speak.cancel()
    buffer = ""
    const live = liveAssistant.value
    if (live) {
      trackedMessageId = live.id
      trackedContentLength = live.content.length
      if (live.status === "completed" || live.status === "failed") {
        lastFlushedMessageId = live.id
        activeSpeechMessageId = ""
      } else {
        // 仍在生成：后续增量继续读
        activeSpeechMessageId = live.id
        lastFlushedMessageId = ""
      }
    }
  }

  function dispose() {
    stopWatch()
    speak.cancel()
    resetTracker()
  }

  return {
    interactionMode: interactionMode as Ref<AskInteractionMode>,
    voicePhase,
    lastUserText,
    captionText,
    speakStatus: speak.status,
    speakError: speak.errorMessage,
    speakCurrentText: speak.currentText,
    isSpeaking: speak.isBusy,
    unlock: speak.unlock,
    stopSpeaking,
    dispose,
  }
}
