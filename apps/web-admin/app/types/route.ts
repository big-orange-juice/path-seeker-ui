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
  sortOrder: number;
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
  sortOrder: number;
}
