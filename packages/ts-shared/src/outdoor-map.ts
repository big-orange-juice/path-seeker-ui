import type { CoordinateSystem, GeoLocation } from "./geo"

export interface SiteAreaResponse {
  id: string
  museumId: string
  parentAreaId: string | null
  areaCode: string
  name: string
  areaType: number
  description: string | null
  boundaryGeoJson: string | null
  centerLongitude: number | null
  centerLatitude: number | null
  assetCount: number
  sortOrder: number
}

export interface OutdoorMapMuseum {
  id: string
  name: string
  venueType: number
  longitude: number | null
  latitude: number | null
  coordinateSystem: CoordinateSystem
  mapProvider: number | null
  boundaryGeoJson: string | null
}

export interface OutdoorMapAsset {
  id: string
  assetType: number
  name: string
  description: string | null
  imageUrl: string | null
  siteAreaId: string | null
  primaryLocation: GeoLocation | null
}

export interface OutdoorMapSceneResponse {
  museum: OutdoorMapMuseum | null
  areas: SiteAreaResponse[]
  assets: OutdoorMapAsset[]
}
