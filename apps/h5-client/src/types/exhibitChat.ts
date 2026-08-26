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

/** 与 exhibit.location / 历史 locations 快照对齐 */
export type ExhibitChatLocationStatus =
  | "located"
  | "multiple_locations"
  | "gallery_only"
  | "map_unavailable"
  | "unbound"
  | string

export interface ExhibitChatLocationPoint {
  pointId: string | null
  title: string | null
  xPercent: number
  yPercent: number
}

export interface ExhibitChatLocationMap {
  mapId: string | null
  mapImageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  coordinateType: number | null
  contentHash: string | null
  points: ExhibitChatLocationPoint[]
}

export interface ExhibitChatLocationGallery {
  galleryId: string | null
  galleryName: string | null
  floorId: string | null
  floorName: string | null
  floorLevel: number | null
}

export interface ExhibitChatLocationArea {
  id: string | null
  name: string | null
  areaType: number | null
}

export interface ExhibitChatOutdoorLocation {
  id: string | null
  locationType: number
  longitude: number | null
  latitude: number | null
  coordinateSystem: number
  locationName: string | null
  entranceName: string | null
  isPrimary: number
  geometryGeoJson: string | null
}

/** 单条文物位置快照（SSE items[] / history locations[]） */
export interface ExhibitChatLocationItem {
  exhibitId: string | null
  exhibitName: string | null
  showcaseNo: string | null
  status: ExhibitChatLocationStatus
  gallery: ExhibitChatLocationGallery | null
  maps: ExhibitChatLocationMap[]
  assetType: number | null
  assetTypeName: string | null
  siteArea: ExhibitChatLocationArea | null
  outdoorLocations: ExhibitChatOutdoorLocation[]
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
  /** 该轮回答使用的位置快照；无位置问题时为空数组 */
  locations: ExhibitChatLocationItem[]
  createdAt: string | null
}

export type ExhibitChatEventType =
  | "heartbeat"
  | "sources"
  | "exhibit.location"
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

export interface ExhibitChatSourcesPayload {
  items?: ExhibitChatSource[] | null
}

export interface ExhibitChatLocationPayload {
  intent?: string | null
  items?: ExhibitChatLocationItem[] | null
}

export interface ExhibitChatDonePayload {
  assistantMessageId?: string | null
  sources?: ExhibitChatSource[] | null
  sourceCount?: number | null
  locationCount?: number | null
  hasLocation?: boolean | null
  refused?: boolean | null
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
  /** 本轮位置快照（SSE exhibit.location / 历史 locations） */
  locations?: ExhibitChatLocationItem[]
  /** 本轮 done 前下发的后续建议，以 chip 展示 */
  suggestions?: string[]
}
