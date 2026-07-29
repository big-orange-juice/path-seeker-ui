import { computed, watch, type Ref } from "vue"
import { storeToRefs } from "pinia"
import {
  extractAskUserInstruction,
  useAskStore,
  type AskInteractionMode,
} from "@/stores/useAskStore"
import type { AskUiMessage } from "@/types/exhibitChat"

/**
 * 语音模式 UI：字幕、相位、停播 / 解锁。
 * 音频由后端 send-with-audio 经 SSE 下发，在 askStore 内组装并播放。
 */
export function useAskSpeech() {
  const askStore = useAskStore()
  const {
    interactionMode,
    messages,
    typing,
    sseAudioStatus,
    sseAudioError,
    audioErrorMessage,
    isSseAudioBusy,
  } = storeToRefs(askStore)

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
        return extractAskUserInstruction(msg.content)
      }
    }
    return ""
  })

  const captionText = computed(() => liveAssistant.value?.content || "")

  const voicePhase = computed<"idle" | "thinking" | "speaking">(() => {
    if (isSseAudioBusy.value) {
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

  const speakError = computed(() => {
    const audioErr = String(audioErrorMessage.value || "").trim()
    if (audioErr) {
      return audioErr
    }
    return String(sseAudioError.value || "").trim()
  })

  watch(interactionMode, (mode, prev) => {
    if (mode === "voice") {
      askStore.unlockSseAudio()
      return
    }
    if (prev === "voice" && mode === "text") {
      askStore.stopSseAudio()
    }
  })

  function stopSpeaking() {
    askStore.stopSseAudio()
  }

  function unlock() {
    askStore.unlockSseAudio()
  }

  function dispose() {
    // 不 stopSseAudio：浮层 / 全页 AskPanel 切换会 unmount，播放由 store 管理
  }

  return {
    interactionMode: interactionMode as Ref<AskInteractionMode>,
    voicePhase,
    lastUserText,
    captionText,
    speakStatus: sseAudioStatus,
    speakError,
    speakCurrentText: captionText,
    isSpeaking: isSseAudioBusy,
    unlock,
    stopSpeaking,
    dispose,
  }
}
