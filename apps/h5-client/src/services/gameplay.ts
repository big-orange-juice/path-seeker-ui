import { request } from "@/services/http"

/** 路线卡片（对齐 schema RouteCardResponse；列表不保证 intro/rewardTitle） */
export interface RouteCardResponse {
  id?: string | null
  title?: string | null
  theme?: string | null
  coverImageUrl?: string | null
  scaleType?: number
  difficultyLevel?: number
  ageGroup?: number
  allowTeam?: number
  estimatedMinutes?: number | null
  totalScore?: number
  puzzleCount?: number
  persona?: {
    id?: string | null
    personaCode?: string | null
    name?: string | null
    avatarUrl?: string | null
    intro?: string | null
    voiceStyle?: string | null
  } | null
  /** 部分环境/详情嵌套可能附带，列表 schema 不保证 */
  museumId?: string | null
  routeCode?: string | null
  intro?: string | null
  rewardTitle?: string | null
  personaId?: string | null
}

export interface RoutePageQueryRequest {
  pageIndex: number
  pageSize: number
  museumId?: string | null
  scaleType?: number | null
  difficultyLevel?: number | null
  ageGroup?: number | null
  publishStatus?: number | null
  auditStatus?: number | null
  keyword?: string | null
}

export interface RoutePageResult {
  list?: RouteCardResponse[] | null
  pageIndex?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

export interface StoryResponse {
  id?: string | null
  routeId?: string | null
  chapterNo?: number
  title?: string | null
  content?: string | null
  imageUrl?: string | null
  audioUrl?: string | null
  triggerType?: number
  triggerPuzzleId?: string | null
  sortOrder?: number
}

export interface RouteNodeResponse {
  stageId?: string | null
  interactionType?: number
  puzzleId?: string | null
  refPuzzleId?: string | null
  refExhibitId?: string | null
  title?: string | null
  subtitle?: string | null
  puzzleType?: number
  scaleType?: number
  difficultyLevel?: number
  stageNo?: number
  sortOrder?: number
  score?: number
  isRequired?: number
  unlockRule?: number
  config?: string | null
  nextRule?: string | null
  exhibitName?: string | null
  galleryName?: string | null
}

export interface RouteDetailResponse {
  route?: RouteCardResponse | null
  museumId?: string | null
  intro?: string | null
  stories?: StoryResponse[] | null
  nodes?: RouteNodeResponse[] | null
}

export interface StageProtocolResponse {
  interactionType?: number
  interactionCode?: string | null
  componentKey?: string | null
  configSchemaVersion?: string | null
  payloadSchemaVersion?: string | null
  requiredConfigFields?: string[] | null
  requiredPayloadFields?: string[] | null
}

export interface StagePlayResponse {
  stageId?: string | null
  stageNo?: number
  sortOrder?: number
  title?: string | null
  subtitle?: string | null
  interactionType?: number
  refPuzzleId?: string | null
  refExhibitId?: string | null
  unlockRule?: number
  isRequired?: number
  score?: number
  config?: string | null
  nextRule?: string | null
  solved?: boolean
  mySolved?: boolean
  teamSolved?: boolean
  isUnlocked?: boolean
  solvedByUserId?: string | null
  protocol?: StageProtocolResponse | null
  puzzleContent?: string | null
  answerType?: number | null
  answerExtra?: string | null
  /** 合并 Detail.nodes 时回填，Stages 本身通常不含 */
  puzzleId?: string | null
  puzzleType?: number
  scaleType?: number
  difficultyLevel?: number
  exhibitName?: string | null
  galleryName?: string | null
}

export interface JoinRouteResponse {
  routeId?: string | null
  teamId?: string | null
  isTeamMode?: boolean
  progressId?: string | null
  teamProgressId?: string | null
  myStatus?: number
  teamStatus?: number | null
  currentStageId?: string | null
  mySolvedCount?: number
  teamSolvedCount?: number
  totalStageCount?: number
  myTotalScore?: number
  teamTotalScore?: number
  startedAt?: string | null
  teamStartedAt?: string | null
}

export interface RouteStageProgressItemResponse {
  stageId?: string | null
  stageNo?: number
  sortOrder?: number
  title?: string | null
  mySolved?: boolean
  teamSolved?: boolean
  solvedByUserId?: string | null
  solvedByNickname?: string | null
  mySubmittedAt?: string | null
  teamSubmittedAt?: string | null
  lastActivityAt?: string | null
}

/** GET /api/Gameplay/MyRouteProgress */
export interface MyRouteProgressResponse {
  routeId?: string | null
  teamId?: string | null
  isTeamMode?: boolean
  myStatus?: number
  teamStatus?: number | null
  currentStageId?: string | null
  mySolvedCount?: number
  teamSolvedCount?: number
  totalStageCount?: number
  myTotalScore?: number
  teamTotalScore?: number
  myUsedClueCount?: number
  teamUsedClueCount?: number
  lastActivityAt?: string | null
  stages?: RouteStageProgressItemResponse[] | null
}

export interface BadgeResponse {
  id?: string | null
  badgeCode?: string | null
  name?: string | null
  description?: string | null
  iconUrl?: string | null
  iconGrayUrl?: string | null
  rarity?: number
  conditionType?: number
  conditionRouteId?: string | null
  conditionValue?: number
  conditionBadgeIds?: string[] | null
  rewardPoints?: number
  sortOrder?: number
  status?: number
}

export interface CollectibleResponse {
  id?: string | null
  collectibleCode?: string | null
  name?: string | null
  type?: number
  rarity?: number
  iconUrl?: string | null
  iconGrayUrl?: string | null
  description?: string | null
  sourceType?: number
  sourceRouteId?: string | null
  sourcePuzzleId?: string | null
  exhibitId?: string | null
  sortOrder?: number
  status?: number
}

export interface ShareCardResponse {
  nickname?: string | null
  routeTitle?: string | null
  theme?: string | null
  rewardTitle?: string | null
  totalScore?: number
  solvedCount?: number
  puzzleCount?: number
  durationSec?: number | null
  noCluePerfect?: boolean
  completedAt?: string | null
  shareCode?: string | null
}

/** GET /api/Gameplay/RouteResult */
export interface RouteResultResponse {
  routeId?: string | null
  teamId?: string | null
  isTeamMode?: boolean
  routeTitle?: string | null
  theme?: string | null
  rewardTitle?: string | null
  /** 1=进行中 2=已完成 3=已放弃 4=失败 */
  status?: number
  completed?: boolean
  teamCompleted?: boolean
  totalScore?: number
  teamTotalScore?: number
  currentTotalPoints?: number
  solvedCount?: number
  puzzleCount?: number
  usedClueCount?: number
  noCluePerfect?: boolean
  durationSec?: number | null
  startedAt?: string | null
  completedAt?: string | null
  badges?: BadgeResponse[] | null
  collectibles?: CollectibleResponse[] | null
  stages?: RouteStageProgressItemResponse[] | null
  shareCard?: ShareCardResponse | null
}

export interface StageSubmitResponse {
  success?: boolean
  scoreGained?: number
  routeCompleted?: boolean
  teamRouteCompleted?: boolean
  nextStageId?: string | null
  message?: string | null
}

export interface StageHintResponse {
  clueId?: string | null
  stageId?: string | null
  routeId?: string | null
  clueNo?: number
  clueType?: number
  hintLevel?: number
  isHidden?: number
  unlockMode?: number
  unlockValue?: number
  penaltyScore?: number
  sortOrder?: number
  content?: string | null
  mediaUrl?: string | null
  isUnlocked?: boolean
}

export interface UnlockHintResponse {
  success?: boolean
  penaltyScore?: number
  hint?: StageHintResponse | null
  message?: string | null
}

export interface ExhibitMediaResponse {
  id?: string | null
  /** 1=细节图 2=音频 3=短视频 4=360图 */
  mediaType?: number
  mediaUrl?: string | null
  title?: string | null
  sortOrder?: number
  status?: number
}

export interface ExhibitExtraResponse {
  attrKey?: string | null
  attrValue?: string | null
  valueType?: number
  groupName?: string | null
  sortOrder?: number
}

/** GET /api/Exhibit/Get — 主键按 string 透传（雪花 ID） */
export interface ExhibitResponse {
  id?: string | null
  museumId?: string | null
  galleryId?: string | null
  exhibitCode?: string | null
  name?: string | null
  dynasty?: string | null
  material?: string | null
  category?: string | null
  description?: string | null
  imageUrl?: string | null
  qrCode?: string | null
  isHighlight?: number
  showcaseNo?: string | null
  recommendedMinutes?: number | null
  sortOrder?: number
  extraList?: ExhibitExtraResponse[] | null
  mediaList?: ExhibitMediaResponse[] | null
}

export interface RecordRouteActivityRequest {
  routeId: string
  stageId?: string | null
  teamId?: string | null
  activityType: number
  durationSec?: number | null
  clientEventId?: string | null
  extra?: string | null
}

/**
 * 弱行为类型（schema 指向 RouteActivityTypes，公开文档未枚举）。
 * 与后端约定：1 进入节点 / 2 离开节点 / 3 恢复路线。
 */
export const ROUTE_ACTIVITY_TYPE = {
  enterStage: 1,
  leaveStage: 2,
  resumeRoute: 3,
} as const

export function fetchRoutePageList(payload: RoutePageQueryRequest) {
  return request<RoutePageResult>("/api/Route/PageList", {
    method: "POST",
    data: payload,
  })
}

export function fetchRouteDetail(routeId: string) {
  return request<RouteDetailResponse>("/api/Route/Detail", {
    query: {
      id: routeId,
    },
  })
}

export function joinGameplayRoute(routeId: string, teamId?: string | null) {
  return request<JoinRouteResponse>("/api/Gameplay/JoinRoute", {
    method: "POST",
    data: {
      routeId,
      teamId: teamId || null,
      clientEventId: `join-${routeId}-${Date.now()}`,
    },
  })
}

export function fetchGameplayStages(routeId: string, teamId?: string | null) {
  return request<StagePlayResponse[]>("/api/Gameplay/Stages", {
    query: {
      routeId,
      teamId: teamId || undefined,
    },
  })
}

/** 恢复权威源：服务端进度（含各站 solved / 当前站 / 分数） */
export function fetchMyRouteProgress(routeId: string, teamId?: string | null) {
  return request<MyRouteProgressResponse>("/api/Gameplay/MyRouteProgress", {
    query: {
      RouteId: routeId,
      TeamId: teamId || undefined,
    },
  })
}

/** 终局结算：徽章 / 称号 / 分享卡 */
export function fetchRouteResult(routeId: string, teamId?: string | null) {
  return request<RouteResultResponse>("/api/Gameplay/RouteResult", {
    query: {
      RouteId: routeId,
      TeamId: teamId || undefined,
    },
  })
}

/** 弱行为上报（进入/离开节点等，失败可忽略） */
export function recordRouteActivity(payload: RecordRouteActivityRequest) {
  return request<void>("/api/Gameplay/RecordActivity", {
    method: "POST",
    data: {
      routeId: payload.routeId,
      stageId: payload.stageId || null,
      teamId: payload.teamId || null,
      activityType: payload.activityType,
      durationSec: payload.durationSec ?? null,
      clientEventId: payload.clientEventId || null,
      extra: payload.extra || null,
    },
  })
}

export function submitGameplayStage(payload: {
  routeId: string
  stageId: string
  teamId?: string | null
  payload?: string | null
  durationSec?: number | null
}) {
  return request<StageSubmitResponse>("/api/Gameplay/Submit", {
    method: "POST",
    data: {
      routeId: payload.routeId,
      stageId: payload.stageId,
      teamId: payload.teamId || null,
      payload: payload.payload ?? null,
      durationSec: payload.durationSec ?? null,
    },
  })
}

export function fetchStageHints(routeId: string, stageId: string, teamId?: string | null) {
  return request<StageHintResponse[]>("/api/Gameplay/Hints", {
    query: {
      RouteId: routeId,
      StageId: stageId,
      TeamId: teamId || undefined,
    },
  })
}

export function unlockStageHint(payload: {
  routeId: string
  stageId: string
  teamId?: string | null
  clueId: string
  hintId?: string | null
}) {
  return request<UnlockHintResponse>("/api/Gameplay/UnlockHint", {
    method: "POST",
    data: {
      routeId: payload.routeId,
      stageId: payload.stageId,
      teamId: payload.teamId || null,
      clueId: payload.clueId,
      hintId: payload.hintId || null,
    },
  })
}

/** 用 refExhibitId 补位置/短视频；id 按 string 透传 */
export function fetchExhibit(exhibitId: string) {
  return request<ExhibitResponse>("/api/Exhibit/Get", {
    query: {
      id: exhibitId,
    },
  })
}
