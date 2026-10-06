/**
 * 平台助手（设计文档 §8）前后端契约类型。
 *
 * 唯一权威来源：CulturalTourismSystem.WebApi/Controllers/PlatformAssistantController.cs
 * 与 CulturalTourismSystem.Model/Request|Response/PlatformAssistant*.cs。
 * 全部接口均为 [AdminOnly]，字段为 camelCase（后端 JsonSerializerDefaults.Web）。
 *
 * 会话与 SSE 事件格式与页面内 Chat 一致（同一条 ChatSessionService 事件管道），
 * 因此会话/事件类型继续复用 @/types/chat，这里只放平台助手专属类型。
 */

/** POST /api/PlatformAssistant/context —— 前端显式提交的候选值，后端一律视为"未授权候选"。 */
export interface PlatformAssistantContextRequest {
  /** 当前前端路由，仅用于提示，不参与鉴权 */
  path?: string | null;
  museumId?: string | null;
  collectionId?: string | null;
  routeId?: string | null;
  stageId?: string | null;
  guideId?: string | null;
}

/** 已核验的场馆摘要 */
export interface PlatformAssistantMuseumBrief {
  id: string;
  name: string;
  venueType: number;
}

/** 已核验的典藏（文物）摘要 */
export interface PlatformAssistantCollectionBrief {
  id: string;
  name: string;
  exhibitCode?: string | null;
  museumId?: string | null;
}

/** 已核验的路线摘要 */
export interface PlatformAssistantRouteBrief {
  id: string;
  title?: string | null;
  museumId?: string | null;
  routeType: number;
  publishStatus: number;
}

/** 已核验的路线节点摘要 */
export interface PlatformAssistantStageBrief {
  id: string;
  routeId?: string | null;
  stageNo: number;
  title?: string | null;
  interactionType: number;
}

/** 已核验的解说导游摘要 */
export interface PlatformAssistantGuideBrief {
  id: string;
  name?: string | null;
}

/** 被裁剪掉的上下文字段及原因（后端中文文案，可直接展示） */
export interface PlatformAssistantContextDrop {
  /** museumId / collectionId / routeId / stageId / guideId */
  field: string;
  providedValue?: string | null;
  reason: string;
}

/** 页面上下文核验结果 */
export interface PlatformAssistantContextResponse {
  sessionId: string;
  path?: string | null;
  museum?: PlatformAssistantMuseumBrief | null;
  collection?: PlatformAssistantCollectionBrief | null;
  route?: PlatformAssistantRouteBrief | null;
  stage?: PlatformAssistantStageBrief | null;
  guide?: PlatformAssistantGuideBrief | null;
  dropped: PlatformAssistantContextDrop[];
  verifiedAt: string;
}

/** 工具白名单条目 */
export interface PlatformAssistantToolDescriptor {
  name: string;
  description?: string | null;
  isWriteTool: boolean;
  requiresConfirmation: boolean;
}

/** GET /api/PlatformAssistant/tools */
export interface PlatformAssistantToolCatalogResponse {
  /** 平台助手总开关（PlatformAssistant:Enabled） */
  enabled: boolean;
  /** 白名单是否来自配置；false 表示使用后端内置只读默认白名单 */
  allowedToolsFromConfig: boolean;
  writeToolsEnabled: boolean;
  requireWriteConfirmation: boolean;
  tools: PlatformAssistantToolDescriptor[];
}

/** POST /api/PlatformAssistant/confirm */
export interface PlatformAssistantConfirmRequest {
  sessionId: string;
  confirmationToken: string;
}

/** 一次性写入许可结果 */
export interface PlatformAssistantConfirmResponse {
  confirmed: boolean;
  toolName?: string | null;
  expiresAt?: string | null;
  message: string;
}

/** GET /api/PlatformAssistant/manual/status */
export interface PlatformAssistantManualStatusResponse {
  configured: boolean;
  filePath?: string | null;
  fileExists: boolean;
  /** 手册版本（SHA-256 前 16 位） */
  version?: string | null;
  chapterCount: number;
  pageCount: number;
  builtAt?: string | null;
  buildDurationMs: number;
  indexAvailable: boolean;
  lastError?: string | null;
  lastErrorAt?: string | null;
  cachePath?: string | null;
}

/** 手册命中章节（出处） */
export interface PlatformAssistantManualHit {
  /** 章节序号，从 1 开始 */
  chapterIndex: number;
  chapterTitle: string;
  /** 起始页码，从 1 开始 */
  pageStart: number;
  pageEnd: number;
  score: number;
  excerpt: string;
}

/** GET /api/PlatformAssistant/manual/search */
export interface PlatformAssistantManualSearchResponse {
  query: string;
  version?: string | null;
  chapterCount: number;
  hits: PlatformAssistantManualHit[];
}

/** POST /api/PlatformAssistant/manual/ask */
export interface PlatformAssistantManualAskRequest {
  question: string;
  /** 召回章节数 1-20；缺省由后端取 PlatformAssistant:Manual:SearchTopK */
  topK?: number | null;
}

/** 手册问答结果（含出处） */
export interface PlatformAssistantManualAnswerResponse {
  question: string;
  answer: string;
  citations: PlatformAssistantManualHit[];
  /** 未检索到任何章节时为 true，答案不基于手册 */
  noManualMatch: boolean;
  version?: string | null;
  model?: string | null;
  provider?: string | null;
  durationMs: number;
}
