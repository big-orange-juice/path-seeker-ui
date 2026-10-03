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
