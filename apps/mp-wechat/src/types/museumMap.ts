export type MuseumFloorId = string

export interface MuseumHallBlock {
  id: string
  label: string
  shortLabel: string
  description: string
  subtitle?: string
  x: number
  y: number
  sortOrder?: number
  accent?: string
  width?: number
  height?: number
  radius?: number
}

export interface MuseumFloorLayout {
  id: MuseumFloorId
  label: string
  summary: string
  axisLabel: string
  mapImageUrl?: string
  floorLevel?: number
  sortOrder?: number
  worldWidth?: number
  worldHeight?: number
  halls: MuseumHallBlock[]
}

export interface FloorResponse {
  id: string | null
  museumId: string | null
  floorCode: string | null
  floorName: string | null
  floorLevel: number
  description: string | null
  mapImageUrl: string | null
  sortOrder: number
}

export interface GalleryResponse {
  id: string | null
  museumId: string | null
  floorId: string | null
  galleryCode: string | null
  name: string | null
  subtitle: string | null
  category: number
  description: string | null
  exhibitCount: number | null
  area: number | null
  coverImageUrl: string | null
  openStatus: number
  x: number | null
  y: number | null
  sortOrder: number
}

export interface GalleryResponseListTotalPageResult<T> {
  list: T[]
  pageIndex: number
  pageSize: number
  total: number
  totalPages: number
}

export interface GalleryQueryPayload {
  pageIndex: number
  pageSize: number
  museumId: string
  floorId?: string | null
  category?: number | null
  openStatus?: number | null
  keyword?: string | null
}
