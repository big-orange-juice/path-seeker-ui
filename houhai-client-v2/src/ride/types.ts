import type { Coordinate, CulturalPlace, TourRoute } from '../types'

export type Locale = 'zh' | 'en' | 'ru' | 'es'
export interface RideMedia {
  url: string
  credit: string
  source: string
  license: string
}
export interface RideBuilding {
  height: number
  outline: Coordinate[]
}
export interface RideNarrationClip {
  text: string
  audio: string
  durationMs: number
}
export interface RideStop extends CulturalPlace {
  photo?: RideMedia
  video?: { url: string; poster?: string }
  building?: RideBuilding
  narrationAudio?: RideNarrationClip[]
}
export type RideStyle = 'history' | 'family' | 'architecture'
export interface RideRoute extends TourRoute {
  guideName: string
  specialty: string
  styleId: RideStyle
  introduction: string
  stops: RideStop[]
}
export interface RideCatalog {
  locale: Locale
  routes: RideRoute[]
}
