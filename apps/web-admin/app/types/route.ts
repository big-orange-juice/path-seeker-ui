export interface RoutePageRequest {
  pageIndex: number;
  pageSize: number;
  museumId?: string | null;
  scaleType?: number | null;
  difficultyLevel?: number | null;
  ageGroup?: number | null;
  publishStatus?: number | null;
  auditStatus?: number | null;
  /** 路线创建人姓名/用户名模糊搜索（导游账号归属） */
  ownerName?: string | null;
  keyword?: string | null;
  sceneType?: number | null;
  locale?: string | null;
  routeFamilyCode?: string | null;
}

export interface BuildRouteFromThemePayload {
  routeType: number;
  routeId: string;
  title: string;
  theme: string;
  museumId: string;
  ageGroup: number;
  themeQuery: string;
  maxNodes: number;
  pickCount: number;
  difficulty: number;
}

export interface RouteMutationPayload {
  id: string;
  publishStatus?: number;
}

export interface UpdateRouteTitlePayload {
  id: string;
  routeCode: string;
  title: string;
}

/** 手动新增路线节点；对齐 CreateRouteStageRequest */
export interface CreateRouteStagePayload {
  routeId: string;
  stageNo?: number;
  sortOrder?: number;
  title?: string | null;
  subtitle?: string | null;
  interactionType?: number;
  refPuzzleId?: string | null;
  refExhibitId?: string | null;
  unlockRule?: number;
  isRequired?: number;
  score?: number;
  config?: string | null;
  nextRule?: string | null;
}

/** 软删除路线节点；对齐 IdRequest */
export interface DeleteRouteStagePayload {
  id: string;
}

export interface RouteCardResponse {
  id: string | null;
  title: string | null;
  theme: string | null;
  coverImageUrl: string | null;
  scaleType: number;
  difficultyLevel: number;
  ageGroup: number;
  allowTeam: number;
  estimatedMinutes: number | null;
  totalScore: number;
  puzzleCount: number;
  persona: unknown | null;
}

export interface RouteStoryResponse {
  id?: string | null;
  title?: string | null;
  content?: string | null;
  sortOrder?: number | null;
  [key: string]: unknown;
}

export interface RouteNodeResponse {
  stageId: string | null;
  interactionType: number;
  puzzleId: string | null;
  refPuzzleId: string | null;
  refExhibitId: string | null;
  title: string | null;
  subtitle: string | null;
  puzzleType: number;
  scaleType: number;
  difficultyLevel: number;
  stageNo: number;
  sortOrder: number;
  score: number;
  isRequired: number;
  unlockRule: number;
  config: string | null;
  nextRule: string | null;
  exhibitName: string | null;
  galleryName: string | null;
}

export interface RouteDetailResponse {
  route: RouteCardResponse | null;
  museumId: string | null;
  intro: string | null;
  stories: RouteStoryResponse[] | null;
  nodes: RouteNodeResponse[] | null;
}

export interface RouteAdminResponseListTotalPageResult<T> {
  list: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RouteAdminResponse {
  sceneType?: number;
  locale?: string | null;
  sourceRouteId?: string | null;
  routeFamilyCode?: string | null;
  distanceMeters?: number | null;
  transportMode?: string | null;
  guideId?: string | null;
  id: string | null;
  routeCode: string | null;
  routeType: number;
  museumId: string | null;
  title: string | null;
  theme: string | null;
  coverImageUrl: string | null;
  personaId: string | null;
  scaleType: number;
  difficultyLevel: number;
  ageGroup: number;
  allowTeam: number;
  minTeamSize: number;
  maxTeamSize: number;
  estimatedMinutes: number | null;
  totalScore: number;
  puzzleCount: number;
  intro: string | null;
  rewardTitle: string | null;
  publishStatus: number;
  auditStatus: number;
  auditRemark: string | null;
  /** 是否需要管理员审核；管理员创建的路线为 false */
  auditRequired?: boolean | null;
  /** 路线归属的后台账号 ID */
  ownerId?: string | null;
  ownerName?: string | null;
  /** 当前操作者是否可以编辑该路线 */
  canEdit?: boolean | null;
  sortOrder: number;
  isGenerating?: boolean | null;
  /** 路线后台任务状态：0=空闲 1=排队中 2=执行中 3=等待重试 */
  taskStatus?: number | null;
  taskStatusText?: string | null;
  /**
   * 生成进度 0–100。
   * 列表接口可能直接返回；未返回时由前端用 TaskStatus 聚合补齐。
   */
  progressPercent?: number | null;
}

/** GET /api/Route/TaskStatus 单条任务 */
export interface RouteTaskDetailResponse {
  taskSource?: string | null;
  taskId?: string | null;
  taskCode?: string | null;
  taskType?: string | null;
  assetKind?: string | null;
  stageId?: string | null;
  exhibitId?: string | null;
  status?: number | null;
  statusText?: string | null;
  progressPercent?: number | null;
  attemptCount?: number | null;
  maxAttempts?: number | null;
  summary?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  nextRunAt?: string | null;
}

/** GET /api/Route/TaskStatus 汇总 */
export interface RouteTaskSummaryResponse {
  routeId?: string | null;
  taskStatus?: number | null;
  taskStatusText?: string | null;
  executingTaskCount?: number | null;
  assetGenerationTaskCount?: number | null;
  routeBuildTaskCount?: number | null;
  tasks?: RouteTaskDetailResponse[] | null;
}

/**
 * 路线后台任务汇总状态码，与 RouteRecord.taskStatus 同一套取值（后端未在 schema 里给枚举）。
 * 仅用于判断「是否还有任务在跑」，不用于区分具体失败原因。
 */
export const ROUTE_TASK_STATUS = {
  Idle: 0,
  Queued: 1,
  Running: 2,
  Retrying: 3,
} as const;

/** 创建进度里展示的单条子任务；已抹掉 taskId / taskSource 等技术字段 */
export interface RouteBuildTaskItem {
  /** 展示用稳定键：优先 taskId，退化到下标 */
  key: string;
  label: string;
  progressPercent: number | null;
  failed: boolean;
}

/**
 * 右侧结果面板的「创建进度」展示态。
 *
 * 它是 RouteTaskSummaryResponse 的前端归一化结果：后端汇总只给原始计数和子任务数组，
 * 这里统一算好百分比、状态标题和失败原因，组件只负责渲染，避免把状态判断散进模板。
 */
export interface RouteBuildTaskProgress {
  /** 状态标题：后端 taskStatusText 优先，缺失时按 tone 兜底，保证永不为空 */
  title: string;
  /** 状态补充说明（任务条数、失败任务数），无内容为空串 */
  meta: string;
  /** 整体进度 0–100：有子任务取均值，仅排队无进度记 0，无任何任务为 null */
  progressPercent: number | null;
  tone: 'running' | 'completed' | 'failed';
  /** 仍在执行的任务数，为 0 表示本轮创建已收口 */
  executingTaskCount: number;
  routeBuildTaskCount: number;
  assetGenerationTaskCount: number;
  /** 失败原因，取首个失败子任务的 errorMessage；无失败为空串 */
  errorMessage: string;
  tasks: RouteBuildTaskItem[];
  /** 快照时间戳（毫秒），用于展示数据新鲜度 */
  updatedAt: number;
}

export interface RouteRecord {
  sceneType?: number;
  locale?: string;
  sourceRouteId?: string | null;
  routeFamilyCode?: string;
  distanceMeters?: number | null;
  transportMode?: string;
  guideId?: string | null;
  id: string;
  routeCode: string;
  routeType: number;
  museumId: string | null;
  title: string;
  theme: string;
  coverImageUrl: string | null;
  scaleType: number;
  difficultyLevel: number;
  ageGroup: number;
  allowTeam: number;
  minTeamSize: number;
  maxTeamSize: number;
  estimatedMinutes: number | null;
  totalScore: number;
  puzzleCount: number;
  intro: string;
  rewardTitle: string;
  publishStatus: number;
  auditStatus: number;
  auditRemark: string;
  auditRequired: boolean;
  ownerId: string | null;
  ownerName: string;
  canEdit: boolean | null;
  sortOrder: number;
  isGenerating: boolean;
  taskStatus: number | null;
  taskStatusText: string;
  /** 生成进度 0–100；无数据时为 null */
  progressPercent: number | null;
}

export interface RouteAuditPayload {
  id: string;
  pass: boolean;
  remark?: string | null;
}

export interface RouteIdPayload {
  id: string;
}

export interface CreateRouteTranslationPayload {
  routeId: string;
  locale: Exclude<import('@path-seeker/ts-shared').TourLocale, 'zh'>;
  routeCode?: string | null;
}

export interface RouteTranslationResponse {
  routeId: string | null;
  sourceRouteId: string | null;
  routeFamilyCode: string | null;
  locale: string | null;
  stageCount: number;
  reused: boolean;
  translationTaskId?: string | null;
}

export interface BuildOutdoorRouteDraftPayload {
  museumId: string;
  title: string;
  theme?: string | null;
  intro?: string | null;
  placeIds: string[];
  locale: 'zh';
  transportMode: string;
  guideId?: string | null;
  estimatedMinutes?: number | null;
  distanceMeters?: number | null;
}

export interface BuildOutdoorRouteDraftResponse {
  routeId: string | null;
  routeCode: string | null;
  stageCount: number;
  stageIds: string[] | null;
}
