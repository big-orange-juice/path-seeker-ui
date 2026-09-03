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

export interface OutdoorRouteStation { id: string; stageId: string | null; assetId: string | null; stationNo: number; title: string; longitude: number; latitude: number; triggerRadiusMeters: number | null }
export interface OutdoorRouteMapResponse { routeId: string; museumId: string; title: string; coordinateSystem: CoordinateSystem; geometryGeoJson: string | null; geometryStatus: "ready" | "station_only" | "unavailable"; geometryVersion: number; distanceMeters: number | null; estimatedMinutes: number | null; confirmed: boolean; stations: OutdoorRouteStation[] }

export interface VenueSummary {
  id: string
  museumCode: string
  name: string
  address: string | null
  openingHours: string | null
  closedDay: string | null
  reservationInfo: string | null
  officialWebsite: string | null
  contactPhone: string | null
  longitude: number | null
  latitude: number | null
  intro: string | null
  coverImageUrl: string | null
  status: number
  venueType: number
  coordinateSystem: CoordinateSystem
  mapProvider: number | null
  boundaryGeoJson: string | null
}
