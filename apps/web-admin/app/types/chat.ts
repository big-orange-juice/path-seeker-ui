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
  | 'ui.route.build.progress'
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
  /** 新建/更新路线时的展示名称，可直接渲染到侧栏「当前路线」 */
  routeName?: string | null;
}

export interface ChatRouteBuildCompletePayload {
  routeId?: string | null;
  published?: boolean | null;
}

/** BuildStagesByAgent 按文物逐个生成节点时的实时进度。 */
export type ChatRouteBuildProgressStatus = 'running' | 'succeeded' | 'failed' | 'completed';

export interface ChatRouteBuildProgressPayload {
  routeId?: string | null;
  currentIndex?: number | null;
  totalCount?: number | null;
  processedCount?: number | null;
  createdCount?: number | null;
  failedCount?: number | null;
  exhibitId?: string | null;
  exhibitName?: string | null;
  /** 运行时交互类型，对齐 route_stage.interaction_type / InteractionType */
  interactionType?: number | null;
  status?: ChatRouteBuildProgressStatus | string | null;
  stageIds?: string[] | null;
  message?: string | null;
}

/**
 * 前端聚合后的节点生成进度。
 * 同一 runId + routeId 下可能有多批 BuildStagesByAgent（不同 interactionType），
 * 计数字段为跨批累计后的展示值。
 */
export interface ChatRouteBuildProgressState {
  runId: string;
  routeId: string;
  interactionType: number;
  currentIndex: number;
  /** 累计期望处理总数 */
  totalCount: number;
  /** 累计已结束处理数 */
  processedCount: number;
  /** 累计已创建节点数 */
  createdCount: number;
  failedCount: number;
  exhibitId: string | null;
  exhibitName: string | null;
  status: ChatRouteBuildProgressStatus;
  stageIds: string[];
  message: string;
  /** 当前批之前已累计的基数（用于把本批 payload 绝对计数叠到累计值） */
  batchBase: {
    totalCount: number;
    processedCount: number;
    createdCount: number;
    failedCount: number;
  };
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
  /** 展示用稳定键；同类工具合并后等于 toolName */
  id: string;
  /** 最近一次调用的 callId */
  callId: string;
  toolName: string;
  label: string;
  status: 'running' | 'done';
  /** 同类工具累计调用次数（合并展示用） */
  count: number;
  /** 尚未收到 result 的 callId，用于合并后仍能正确收口 */
  pendingCallIds: string[];
}
