export interface CulturalPlaceRecord {
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
