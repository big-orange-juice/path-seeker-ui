export interface CreateChatSessionRequest {
  title?: string | null;
  contextRouteId?: string | null;
}

export interface ChatSendRequest {
  sessionId: string;
  clientMessageId: string;
  message: string;
}

export interface ChatSessionResponse {
  id: string | null;
  title: string | null;
  contextRouteId: string | null;
  messageCount: number;
  lastActiveAt: string | null;
  status: number;
}

export interface ChatMessageResponse {
  id: string | null;
  runId: string | null;
  sequenceNo: number;
  role: string | null;
  content: string | null;
  toolCallsJson: string | null;
  status: number;
  createdAt: string;
}

export type ChatEventType =
  | 'heartbeat'
  | 'text.delta'
  | 'tool.call.start'
  | 'tool.call.result'
  | 'ui.exhibit.selected'
  | 'ui.route.list.updated'
  | 'ui.route.detail.updated'
  | 'ui.route.stage.updated'
  | 'ui.route.build.complete'
  | 'confirmation.required'
  | 'done'
  | 'error';

export interface ChatEventResponse<T = unknown> {
  eventId: string;
  sessionId: string;
  runId: string;
  sequence: number;
  type: ChatEventType | string;
  occurredAt: string;
  payload: T;
}

export interface ChatTextDeltaPayload {
  content?: string | null;
}

export interface ChatToolCallStartPayload {
  toolName?: string | null;
  callId?: string | null;
}

export interface ChatToolCallResultPayload {
  callId?: string | null;
  result?: unknown;
}

export interface ChatDonePayload {
  assistantMessageId?: string | null;
  routeId?: string | null;
  routeVersion?: number | null;
}

export interface ChatErrorPayload {
  code?: string | null;
  message?: string | null;
}

export interface ChatConfirmationPayload {
  requiresConfirmation?: boolean;
  confirmationToken?: string | null;
  operation?: string | null;
  arguments?: Record<string, unknown> | null;
}

export interface ChatRouteListUpdatedPayload {
  routeId?: string | null;
}

export interface ChatRouteBuildCompletePayload {
  routeId?: string | null;
  published?: boolean | null;
}

export interface ChatRouteDetailPayload {
  id?: string | null;
  title?: string | null;
  theme?: string | null;
  status?: number | null;
  [key: string]: unknown;
}

export interface ChatExhibitSummary {
  id?: string | null;
  name?: string | null;
  dynasty?: string | null;
  category?: string | null;
  exhibitCode?: string | null;
  [key: string]: unknown;
}

/** 搜索列表项：后端常用 exhibitId，文档示例用 id。 */
export interface ChatExhibitListItem {
  id?: string | null;
  exhibitId?: string | null;
  name?: string | null;
  dynasty?: string | null;
  category?: string | null;
  exhibitCode?: string | null;
  [key: string]: unknown;
}

/**
 * ui.exhibit.selected 的 payload 兼容形态：
 * - 文物数组
 * - { exhibits, query?, count? } 搜索结果
 * - { exhibit, archive? } 单件详情
 * - 单文物对象
 */
export type ChatExhibitSelectedPayload =
  | ChatExhibitListItem[]
  | {
      exhibits?: ChatExhibitListItem[] | null;
      query?: string | null;
      count?: number | null;
      exhibit?: ChatExhibitListItem | null;
      archive?: Record<string, unknown> | null;
      id?: string | null;
      exhibitId?: string | null;
      name?: string | null;
      [key: string]: unknown;
    };

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessageStatus = 'pending' | 'streaming' | 'completed' | 'failed';

export type ChatRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'unknown';

export interface ChatUiMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  clientMessageId?: string;
  runId?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface ChatToolActivity {
  callId: string;
  toolName: string;
  label: string;
  status: 'running' | 'done';
}
