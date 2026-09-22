export type Scene = 'rickshaw' | 'museum'
export type Coordinate = [longitude: number, latitude: number]

export interface LiveLocation {
  coordinate: Coordinate
  accuracy: number
  timestamp: number
}

export interface Destination {
  id: string
  scene: Scene
  name: string
  region: string
  subtitle: string
  status: 'available' | 'comingSoon'
}

export interface CulturalPlace {
  id: string
  scene: Scene
  destinationId: string
  name: string
  subtitle: string
  category: string
  coordinate?: Coordinate
  address: string
  era: string
  duration: number
  accent: string
  artwork: 'bridge' | 'hutong' | 'temple' | 'garden' | 'palace' | 'bronze' | 'porcelain' | 'painting'
  intro: string
  narration: { title: string; text: string }[]
  guideNarrations?: GuideNarration[]
  visitNote: string
}

export interface GuideNarration {
  id: string
  guideName: string
  specialty: string
  title: string
  duration: number
  chapters: { title: string; text: string }[]
}

export interface TourRoute {
  id: string
  scene: Scene
  destinationId: string
  title: string
  subtitle: string
  description: string
  duration: number
  distance: string
  tag: string
  color: string
  stopIds: string[]
  geometry: Coordinate[]
  transportNote: string
  guideName?: string
  coverArtwork?: CulturalPlace['artwork']
}

export interface Catalog {
  destinations: Destination[]
  places: CulturalPlace[]
  routes: TourRoute[]
}

export interface Journey {
  routeId: string
  completedStopIds: string[]
  startedAt: string
}
