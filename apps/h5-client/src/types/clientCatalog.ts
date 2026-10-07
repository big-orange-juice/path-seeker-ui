import type { PlaceRange, TourLocale } from '@path-seeker/ts-shared'

export interface ClientDestination {
  id: string
  scene: string | null
  sceneType: number
  name: string | null
  region: string | null
  subtitle: string | null
  cover: string | null
  longitude: number | null
  latitude: number | null
  coordinateSystem: number
  boundaryGeoJson: string | null
  status: number
}

export interface ClientPlace {
  id: string
  destinationId: string
  name: string | null
  category: string | null
  description: string | null
  cover: string | null
  longitude: number | null
  latitude: number | null
  arrivalNote: string | null
  /**
   * 景点本体范围（点类型时后端省略该字段，按经纬度判定）。
   * 几何为 WGS84，绘制前由前端转 GCJ-02；接近判定统一交给 ts-shared 的 evaluateApproach。
   */
  range?: PlaceRange | null
}

export interface ClientTourRoute {
  id: string
  familyCode: string | null
  locale: TourLocale
  scene: string | null
  sceneType: number
  destinationId: string
  title: string | null
  subtitle: string | null
  description: string | null
  cover: string | null
  durationMinutes: number | null
  distanceMeters: number | null
  transportMode: string | null
  guideName: string | null
  guideStyle: string | null
  stopCount: number
  geometry: string | null
  coordinateSystem: number
}

export interface TourNarrationChapter {
  id: string
  order: number
  title: string | null
  text: string | null
  audioUrl: string | null
  durationSeconds: number | null
}

export interface TourGuideNarration {
  id: string
  guideId: string | null
  guideName: string | null
  specialty: string | null
  locale: TourLocale
  title: string | null
  /** 该导游的 TTS 平台音色 ID；为空表示没有可用音色，C 端继续回落（方案 §6.1） */
  providerVoiceId?: string | null
  chapters: TourNarrationChapter[] | null
}

/** 节点额外音频：讲解前/讲解后，同一节点所有导游版本共用 */
export interface ClientStopExtraAudio {
  id: string
  /** 播放位置：before=讲解前 after=讲解后 */
  position: 'before' | 'after'
  /** 同组播放顺序（从 1 开始） */
  order: number
  title: string | null
  url: string | null
  durationSeconds: number | null
}

export interface ClientTourStop {
  triggerRadiusMeters?: number | null
  id: string
  placeId: string | null
  exhibitId: string | null
  order: number
  name: string | null
  arrivalNote: string | null
  transportMode: string | null
  stayMinutes: number | null
  longitude: number | null
  latitude: number | null
  images: { id: string; url: string | null; caption: string | null; altText: string | null }[] | null
  video: string | null
  guideNarrations: TourGuideNarration[] | null
  /** 播放队列：before extra audio[] → narration chapter[] → after extra audio[] */
  extraAudios?: ClientStopExtraAudio[] | null
}

export interface ClientCatalog {
  destinations: ClientDestination[] | null
  places: ClientPlace[] | null
  routes: ClientTourRoute[] | null
}

export interface ClientTourDetail {
  route: ClientTourRoute | null
  stops: ClientTourStop[] | null
  geometry: string | null
  coordinateSystem: number
}

export interface RouteVisit {
  visitId: string
  routeId: string
  destinationId: string | null
  locale: TourLocale
  status: number
  currentStageId: string | null
  completedStageIds: string[] | null
}
