export type SceneType = 'outdoor' | 'indoor'
export type PublishStatus = 'draft' | 'pending' | 'published'
/** 内容语言：与 C 端支持的语言一致；B 端界面本身保持中文。 */
export type Locale = 'zh' | 'en' | 'ru' | 'es'
export interface Coordinate { latitude: number; longitude: number }
export interface Narration { id: string; guideId: string; guideName: string; guideStyle: string; title: string; durationSeconds: number; script: string; audioUrl: string | null; status: PublishStatus }
export interface CulturalPlace extends Coordinate { id: string; destinationId: string; code: string; name: string; category: string; address: string; recommendedMinutes: number; description: string; status: PublishStatus; narrations: Narration[] }
export interface IndoorSpace { id: string; destinationId: string; name: string; kind: 'floor' | 'gallery' | 'facility'; parentId: string | null; description: string }
/** 内容：文物或文化点，列表页可新增 / 编辑。 */
export interface CollectionItem {
  id: string; code: string; name: string; destinationId: string
  kind: 'relic' | 'place'; category: string; era: string; material: string
  location: string; recommendedMinutes: number; description: string
  imageUrl: string | null; guideVersions: number; status: PublishStatus
}
export interface Destination extends Coordinate { id: string; code: string; name: string; sceneType: SceneType; address: string; openingHours: string; status: 'enabled' | 'disabled'; mapProvider: 'Amap' | 'OpenStreetMap' | 'Tencent'; coordinateSystem: 'WGS84' | 'GCJ02'; boundaryGeoJson: string | null; intro: string; placeIds: string[]; indoorSpaceIds: string[] }
export interface RouteStop { id: string; placeId: string; arrivalNote: string; transportMode: 'rickshaw' | 'walk' | 'indoor'; stayMinutes: number }
/** 路线自带语言：同一条线路的不同语言是各自独立的路线记录，通过 id 前缀 / 编码后缀关联。 */
export interface TourRoute { id: string; destinationId: string; code: string; name: string; sceneType: SceneType; theme: string; distanceKm: number; estimatedMinutes: number; status: PublishStatus; auditRemark: string; ownerName: string; locale: Locale; stops: RouteStop[]; geometry: Coordinate[] }
export type StageAudioStatus = 'none' | 'queued' | 'ready'
/** 站点分段讲解：与 C 端逐段音频一一对应，一段文稿配一条音频。 */
export interface StageNarrationSegment { id: string; title: string; text: string; audioUrl: string | null; durationSeconds: number }
/** 关联多音字：站点级词条，供讲解音频按标准读音合成。 */
export interface StagePronunciation { id: string; phrase: string; pronunciation: string; note: string }
/** 站点配图：upload 为人工上传，ai 为 AI 生成。 */
export interface StageImage { id: string; url: string; caption: string; source: 'upload' | 'ai' }
/** 路线中的讲解站点（节点），字段对齐 C 端站点讲解所需内容；内容语言跟随所属路线。 */
export interface ArtifactStage {
  id: string; routeId: string; destinationId: string; order: number; name: string; category: string; summary: string
  /** 户外文化点站点指向对应 placeId；室内文物站点为 null。 */
  placeId: string | null
  /** 站点内容语言，与所属路线一致。 */
  locale: Locale
  guideId: string; guideName: string; guideStyle: string
  audioStatus: StageAudioStatus; audioDurationSeconds: number
  segments: StageNarrationSegment[]; pronunciations: StagePronunciation[]; images: StageImage[]
  videoUrl: string | null; status: PublishStatus; updatedAt: string
  /** 非中文站点指向的中文源站点 id；中文站点为 null。 */
  translationOf: string | null
}
export interface DemoDatabase { destinations: Destination[]; places: CulturalPlace[]; indoorSpaces: IndoorSpace[]; routes: TourRoute[]; stages: ArtifactStage[]; collections: CollectionItem[] }
