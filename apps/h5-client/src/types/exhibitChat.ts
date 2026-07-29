/** C 端展品问答 ExhibitChat — 对齐 schema ExhibitChat* */

export interface CreateExhibitChatSessionRequest {
  title?: string | null
}

export interface ExhibitChatSendRequest {
  sessionId: string
  clientMessageId: string
  message: string
}

/** POST /ExhibitChat/send-with-audio — 对齐 schema ExhibitChatVoiceSendRequest */
export interface ExhibitChatVoiceSendRequest {
  sessionId: string
  clientMessageId: string
  message: string
  /** true 时 SSE 额外下发 audio.* 事件 */
  enableAudio: boolean
  /** enableAudio=true 时必填：系统音色或账号可用音色 */
  voiceId?: string | null
}

export interface ExhibitChatSource {
  exhibitId: string | null
  name: string | null
  formalName: string | null
  imageUrl: string | null
}

export interface ExhibitChatSession {
  id: string
  museumId: string | null
  title: string
  messageCount: number
  lastActiveAt: string | null
  status: number
}

export interface ExhibitChatMessage {
  id: string
  runId: string | null
  sequenceNo: string | null
  role: string
  content: string
  status: number
  sources: ExhibitChatSource[]
  createdAt: string | null
}

export type ExhibitChatEventType =
  | "heartbeat"
  | "text.delta"
  | "tool.call.start"
  | "tool.call.result"
  | "suggestions"
  | "done"
  | "error"
  | "audio.started"
  | "audio.delta"
  | "audio.done"
  | "audio.error"
  | string

export interface ExhibitChatEvent<T = unknown> {
  eventId: string
  sessionId: string
  runId: string
  sequence: number
  type: ExhibitChatEventType
  occurredAt: string
  payload: T
}

export interface ExhibitChatTextDeltaPayload {
  content?: string | null
}

/** SSE suggestions：本轮后续建议（2-4 条；失败时为空数组） */
export interface ExhibitChatSuggestionsPayload {
  items?: string[] | null
}

export interface ExhibitChatDonePayload {
  assistantMessageId?: string | null
  sources?: ExhibitChatSource[] | null
}

export interface ExhibitChatErrorPayload {
  code?: string | null
  message?: string | null
}

/** SSE audio.started：首段音频元数据 */
export interface ExhibitChatAudioStartedPayload {
  voiceId?: string | null
  format?: string | null
  encoding?: string | null
  sampleRate?: number | null
}

/**
 * SSE audio.delta：十六进制音频分片。
 * isFinal=true 表示当前可朗读短句合成结束（不代表整轮 AI 结束）；此时 audio 可为空。
 */
export interface ExhibitChatAudioDeltaPayload {
  audio?: string | null
  encoding?: string | null
  format?: string | null
  sampleRate?: number | null
  durationMs?: number | null
  isFinal?: boolean | null
}

/** SSE audio.done：本轮全部语音分片已从服务端返回 */
export interface ExhibitChatAudioDonePayload {
  voiceId?: string | null
}

/** SSE audio.error：合成失败；文字问答仍会继续至 done/error */
export interface ExhibitChatAudioErrorPayload {
  code?: string | null
  message?: string | null
}

export type AskMessageStatus = "pending" | "streaming" | "completed" | "failed"

export interface AskUiMessage {
  id: string
  role: "user" | "assistant"
  content: string
  status: AskMessageStatus
  createdAt: number
  clientMessageId?: string
  runId?: string
  errorMessage?: string
  sources?: ExhibitChatSource[]
  /** 本轮 done 前下发的后续建议，以 chip 展示 */
  suggestions?: string[]
}
