import { computed, shallowRef } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { useMissionStore } from "@/stores/useMissionStore"

export type AskAttachmentKind = "mission" | "chapter" | "artifact"

export interface AskAttachment {
  kind: AskAttachmentKind
  title: string
  subtitle?: string
  routeId?: string
  chapterId?: string
}

export interface AskMessage {
  role: "user" | "bot"
  text: string
}

function buildReply(userText: string, attachment: AskAttachment | null) {
  const q = userText.trim()
  if (!q) {
    return "你想了解哪一件展品？"
  }

  if (/在哪|位置|怎么走|去哪/.test(q)) {
    if (attachment?.subtitle) {
      return `可以先去「${attachment.subtitle}」附近看看。慢慢找，不用着急。`
    }
    return "打开路线页，选一站，会告诉你大概在哪个展区。"
  }

  if (/是什么|讲讲|介绍|故事|为什么/.test(q)) {
    if (attachment?.kind === "artifact") {
      return `「${attachment.title}」值得靠近一点看细节。光线好的时候，纹样会更清楚。你也可以问我纹样、材质或年代。`
    }
    if (attachment?.title) {
      return `关于「${attachment.title}」，你更想听故事、找位置，还是解题小提示？`
    }
    return "你可以先选一条路线，或者告诉我展品的名字。"
  }

  if (/答案|怎么答|提示|不会|帮我/.test(q)) {
    return "我不直接说答案。你可以先观察形状、纹样和说明牌，卡住时再问我「看哪里」。"
  }

  if (/你好|嗨|hello/i.test(q)) {
    return "你好呀。想找展品、听故事，或问这一站该怎么走，都可以跟我说。"
  }

  if (attachment?.kind === "artifact") {
    return `我们正聊着「${attachment.title}」。你可以问它在哪、有什么特别之处，或这一站该注意什么。`
  }

  if (attachment?.title) {
    return `当前是「${attachment.title}」。你想问位置、观察重点，还是展品背后的小故事？`
  }

  return "可以说得具体一点，比如「青铜鼎在哪」或「联珠纹是什么」。"
}

export const useAskStore = defineStore("ask", () => {
  const open = shallowRef(false)
  const typing = shallowRef(false)
  const attachment = shallowRef<AskAttachment | null>(null)
  const messages = shallowRef<AskMessage[]>([])

  const hasMessages = computed(() => messages.value.length > 0)

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

  function openAsk(options: {
    autoAttach?: boolean
    keepAttachment?: boolean
    attachment?: AskAttachment | null
    path?: string
  } = {}) {
    const autoAttach = options.autoAttach !== false
    if (options.attachment !== undefined) {
      attachment.value = options.attachment
    } else if (autoAttach && !options.keepAttachment) {
      attachment.value = buildAttachmentFromContext(options.path)
    } else if (autoAttach && !attachment.value) {
      attachment.value = buildAttachmentFromContext(options.path)
    }
    open.value = true
  }

  function closeAsk() {
    open.value = false
  }

  function clearAttachment() {
    attachment.value = null
  }

  function setAttachment(next: AskAttachment | null) {
    attachment.value = next
  }

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || typing.value) {
      return
    }

    messages.value = [...messages.value, { role: "user", text: trimmed }]
    typing.value = true

    const delay = 480 + Math.random() * 420
    window.setTimeout(() => {
      messages.value = [
        ...messages.value,
        { role: "bot", text: buildReply(trimmed, attachment.value) },
      ]
      typing.value = false
    }, delay)
  }

  return {
    open,
    typing,
    attachment,
    messages,
    hasMessages,
    openAsk,
    closeAsk,
    clearAttachment,
    setAttachment,
    buildAttachmentFromContext,
    send,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAskStore, import.meta.hot))
}
