import type { CulturalPlace, TourRoute } from '../types'

export type Locale = 'zh' | 'en' | 'ru' | 'es'
export interface RideMedia {
  url: string
  credit: string
  source: string
  license: string
}
export interface RideStop extends CulturalPlace {
  photo?: RideMedia
  video?: { url: string; poster?: string }
}
export interface RideRoute extends TourRoute {
  guideName: string
  specialty: string
  introduction: string
  stops: RideStop[]
}
export interface RideCatalog {
  locale: Locale
  routes: RideRoute[]
}
