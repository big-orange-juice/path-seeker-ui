export interface RoutePageRequest {
  pageIndex: number;
  pageSize: number;
  museumId?: string | null;
  scaleType?: number | null;
  difficultyLevel?: number | null;
  ageGroup?: number | null;
  publishStatus?: number | null;
  auditStatus?: number | null;
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
  /** 当前操作者是否可以编辑该路线 */
  canEdit?: boolean | null;
  sortOrder: number;
  isGenerating?: boolean | null;
}

export interface RouteRecord {
  id: string;
  routeCode: string;
  routeType: number;
  museumId: string | null;
  title: string;
  theme: string;
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
  canEdit: boolean | null;
  sortOrder: number;
  isGenerating: boolean;
}

export interface RouteAuditPayload {
  id: string;
  pass: boolean;
  remark?: string | null;
}

export interface RouteIdPayload {
  id: string;
}
