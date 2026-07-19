/** C 端展品问答 ExhibitChat — 对齐 schema ExhibitChat* */

export interface CreateExhibitChatSessionRequest {
  title?: string | null
}

export interface ExhibitChatSendRequest {
  sessionId: string
  clientMessageId: string
  message: string
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
  | "done"
  | "error"
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

export interface ExhibitChatDonePayload {
  assistantMessageId?: string | null
  sources?: ExhibitChatSource[] | null
}

export interface ExhibitChatErrorPayload {
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
}
