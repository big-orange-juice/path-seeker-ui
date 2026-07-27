import { computed, shallowRef } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { v4 as uuidv4 } from "uuid"
import {
  buildExhibitChatSendHeaders,
  buildExhibitChatSendUrl,
  createExhibitChatSession,
  fetchExhibitChatHistory,
} from "@/services/exhibitChat"
import { resolveRequestErrorMessage } from "@/services/http"
import type {
  AskUiMessage,
  ExhibitChatDonePayload,
  ExhibitChatErrorPayload,
  ExhibitChatEvent,
  ExhibitChatSource,
  ExhibitChatSuggestionsPayload,
  ExhibitChatTextDeltaPayload,
} from "@/types/exhibitChat"
import { parseExhibitChatEventData } from "@/utils/exhibitChatEvent"
import { createSseParser } from "@/utils/sse"

/** 问一问交互模式：默认文字；语音模式仍打字输入，叠加 TTS 播报 */
export type AskInteractionMode = "text" | "voice"

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
    "【上下文】",
    `routeId: ${routeId || "—"}`,
    `stageId: ${stageId || "—"}`,
    "",
    "【用户指令】",
    instruction,
  ].join("\n")
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

  let abortController: AbortController | null = null
  let activeAssistantId = ""

  const hasMessages = computed(() => messages.value.length > 0)
  const isRunning = computed(() => typing.value)
  const isVoiceMode = computed(() => interactionMode.value === "voice")
  const hasStageContext = computed(() => {
    const ctx = stageContext.value
    if (!ctx) return false
    return Boolean(String(ctx.routeId || "").trim() || String(ctx.stageId || "").trim())
  })

  function setInteractionMode(mode: AskInteractionMode) {
    interactionMode.value = mode === "voice" ? "voice" : "text"
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
      title: seedTitle?.slice(0, 256) || "馆内问答",
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

      messages.value = history.map((item) =>
        createLocalMessage(
          mapHistoryRole(item.role),
          item.content,
          "completed",
          {
            id: item.id,
            runId: item.runId || undefined,
            sources: item.sources,
            createdAt: item.createdAt ? Date.parse(item.createdAt) || Date.now() : Date.now(),
          },
        ),
      )
    } catch (error) {
      errorMessage.value = resolveRequestErrorMessage(error, "历史消息加载失败。")
    } finally {
      historyPending.value = false
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

      case "text.delta": {
        const payload = event.payload as ExhibitChatTextDeltaPayload
        const content = String(payload?.content ?? "")
        if (content) {
          appendAssistantDelta(content)
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

      if (!event.type && rawEvent.event) {
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
    typing.value = true

    const clientMessageId = uuidv4()
    const userMessage = createLocalMessage("user", trimmed, "completed", { clientMessageId })
    const assistantMessage = createLocalMessage("assistant", "", "pending")
    activeAssistantId = assistantMessage.id
    messages.value = [...messages.value, userMessage, assistantMessage]

    abortController = new AbortController()

    try {
      const ensuredSessionId = await ensureSession(trimmed)
      const response = await fetch(buildExhibitChatSendUrl(), {
        method: "POST",
        headers: buildExhibitChatSendHeaders(lastEventId.value),
        body: JSON.stringify({
          sessionId: ensuredSessionId,
          clientMessageId,
          message: payloadMessage,
        }),
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
        updateMessage(assistantMessage.id, {
          status: "failed",
          errorMessage: "已取消发送。",
        })
        return
      }

      const detail = resolveRequestErrorMessage(error, "发送失败，请稍后重试。")
      typing.value = false
      errorMessage.value = detail
      updateMessage(assistantMessage.id, {
        status: "failed",
        errorMessage: detail,
      })
    } finally {
      abortController = null
      if (activeAssistantId === assistantMessage.id) {
        activeAssistantId = ""
      }
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
    await send(lastUser.content)
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
  }

  function resetConversation() {
    abortActiveRun()
    sessionId.value = ""
    messages.value = []
    lastEventId.value = ""
    errorMessage.value = ""
    typing.value = false
    activeAssistantId = ""
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
    hasStageContext,
    hasMessages,
    isRunning,
    isVoiceMode,
    setInteractionMode,
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
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAskStore, import.meta.hot))
}
