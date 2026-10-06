export interface CulturalPlaceRecord {
  extraList?: CulturalPlaceExtra[];
  archive?: CulturalPlaceArchive | null;
  id: string;
  museumId: string;
  code: string;
  name: string;
  category: string | null;
  address: string | null;
  description: string | null;
  recommendedMinutes: number | null;
  longitude: number | null;
  latitude: number | null;
  coordinateSystem: number;
  status: number;
  coverAttachmentId: string | null;
  coverUrl: string | null;
  sortOrder: number;
  /** 景点本体范围：1=点 2=圆 3=多边形（可空，历史数据为点语义） */
  rangeType?: number;
  /** 圆形范围半径（米） */
  rangeRadiusMeters?: number | null;
  /** 多边形范围 GeoJSON（按 coordinateSystem 存储） */
  boundaryGeoJson?: string | null;
  /** 归属景区区域 ID；"0" 表示不关联 */
  siteAreaId?: string;
  /** 范围外接近阈值（米）；空表示跟随全局默认 */
  proximityDistanceMeters?: number | null;
  /** 解除接近阈值（米） */
  releaseDistanceMeters?: number | null;
  /** 范围版本：范围变化时 +1，供 C 端缓存与判定一致性校验 */
  rangeVersion?: number;
  /** 全局默认接近阈值（米） */
  defaultProximityDistanceMeters?: number | null;
  /** 全局默认解除阈值（米） */
  defaultReleaseDistanceMeters?: number | null;
  /** 目的地边界 GeoJSON（WGS84），用于前端判断范围是否越界 */
  destinationBoundaryGeoJson?: string | null;
  /** 归属片区边界 GeoJSON（WGS84），用于「复制片区边界」 */
  siteAreaBoundaryGeoJson?: string | null;
}

export type CulturalPlaceDraft = Omit<CulturalPlaceRecord, 'id' | 'coverUrl'> & { id?: string };

export interface CulturalPlaceExtra {
  attrKey: string;
  attrValue: string | null;
  valueType: number;
  groupName: string | null;
  sortOrder: number;
}

export interface CulturalPlaceArchive {
  formalName?: string | null;
  era?: string | null;
  establishedText?: string | null;
  historicalEvolution?: string | null;
  backgroundStories?: string | null;
  culturalContext?: string | null;
  architecturalFeatures?: string | null;
  keyPersonTimeline?: string | null;
  coreMemoryPoints?: string | null;
  culturalSignificance?: string | null;
  currentFunction?: string | null;
  protectionLevel?: string | null;
  visitingTips?: string | null;
  referenceSources?: string | null;
  influenceLevel?: number;
  relationshipClues?: string | null;
  aiRawResponse?: string | null;
  aiModel?: string | null;
  generationStatus?: number;
  errorMessage?: string | null;
}
