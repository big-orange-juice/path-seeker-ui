export interface FloorResponse {
  id: string | null;
  museumId: string | null;
  floorCode: string | null;
  floorName: string | null;
  floorLevel: number;
  description: string | null;
  mapImageUrl: string | null;
  sortOrder: number;
}

export interface GalleryPageRequest {
  pageIndex: number;
  pageSize: number;
  museumId?: number | null;
  floorId?: number | null;
  category?: number | null;
  openStatus?: number | null;
  keyword?: string | null;
}

export interface GalleryResponseListTotalPageResult<T> {
  list: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GalleryResponse {
  id: string | null;
  museumId: string | null;
  floorId: string | null;
  galleryCode: string | null;
  name: string | null;
  subtitle: string | null;
  category: number;
  description: string | null;
  exhibitCount: number | null;
  area: number | null;
  coverImageUrl: string | null;
  openStatus: number;
  x: number | null;
  y: number | null;
  sortOrder: number;
}

export interface CreateFloorPayload {
  museumId: number;
  floorCode: string;
  floorName: string | null;
  floorLevel: number;
  description: string | null;
  mapImageUrl: number | null;
  sortOrder: number;
}

export interface UpdateFloorPayload extends CreateFloorPayload {
  id: number;
}

export interface CreateGalleryPayload {
  museumId: number;
  floorId: number | null;
  galleryCode: string;
  name: string;
  subtitle: string | null;
  category: number;
  description: string | null;
  exhibitCount: number | null;
  area: number | null;
  coverImageUrl: number | null;
  openStatus: number;
  x: number | null;
  y: number | null;
  sortOrder: number;
}

export interface UpdateGalleryPayload extends CreateGalleryPayload {
  id: number;
}
