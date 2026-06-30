export interface VenueDraft {
  id: string;
  galleryCode: string;
  name: string;
  subtitle: string;
  category: number;
  description: string;
  exhibitCount: number | null;
  area: number | null;
  coverImageUrl: string | null;
  coverImageFileId: string | null;
  openStatus: number;
  x: number | null;
  y: number | null;
  sortOrder: number;
}

export interface FloorMapDraft {
  id?: string;
  floorNumber: string;
  floorName: string;
  floorLevel: number;
  description: string;
  mapImages: string[];
  mapImageFileId: string | null;
  sortOrder: number;
  venues: VenueDraft[];
}

export interface FloorMapRecord extends FloorMapDraft {
  id: string;
  includedVenueNames: string[];
}
