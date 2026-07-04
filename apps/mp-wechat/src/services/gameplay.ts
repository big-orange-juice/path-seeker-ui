import { request } from "@/services/http"

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
  } | null
}

export interface StoryResponse {
  id?: string | null
  title?: string | null
  content?: string | null
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

export interface StagePlayResponse extends RouteNodeResponse {
  stageId?: string | null
  interactionType?: number
  refPuzzleId?: string | null
  refExhibitId?: string | null
  solved?: boolean
  mySolved?: boolean
  teamSolved?: boolean
  solvedByUserId?: string | null
  protocol?: StageProtocolResponse | null
  puzzleContent?: string | null
  answerType?: number | null
  answerExtra?: string | null
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
