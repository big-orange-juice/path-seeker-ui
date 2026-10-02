import type { TourLocale } from '@path-seeker/ts-shared'

export interface ClientDestination {
  id: string
  scene: string | null
  sceneType: number
  name: string | null
  region: string | null
  subtitle: string | null
  cover: string | null
  longitude: number | null
  latitude: number | null
  coordinateSystem: number
  boundaryGeoJson: string | null
  status: number
}

export interface ClientPlace {
  id: string
  destinationId: string
  name: string | null
  category: string | null
  description: string | null
  cover: string | null
  longitude: number | null
  latitude: number | null
  arrivalNote: string | null
}

export interface ClientTourRoute {
  id: string
  familyCode: string | null
  locale: TourLocale
  scene: string | null
  sceneType: number
  destinationId: string
  title: string | null
  subtitle: string | null
  description: string | null
  cover: string | null
  durationMinutes: number | null
  distanceMeters: number | null
  transportMode: string | null
  guideName: string | null
  guideStyle: string | null
  stopCount: number
  geometry: string | null
  coordinateSystem: number
}

export interface TourNarrationChapter {
  id: string
  order: number
  title: string | null
  text: string | null
  audioUrl: string | null
  durationSeconds: number | null
}

export interface TourGuideNarration {
  id: string
  guideId: string | null
  guideName: string | null
  specialty: string | null
  locale: TourLocale
  title: string | null
  chapters: TourNarrationChapter[] | null
}

export interface ClientTourStop {
  id: string
  placeId: string | null
  exhibitId: string | null
  order: number
  name: string | null
  arrivalNote: string | null
  transportMode: string | null
  stayMinutes: number | null
  longitude: number | null
  latitude: number | null
  images: { id: string; url: string | null; caption: string | null; altText: string | null }[] | null
  video: string | null
  guideNarrations: TourGuideNarration[] | null
}

export interface ClientCatalog {
  destinations: ClientDestination[] | null
  places: ClientPlace[] | null
  routes: ClientTourRoute[] | null
}

export interface ClientTourDetail {
  route: ClientTourRoute | null
  stops: ClientTourStop[] | null
  geometry: string | null
  coordinateSystem: number
}

export interface RouteVisit {
  visitId: string
  routeId: string
  destinationId: string | null
  locale: TourLocale
  status: number
  currentStageId: string | null
  completedStageIds: string[] | null
}
