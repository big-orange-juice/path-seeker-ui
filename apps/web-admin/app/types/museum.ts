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
  museumId?: string | null;
  floorId?: string | null;
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
  museumId: string;
  floorCode: string;
  floorName: string | null;
  floorLevel: number;
  description: string | null;
  mapImageUrl: string | null;
  sortOrder: number;
}

export interface UpdateFloorPayload extends CreateFloorPayload {
  id: string;
}

export interface CreateGalleryPayload {
  museumId: string;
  floorId: string | null;
  galleryCode: string;
  name: string;
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

export interface UpdateGalleryPayload extends CreateGalleryPayload {
  id: string;
}

export interface FacilityResponse {
  id: string | null;
  museumId: string | null;
  floorId: string | null;
  name: string | null;
  facilityType: number;
  locationDesc: string | null;
  iconUrl: string | null;
  sortOrder: number;
}

export interface CreateFacilityPayload {
  museumId: string;
  floorId: string | null;
  name: string;
  facilityType: number;
  locationDesc: string | null;
  iconUrl: string | null;
  sortOrder: number;
}

export interface UpdateFacilityPayload extends CreateFacilityPayload {
  id: string;
}

export interface MuseumPageRequest {
  pageIndex: number;
  pageSize: number;
  keyword?: string | null;
  status?: number | null;
}

export interface MuseumResponseListTotalPageResult<T> {
  list: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MuseumResponse {
  id: string | null;
  museumCode: string | null;
  name: string | null;
  address: string | null;
  openingHours: string | null;
  closedDay: string | null;
  reservationInfo: string | null;
  officialWebsite: string | null;
  wechatAccount: string | null;
  contactPhone: string | null;
  longitude: number | null;
  latitude: number | null;
  landArea: number | null;
  buildingArea: number | null;
  exhibitionArea: number | null;
  floorsAbove: number | null;
  floorsBelow: number | null;
  intro: string | null;
  coverImageUrl: string | null;
  status: number;
}

export interface CreateMuseumPayload {
  museumCode: string;
  name: string;
  address: string | null;
  openingHours: string | null;
  closedDay: string | null;
  reservationInfo: string | null;
  officialWebsite: string | null;
  wechatAccount: string | null;
  contactPhone: string | null;
  longitude: number | null;
  latitude: number | null;
  landArea: number | null;
  buildingArea: number | null;
  exhibitionArea: number | null;
  floorsAbove: number | null;
  floorsBelow: number | null;
  intro: string | null;
  coverImageUrl: string | null;
  status: number;
}

export interface UpdateMuseumPayload extends CreateMuseumPayload {
  id: string;
}

export interface MuseumRecord {
  id: string;
  museumCode: string;
  name: string;
  address: string;
  openingHours: string;
  closedDay: string;
  reservationInfo: string;
  officialWebsite: string;
  wechatAccount: string;
  contactPhone: string;
  longitude: number | null;
  latitude: number | null;
  landArea: number | null;
  buildingArea: number | null;
  exhibitionArea: number | null;
  floorsAbove: number | null;
  floorsBelow: number | null;
  intro: string;
  coverImageUrl: string | null;
  coverImageFileId: string | null;
  status: number;
}

export interface MuseumDraft {
  id?: string;
  museumCode: string;
  name: string;
  address: string;
  openingHours: string;
  closedDay: string;
  reservationInfo: string;
  officialWebsite: string;
  wechatAccount: string;
  contactPhone: string;
  longitude: number | null;
  latitude: number | null;
  landArea: number | null;
  buildingArea: number | null;
  exhibitionArea: number | null;
  floorsAbove: number | null;
  floorsBelow: number | null;
  intro: string;
  coverImageUrl: string | null;
  coverImageFileId: string | null;
  status: number;
}

export interface MuseumFloorDraft {
  id?: string;
  floorNumber: string;
  floorName: string;
  floorLevel: number;
  description: string;
  mapImages: string[];
  mapImageFileId: string | null;
  sortOrder: number;
}

export interface MuseumFloorRecord extends MuseumFloorDraft {
  id: string;
}

export interface MuseumGalleryDraft {
  id?: string;
  floorId: string | null;
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

export interface MuseumGalleryRecord extends MuseumGalleryDraft {
  id: string;
  museumId: string;
  floorName: string;
}

export interface MuseumFacilityDraft {
  id?: string;
  floorId: string | null;
  name: string;
  facilityType: number;
  locationDesc: string;
  iconUrl: string | null;
  iconFileId: string | null;
  sortOrder: number;
}

export interface MuseumFacilityRecord extends MuseumFacilityDraft {
  id: string;
  museumId: string;
  floorName: string;
}
