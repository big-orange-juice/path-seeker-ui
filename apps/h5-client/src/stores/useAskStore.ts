import { computed, shallowRef } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  buildExhibitChatSendHeaders,
  buildExhibitChatSendUrl,
  createExhibitChatSession,
  fetchExhibitChatHistory,
} from "@/services/exhibitChat"
import { resolveRequestErrorMessage } from "@/services/http"
import { useMissionStore } from "@/stores/useMissionStore"
import type {
  AskUiMessage,
  ExhibitChatDonePayload,
  ExhibitChatErrorPayload,
  ExhibitChatEvent,
  ExhibitChatSource,
  ExhibitChatTextDeltaPayload,
} from "@/types/exhibitChat"
import { parseExhibitChatEventData } from "@/utils/exhibitChatEvent"
import { createSseParser } from "@/utils/sse"

export type AskAttachmentKind = "mission" | "chapter" | "artifact"

export interface AskAttachment {
  kind: AskAttachmentKind
  title: string
  subtitle?: string
  routeId?: string
  chapterId?: string
}

/** @deprecated 使用 AskUiMessage */
export type AskMessage = {
  role: "user" | "bot" | "assistant"
  text: string
}

function createLocalMessage(
  role: AskUiMessage["role"],
  content: string,
  status: AskUiMessage["status"],
  extra?: Partial<AskUiMessage>,
): AskUiMessage {
  return {
    id: crypto.randomUUID(),
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

function buildWireMessage(userText: string, attachment: AskAttachment | null) {
  if (!attachment) {
    return userText
  }

  const kindLabel =
    attachment.kind === "artifact" ? "展品" : attachment.kind === "chapter" ? "站点" : "路线"
  const bits = [
    `当前关注${kindLabel}：${attachment.title}`,
    attachment.subtitle ? `位置/说明：${attachment.subtitle}` : "",
  ].filter(Boolean)

  return `${bits.join("；")}\n用户提问：${userText}`
}

export const useAskStore = defineStore("ask", () => {
  const open = shallowRef(false)
  const typing = shallowRef(false)
  const attachment = shallowRef<AskAttachment | null>(null)
  /**
   * 用户主动点「去掉附带」后为 true。
   * 浮层 ↔ 全屏切换时不得自动补回；仅 FAB 等「重新打开」且未 keepAttachment 时重置。
   */
  const attachmentDismissed = shallowRef(false)
  const messages = shallowRef<AskUiMessage[]>([])
  const sessionId = shallowRef("")
  const lastEventId = shallowRef("")
  const errorMessage = shallowRef("")
  const historyPending = shallowRef(false)

  let abortController: AbortController | null = null
  let activeAssistantId = ""

  const hasMessages = computed(() => messages.value.length > 0)
  const isRunning = computed(() => typing.value)

  /**
   * 按当前路由 / 进行中任务推断附带上下文（优先级从高到低）：
   * 1. `/missions/:routeId/chapters/:chapterId` 且站点已识别并有展品 → artifact
   * 2. 同上路径有章节 → chapter
   * 3. `/missions/:routeId` 有任务 → mission
   * 4. 否则若有 activeSession → mission
   * 5. 都没有 → null（不带附件）
   */
  function buildAttachmentFromContext(routePath = ""): AskAttachment | null {
    const missionStore = useMissionStore()
    const path = routePath || (typeof window !== "undefined" ? window.location.pathname : "")
    const missionMatch = path.match(/^\/missions\/([^/]+)(?:\/chapters\/([^/]+))?/)
    const session = missionStore.activeSession
    const activeMission = missionStore.activeMission

    if (missionMatch) {
      const routeId = decodeURIComponent(missionMatch[1])
      const chapterId = missionMatch[2] ? decodeURIComponent(missionMatch[2]) : null
      const mission = missionStore.getMission(routeId) || (activeMission?.id === routeId ? activeMission : null)

      if (chapterId && mission) {
        const chapter = mission.chapters.find((item) => item.id === chapterId)
        const progress = missionStore.getChapterProgress(chapterId)
        if (chapter && progress.recognized && chapter.artifact) {
          return {
            kind: "artifact",
            title: chapter.artifact.title || chapter.title,
            subtitle: chapter.artifact.location || chapter.targetLocation || chapter.title,
            routeId,
            chapterId,
          }
        }
        if (chapter) {
          return {
            kind: "chapter",
            title: chapter.title,
            subtitle: chapter.targetLocation || mission.title,
            routeId,
            chapterId,
          }
        }
      }

      if (mission) {
        return {
          kind: "mission",
          title: mission.title,
          subtitle: mission.theme || "探索中",
          routeId,
        }
      }
    }

    if (session) {
      return {
        kind: "mission",
        title: session.routeTitle || activeMission?.title || "当前任务",
        subtitle: "进行中的探索",
        routeId: session.routeId,
      }
    }

    return null
  }

  /**
   * 打开问一问浮层。
   * - `attachment` 显式传入时直接使用
   * - `keepAttachment: true`：保留当前附带（含用户已去掉的 null），用于全屏收起回浮层
   * - `autoAttach !== false` 且非 keep：按路由/任务重建附带（FAB「问」），并清除 dismissed
   * - `autoAttach: false`：不改动附带
   */
  function openAsk(options: {
    autoAttach?: boolean
    keepAttachment?: boolean
    attachment?: AskAttachment | null
    path?: string
  } = {}) {
    const autoAttach = options.autoAttach !== false

    if (options.attachment !== undefined) {
      attachment.value = options.attachment
      attachmentDismissed.value = options.attachment == null
    } else if (options.keepAttachment) {
      // 浮层/全屏切换：完全保留 attachment + dismissed
    } else if (autoAttach) {
      // FAB 等重新打开：按当前上下文刷新附带
      attachment.value = buildAttachmentFromContext(options.path)
      attachmentDismissed.value = false
    }

    open.value = true
    void ensureSession()
  }

  function closeAsk() {
    open.value = false
  }

  function clearAttachment() {
    attachment.value = null
    attachmentDismissed.value = true
  }

  function setAttachment(next: AskAttachment | null) {
    attachment.value = next
    // 外部显式写入非空附带时视为重新接受；写入 null 等同去掉
    attachmentDismissed.value = next == null
  }

  /**
   * 全屏页等场景：仅在尚未附带、且用户未主动去掉时补一次上下文。
   * 避免「已去掉 → 放大全屏」把附件又补回来。
   */
  function ensureAttachmentFromContext(routePath = "") {
    if (attachment.value || attachmentDismissed.value) {
      return attachment.value
    }
    attachment.value = buildAttachmentFromContext(routePath)
    return attachment.value
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
      title: seedTitle?.slice(0, 256) || attachment.value?.title || "馆内问答",
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

    errorMessage.value = ""
    typing.value = true

    const clientMessageId = crypto.randomUUID()
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
          message: buildWireMessage(trimmed, attachment.value),
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
    attachment,
    attachmentDismissed,
    messages,
    sessionId,
    errorMessage,
    historyPending,
    hasMessages,
    isRunning,
    openAsk,
    closeAsk,
    clearAttachment,
    setAttachment,
    buildAttachmentFromContext,
    ensureAttachmentFromContext,
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
