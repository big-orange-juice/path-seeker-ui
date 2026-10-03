import { computed, shallowRef, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { v4 as uuidv4 } from "uuid"
import {
  buildExhibitChatSendHeaders,
  buildExhibitChatSendUrl,
  buildExhibitChatSendWithAudioUrl,
  createExhibitChatSession,
  fetchExhibitChatHistory,
  mapExhibitChatLocationItems,
  mapExhibitChatSource,
} from "@/services/exhibitChat"
import { resolveRequestErrorMessage } from "@/services/http"
import { getDefaultAskVoiceId } from "@/utils/askVoice"
import type {
  AskUiMessage,
  ExhibitChatAudioDeltaPayload,
  ExhibitChatAudioErrorPayload,
  ExhibitChatAudioStartedPayload,
  ExhibitChatDonePayload,
  ExhibitChatErrorPayload,
  ExhibitChatEvent,
  ExhibitChatLocationPayload,
  ExhibitChatSource,
  ExhibitChatSourcesPayload,
  ExhibitChatSuggestionsPayload,
  ExhibitChatTextDeltaPayload,
  ExhibitChatVoiceSendRequest,
} from "@/types/exhibitChat"
import { parseExhibitChatEventData } from "@/utils/exhibitChatEvent"
import { createSseAudioAssembler } from "@/utils/sseAudioAssembler"
import { createSseParser } from "@/utils/sse"
import {
  getSharedAskSpeechPlayer,
  type AskSpeechStatus,
} from "@/utils/askSpeechPlayer"
import { usePlaybackBargeIn } from "@/composables/usePlaybackBargeIn"

/** 问一问交互模式：默认语音；语音模式仍打字输入，音频由后端 SSE 下发 */
export type AskInteractionMode = "text" | "voice"

/** 本地持久化：仅用户选择的全局助手音色 */
export const ASK_PERSIST_KEY = "path-seeker:h5-client:ask"

/** 站点快捷问答上下文（以附件形式挂在输入区，可取消） */
export interface AskStageContext {
  routeId: string
  stageId: string
  /** 仅 UI 展示；发送仍用 routeId */
  routeTitle?: string
  /** 仅 UI 展示；发送仍用 stageId */
  stageTitle?: string
}

/** @deprecated 使用 AskUiMessage */
export type AskMessage = {
  role: "user" | "bot" | "assistant"
  text: string
}

/** 输入区附件芯片文案：路线名 · 站点名（不展示原始 id） */
export function formatStageContextChipLabel(context: AskStageContext | null | undefined) {
  if (!context) return ""
  const routeTitle = String(context.routeTitle || "").trim()
  const stageTitle = String(context.stageTitle || "").trim()
  if (routeTitle && stageTitle) return `${routeTitle} · ${stageTitle}`
  if (routeTitle) return routeTitle
  if (stageTitle) return stageTitle
  // 无标题时仍不直出 id，用中性占位
  return "当前站点"
}

const ASK_CONTEXT_MARKER = "【上下文】"
const ASK_INSTRUCTION_MARKER = "【用户指令】"

/**
 * 字幕文案清洗：去掉 Markdown 标记。
 * 句子原文里可能带 `**重点**`、链接等标记，直接显示在跟读字幕里会露出符号。
 */
export function toCaptionText(text: string) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[\s>*+-]+/gm, "")
    .replace(/[*_#>~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** 将站点上下文与用户问题拼成发给后端的完整提示词（仍传 id） */
export function buildAskMessageWithStageContext(
  userText: string,
  context: AskStageContext | null | undefined,
) {
  const instruction = userText.trim()
  if (!context) {
    return instruction
  }
  const routeId = String(context.routeId || "").trim()
  const stageId = String(context.stageId || "").trim()
  if (!routeId && !stageId) {
    return instruction
  }
  return [
    ASK_CONTEXT_MARKER,
    `routeId: ${routeId || "—"}`,
    `stageId: ${stageId || "—"}`,
    "",
    ASK_INSTRUCTION_MARKER,
    instruction,
  ].join("\n")
}

/**
 * 从服务端落库的 user content 中取出「用户指令」原文，供 UI 展示。
 * 发送链路：UI 只存 instruction；历史回读可能是整段带【上下文】的 payload。
 */
export function extractAskUserInstruction(content: string) {
  const raw = String(content || "")
  if (!raw.trim()) {
    return ""
  }

  const instructionIdx = raw.indexOf(ASK_INSTRUCTION_MARKER)
  if (instructionIdx >= 0) {
    return raw.slice(instructionIdx + ASK_INSTRUCTION_MARKER.length).trim()
  }

  // 无指令标记但以【上下文】开头：尽量去掉上下文块，避免气泡泄露 id
  const contextIdx = raw.indexOf(ASK_CONTEXT_MARKER)
  if (contextIdx >= 0) {
    const afterContext = raw.slice(contextIdx + ASK_CONTEXT_MARKER.length)
    // 去掉 routeId/stageId 行后的剩余文本
    const stripped = afterContext
      .replace(/^\s*routeId\s*:\s*.+$/im, "")
      .replace(/^\s*stageId\s*:\s*.+$/im, "")
      .trim()
    if (stripped) {
      return stripped
    }
  }

  return raw.trim()
}

function createLocalMessage(
  role: AskUiMessage["role"],
  content: string,
  status: AskUiMessage["status"],
  extra?: Partial<AskUiMessage>,
): AskUiMessage {
  return {
    id: uuidv4(),
    role,
    content,
    status,
    createdAt: Date.now(),
    ...extra,
  }
}

function mapHistoryRole(role: string): AskUiMessage["role"] {
  const normalized = role.toLowerCase()
  if (normalized === "user" || normalized === "human") {
    return "user"
  }
  return "assistant"
}

export const useAskStore = defineStore("ask", () => {
  const open = shallowRef(false)
  const typing = shallowRef(false)
  /** 默认语音模式；浮层与全页共用 */
  const interactionMode = shallowRef<AskInteractionMode>("voice")
  const messages = shallowRef<AskUiMessage[]>([])
  const sessionId = shallowRef("")
  const lastEventId = shallowRef("")
  const errorMessage = shallowRef("")
  const historyPending = shallowRef(false)
  /** 站点快捷问答附件上下文，可取消 */
  const stageContext = shallowRef<AskStageContext | null>(null)
  /**
   * 用户选定的全局语音助手音色（导游 providerVoiceId）。
   * 空字符串表示未设置，发送时回落到 env / 内置默认音色。
   * 仅此字段本地持久化；会话消息不落盘。
   */
  const voiceId = shallowRef("")
  /** 本轮是否走 send-with-audio（语音模式） */
  const sseAudioEnabled = shallowRef(false)
  /** SSE 音频播放状态，供语音 UI 展示 */
  const sseAudioStatus = shallowRef<AskSpeechStatus>("idle")
  const sseAudioError = shallowRef("")
  /** 服务端 audio.error 文案（文字仍继续） */
  const audioErrorMessage = shallowRef("")
  /** 正在朗读的短句序号与句内进度，用于字幕跟读 */
  const speakingIndex = shallowRef<number | null>(null)
  const speakingProgress = shallowRef(0)

  let abortController: AbortController | null = null
  let activeAssistantId = ""
  /** 本轮 SSE 音频短句组装器；仅 enableAudio 时使用 */
  let audioAssembler = createSseAudioAssembler()
  const speechPlayer = getSharedAskSpeechPlayer()
  let unsubscribeAudio: (() => void) | null = null
  /** 已切分好的短句数，决定下一句的序号 */
  let sentenceCount = 0
  /** 当前这一句已收到的正文；遇到音频 isFinal 才收口 */
  let pendingSentenceText = ""
  /** 本轮是被「说话打断」中止的，而不是用户取消 */
  let bargeInAborted = false

  const bargeIn = usePlaybackBargeIn({ onBargeIn: () => interruptRun() })

  function syncSpeechAudioUi() {
    sseAudioStatus.value = speechPlayer.getStatus()
    sseAudioError.value = speechPlayer.getError()
    const progress = speechPlayer.getProgress()
    speakingIndex.value = progress.index
    speakingProgress.value = progress.progress
  }

  if (!unsubscribeAudio) {
    unsubscribeAudio = speechPlayer.subscribe(syncSpeechAudioUi)
  }

  /** 正在朗读（或刚朗读过）的那条助手消息，字幕从它身上取 */
  const speechMessage = computed(() => {
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const item = messages.value[index]
      if (item?.role === "assistant" && item.sentences?.length) {
        return item
      }
    }
    return null
  })

  /** 当前朗读中的短句原文；没有在播时为空 */
  const speakingSentence = computed(() => {
    const index = speakingIndex.value
    if (index === null || index < 0) {
      return ""
    }
    return String(speechMessage.value?.sentences?.[index] ?? "")
  })

  const hasMessages = computed(() => messages.value.length > 0)
  const isRunning = computed(() => typing.value)
  const isVoiceMode = computed(() => interactionMode.value === "voice")
  const hasCustomVoiceId = computed(() => Boolean(String(voiceId.value || "").trim()))
  const isSseAudioBusy = computed(
    () => sseAudioStatus.value === "loading" || sseAudioStatus.value === "speaking",
  )
  const hasStageContext = computed(() => {
    const ctx = stageContext.value
    if (!ctx) return false
    return Boolean(String(ctx.routeId || "").trim() || String(ctx.stageId || "").trim())
  })

  /** 最终发给 send-with-audio 的 voiceId：用户偏好 > env / 内置默认 */
  function resolveSendVoiceId() {
    const preferred = String(voiceId.value || "").trim()
    if (preferred) {
      return preferred
    }
    return getDefaultAskVoiceId()
  }

  /** 本轮音频与短句切分全部归零 */
  function resetSentenceTracking() {
    sentenceCount = 0
    pendingSentenceText = ""
  }

  /**
   * 收口一句：把累计的正文按序号记到消息上，并把同一序号的音频交给播放器。
   * 序号由 SSE 的句子顺序决定，正文与音频因此能一一对应。
   */
  function closeSentence(blob: Blob | null) {
    const text = toCaptionText(pendingSentenceText)
    pendingSentenceText = ""
    if (!text && !blob) {
      return
    }

    const index = sentenceCount
    sentenceCount += 1

    if (activeAssistantId) {
      const target = messages.value.find((item) => item.id === activeAssistantId)
      updateMessage(activeAssistantId, {
        sentences: [...(target?.sentences ?? []), text],
      })
    }

    speechPlayer.enqueue(index, blob)
  }

  function resetSseAudioPipeline(runKey?: string) {
    audioAssembler = createSseAudioAssembler()
    audioErrorMessage.value = ""
    resetSentenceTracking()
    if (runKey) {
      speechPlayer.beginRun()
    } else {
      speechPlayer.stop()
    }
    syncSpeechAudioUi()
  }

  function stopSseAudio() {
    speechPlayer.stop()
    audioAssembler = createSseAudioAssembler()
    syncSpeechAudioUi()
  }

  function unlockSseAudio() {
    speechPlayer.unlock()
  }

  /**
   * 说话打断：立刻停播并中止本轮 SSE。
   * 正文保留半截，标记为 interrupted 而不是失败——用户是「不想听了」，不是出错了。
   */
  function interruptRun() {
    if (!activeAssistantId && !typing.value) {
      return
    }
    const targetId = activeAssistantId
    bargeInAborted = true
    speechPlayer.stop()
    abortActiveRun()
    typing.value = false
    if (targetId) {
      updateMessage(targetId, { status: "completed", interrupted: true })
      activeAssistantId = ""
    }
    sseAudioEnabled.value = false
    syncSpeechAudioUi()
  }

  /** 语音模式下按可朗读短句切分；文字模式仍是原始流式文本 */
  function appendSentenceDelta(content: string) {
    if (!sseAudioEnabled.value) {
      return
    }
    pendingSentenceText += content
  }

  /** 在用户手势里申请麦克风；成功后若正在播则立即进入监听 */
  async function armBargeIn() {
    const ready = await bargeIn.arm()
    if (ready && isSseAudioBusy.value) {
      bargeIn.listen()
    }
    return ready
  }

  /**
   * 自动启用说话打断：只有之前授权过麦克风才自动开，
   * 避免在一次回答中间突然弹权限框；首次使用由用户点开关触发。
   */
  async function autoArmBargeIn() {
    if (!bargeIn.enabled.value || !bargeIn.supported.value) return false
    if (!(await bargeIn.hasPermission())) return false
    return armBargeIn()
  }

  function setInteractionMode(mode: AskInteractionMode) {
    interactionMode.value = mode === "voice" ? "voice" : "text"
    if (interactionMode.value !== "voice") {
      // 离开语音模式就不再听麦克风
      bargeIn.hold()
    }
  }

  /**
   * 只在「有音频在播」的窗口里消费麦克风帧。
   * 播放开始才 listen，播放结束立刻 hold，空闲时 worklet 直接丢弃音频帧。
   */
  watch(isSseAudioBusy, (busy) => {
    if (busy && bargeIn.enabled.value && interactionMode.value === "voice") {
      bargeIn.listen()
      return
    }
    bargeIn.hold()
  })

  /** 写入用户全局助手音色；空值等价于清除 */
  function setVoiceId(next: string | null | undefined) {
    voiceId.value = String(next ?? "").trim()
  }

  function clearVoiceId() {
    voiceId.value = ""
  }

  /** 当前音色是否等于给定 providerVoiceId（导游详情「已设为助手音色」） */
  function isAssistantVoice(providerVoiceId: string | null | undefined) {
    const target = String(providerVoiceId ?? "").trim()
    if (!target) return false
    return String(voiceId.value || "").trim() === target
  }

  function setStageContext(context: AskStageContext | null) {
    if (!context) {
      stageContext.value = null
      return
    }
    stageContext.value = {
      routeId: String(context.routeId || "").trim(),
      stageId: String(context.stageId || "").trim(),
      routeTitle: String(context.routeTitle || "").trim() || undefined,
      stageTitle: String(context.stageTitle || "").trim() || undefined,
    }
  }

  function clearStageContext() {
    stageContext.value = null
  }

  /** 打开问一问浮层 */
  function openAsk() {
    open.value = true
    void ensureSession()
  }

  /** 从站点页打开，并挂上 routeId/stageId 附件上下文 */
  function openAskWithStageContext(context: AskStageContext) {
    setStageContext(context)
    openAsk()
  }

  function closeAsk() {
    open.value = false
  }

  function updateMessage(id: string, patch: Partial<AskUiMessage>) {
    messages.value = messages.value.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
          }
        : item,
    )
  }

  function appendAssistantDelta(content: string) {
    if (!activeAssistantId) {
      return
    }

    const target = messages.value.find((item) => item.id === activeAssistantId)
    if (!target) {
      return
    }

    updateMessage(activeAssistantId, {
      content: `${target.content}${content}`,
      status: "streaming",
    })
  }

  function abortActiveRun() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  async function ensureSession(seedTitle?: string) {
    if (sessionId.value) {
      return sessionId.value
    }

    const created = await createExhibitChatSession({
      title: seedTitle?.slice(0, 256) || "户外问答",
    })
    sessionId.value = created.id
    return sessionId.value
  }

  async function loadHistory() {
    if (!sessionId.value || historyPending.value) {
      return
    }

    historyPending.value = true
    errorMessage.value = ""

    try {
      const history = await fetchExhibitChatHistory(sessionId.value)
      if (!history.length) {
        return
      }

      messages.value = history.map((item) => {
        const role = mapHistoryRole(item.role)
        // 历史里 user 可能是带【上下文】的完整 payload；气泡只展示用户指令
        const content =
          role === "user"
            ? extractAskUserInstruction(item.content)
            : item.content
        return createLocalMessage(
          role,
          content,
          "completed",
          {
            id: item.id,
            runId: item.runId || undefined,
            sources: item.sources,
            locations: item.locations?.length ? item.locations : undefined,
            createdAt: item.createdAt ? Date.parse(item.createdAt) || Date.now() : Date.now(),
          },
        )
      })
    } catch (error) {
      errorMessage.value = resolveRequestErrorMessage(error, "历史消息加载失败。")
    } finally {
      historyPending.value = false
    }
  }

  function handleAudioEvent(event: ExhibitChatEvent) {
    switch (event.type) {
      case "audio.started": {
        const payload = (event.payload ?? {}) as ExhibitChatAudioStartedPayload
        // 新一轮短句流水线开始：清空组装缓冲，同步音频格式并重置播放器
        audioAssembler.reset(payload)
        speechPlayer.configure(payload)
        audioErrorMessage.value = ""
        break
      }

      case "audio.delta": {
        const payload = (event.payload ?? {}) as ExhibitChatAudioDeltaPayload
        const blob = audioAssembler.pushDelta(payload)
        // isFinal 才是句子边界：即使这一句没有音频也要收口，否则序号会错位
        if (payload?.isFinal) {
          closeSentence(blob)
        }
        break
      }

      case "audio.done": {
        // 本轮服务端合成结束；播放器可能仍在播已排期的短句
        break
      }

      case "audio.error": {
        const payload = (event.payload ?? {}) as ExhibitChatAudioErrorPayload
        const detail = String(payload.message || "语音合成暂时不可用，文字回答不受影响")
        audioErrorMessage.value = detail
        // 合成失败不会再下发 isFinal，这里补一次收口，保住后续句子的序号
        closeSentence(null)
        // 文字继续；不中断 SSE
        break
      }

      default:
        break
    }
  }

  function handleEvent(event: ExhibitChatEvent) {
    if (event.eventId) {
      lastEventId.value = String(event.eventId)
    }

    switch (event.type) {
      case "heartbeat": {
        typing.value = true
        break
      }

      case "sources": {
        // 文本增量前下发；先挂来源卡，再流式补文
        const payload = (event.payload ?? {}) as ExhibitChatSourcesPayload
        const items = Array.isArray(payload.items)
          ? payload.items.map((item) => mapExhibitChatSource(item as Partial<ExhibitChatSource>))
          : []
        if (activeAssistantId && items.length) {
          updateMessage(activeAssistantId, {
            sources: items,
            status: "streaming",
          })
        }
        break
      }

      case "exhibit.location": {
        // sources 之后、text.delta 之前；位置问题才有
        const payload = (event.payload ?? {}) as ExhibitChatLocationPayload
        const locations = mapExhibitChatLocationItems(payload.items)
        if (activeAssistantId && locations.length) {
          updateMessage(activeAssistantId, {
            locations,
            status: "streaming",
          })
        }
        break
      }

      case "text.delta": {
        const payload = event.payload as ExhibitChatTextDeltaPayload
        const content = String(payload?.content ?? "")
        if (content) {
          appendAssistantDelta(content)
          appendSentenceDelta(content)
        }
        break
      }

      case "audio.started":
      case "audio.delta":
      case "audio.done":
      case "audio.error": {
        if (sseAudioEnabled.value) {
          handleAudioEvent(event)
        }
        break
      }

      case "suggestions": {
        // done 之前下发；失败时 items 为空数组，不影响主回答
        const payload = (event.payload ?? {}) as ExhibitChatSuggestionsPayload
        const items = Array.isArray(payload.items)
          ? payload.items.map((item) => String(item ?? "").trim()).filter(Boolean)
          : []

        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            suggestions: items,
          })
        }
        break
      }

      case "done": {
        const payload = (event.payload ?? {}) as ExhibitChatDonePayload
        typing.value = false
        // 收尾：把最后一句（可能没有音频）收口，并告诉播放器不会再有新句子
        closeSentence(null)
        speechPlayer.finishRun()
        if (activeAssistantId) {
          const sources = Array.isArray(payload.sources)
            ? (payload.sources as ExhibitChatSource[])
            : undefined
          updateMessage(activeAssistantId, {
            status: "completed",
            runId: String(event.runId || ""),
            ...(sources?.length ? { sources } : {}),
          })
        }
        activeAssistantId = ""
        abortController = null
        break
      }

      case "error": {
        const payload = (event.payload ?? {}) as ExhibitChatErrorPayload
        const detail = String(payload.message || "对话处理失败。")
        typing.value = false
        errorMessage.value = detail
        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            status: "failed",
            errorMessage: detail,
            runId: String(event.runId || ""),
          })
        }
        activeAssistantId = ""
        abortController = null
        stopSseAudio()
        break
      }

      default:
        break
    }
  }

  async function consumeSseStream(response: Response) {
    if (!response.body) {
      throw new Error("未收到可读的事件流。")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let terminated = false

    const parser = createSseParser((rawEvent) => {
      const event = parseExhibitChatEventData(rawEvent.data)
      if (!event) {
        return
      }

      // SSE event: 行优先（exhibit.location / sources 等）
      if (rawEvent.event) {
        event.type = rawEvent.event
      }
      if (!event.eventId && rawEvent.id) {
        event.eventId = rawEvent.id
      }

      handleEvent(event)

      if (event.type === "done" || event.type === "error") {
        terminated = true
      }
    })

    while (!terminated) {
      const { done, value } = await reader.read()
      if (done) {
        parser.end()
        break
      }
      parser.push(decoder.decode(value, { stream: true }))
    }

    if (!terminated && typing.value) {
      typing.value = false
      errorMessage.value = "连接已中断，请稍后重试。"
      if (activeAssistantId) {
        updateMessage(activeAssistantId, {
          status: "failed",
          errorMessage: errorMessage.value,
        })
        activeAssistantId = ""
      }
      stopSseAudio()
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || typing.value) {
      return
    }

    // UI 展示用户原文；发给后端时拼上站点上下文
    const payloadMessage = buildAskMessageWithStageContext(trimmed, stageContext.value)

    errorMessage.value = ""
    audioErrorMessage.value = ""
    typing.value = true

    const clientMessageId = uuidv4()
    const userMessage = createLocalMessage("user", trimmed, "completed", { clientMessageId })
    const assistantMessage = createLocalMessage("assistant", "", "pending")
    activeAssistantId = assistantMessage.id
    messages.value = [...messages.value, userMessage, assistantMessage]

    // 语音模式：走 send-with-audio，音频随 SSE 下发；文字模式仍用原 send
    const useAudio = interactionMode.value === "voice"
    sseAudioEnabled.value = useAudio
    bargeInAborted = false
    if (useAudio) {
      resetSseAudioPipeline(assistantMessage.id)
      // 在用户手势里解锁播放，否则默认语音模式下首轮会静音
      speechPlayer.unlock()
      void autoArmBargeIn()
    } else {
      stopSseAudio()
    }

    abortController = new AbortController()

    try {
      const ensuredSessionId = await ensureSession(trimmed)
      const url = useAudio ? buildExhibitChatSendWithAudioUrl() : buildExhibitChatSendUrl()
      const body: ExhibitChatVoiceSendRequest | {
        sessionId: string
        clientMessageId: string
        message: string
      } = useAudio
        ? {
            sessionId: ensuredSessionId,
            clientMessageId,
            message: payloadMessage,
            enableAudio: true,
            voiceId: resolveSendVoiceId(),
          }
        : {
            sessionId: ensuredSessionId,
            clientMessageId,
            message: payloadMessage,
          }

      const response = await fetch(url, {
        method: "POST",
        headers: buildExhibitChatSendHeaders(lastEventId.value),
        body: JSON.stringify(body),
        signal: abortController.signal,
      })

      if (!response.ok) {
        let detail = `请求失败（${response.status}）`
        try {
          const payload = (await response.json()) as {
            message?: string
            data?: { message?: string }
          }
          detail = payload.message || payload.data?.message || detail
        } catch {
          // ignore
        }
        throw new Error(detail)
      }

      updateMessage(assistantMessage.id, { status: "streaming" })
      await consumeSseStream(response)

      if (typing.value) {
        typing.value = false
        updateMessage(assistantMessage.id, { status: "completed" })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        typing.value = false
        if (bargeInAborted) {
          // 说话打断：正文保留半截，不算失败
          updateMessage(assistantMessage.id, { status: "completed", interrupted: true })
        } else {
          updateMessage(assistantMessage.id, {
            status: "failed",
            errorMessage: "已取消发送。",
          })
        }
        stopSseAudio()
        return
      }

      const detail = resolveRequestErrorMessage(error, "发送失败，请稍后重试。")
      typing.value = false
      errorMessage.value = detail
      updateMessage(assistantMessage.id, {
        status: "failed",
        errorMessage: detail,
      })
      stopSseAudio()
    } finally {
      abortController = null
      bargeInAborted = false
      if (activeAssistantId === assistantMessage.id) {
        activeAssistantId = ""
      }
      sseAudioEnabled.value = false
      closeSentence(null)
    }
  }

  async function retryLastFailed() {
    const lastUser = [...messages.value].reverse().find((item) => item.role === "user")
    const lastAssistant = [...messages.value].reverse().find((item) => item.role === "assistant")
    if (!lastUser || !lastAssistant || lastAssistant.status !== "failed") {
      return
    }

    const dropIds = new Set([lastUser.id, lastAssistant.id])
    messages.value = messages.value.filter((item) => !dropIds.has(item.id))
    // 只用用户指令重发；若附件上下文仍在，send 内会再拼 payload
    await send(extractAskUserInstruction(lastUser.content))
  }

  function cancelRun() {
    abortActiveRun()
    typing.value = false
    if (activeAssistantId) {
      updateMessage(activeAssistantId, {
        status: "failed",
        errorMessage: "已取消。",
      })
      activeAssistantId = ""
    }
    stopSseAudio()
    sseAudioEnabled.value = false
  }

  function resetConversation() {
    abortActiveRun()
    sessionId.value = ""
    messages.value = []
    lastEventId.value = ""
    errorMessage.value = ""
    audioErrorMessage.value = ""
    typing.value = false
    activeAssistantId = ""
    sseAudioEnabled.value = false
    bargeInAborted = false
    resetSentenceTracking()
    bargeIn.hold()
    stopSseAudio()
  }

  return {
    open,
    typing,
    interactionMode,
    messages,
    sessionId,
    errorMessage,
    historyPending,
    stageContext,
    voiceId,
    sseAudioEnabled,
    sseAudioStatus,
    sseAudioError,
    audioErrorMessage,
    speakingIndex,
    speakingProgress,
    speakingSentence,
    bargeInEnabled: bargeIn.enabled,
    bargeInSupported: bargeIn.supported,
    bargeInArmed: bargeIn.armed,
    bargeInListening: bargeIn.listening,
    bargeInPermissionDenied: bargeIn.permissionDenied,
    bargeInError: bargeIn.error,
    setBargeInEnabled: bargeIn.setEnabled,
    armBargeIn,
    autoArmBargeIn,
    interruptRun,
    hasStageContext,
    hasMessages,
    isRunning,
    isVoiceMode,
    hasCustomVoiceId,
    isSseAudioBusy,
    setInteractionMode,
    setVoiceId,
    clearVoiceId,
    isAssistantVoice,
    setStageContext,
    clearStageContext,
    openAsk,
    openAskWithStageContext,
    closeAsk,
    ensureSession,
    loadHistory,
    send,
    retryLastFailed,
    cancelRun,
    resetConversation,
    unlockSseAudio,
    stopSseAudio,
  }
}, {
  persist: {
    key: ASK_PERSIST_KEY,
    pick: ["voiceId"],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAskStore, import.meta.hot))
}
