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

export interface RouteRecord {
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
