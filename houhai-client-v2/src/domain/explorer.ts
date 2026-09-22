import type { Catalog, Journey, TourRoute } from '../types.ts'

export function routesForPlace(routes: TourRoute[], placeId: string): TourRoute[] {
  return routes.filter(route => route.stopIds.includes(placeId))
}

export function preferredRoute(routes: TourRoute[], placeId: string, currentRouteId: string): TourRoute | undefined {
  const related = routesForPlace(routes, placeId)
  return related.find(route => route.id === currentRouteId) ?? related[0]
}

export function completeStop(journey: Journey, route: TourRoute, placeId: string): Journey {
  const nextStop = route.stopIds.find(stopId => !journey.completedStopIds.includes(stopId))
  if (journey.routeId !== route.id || nextStop !== placeId) return journey
  return { ...journey, completedStopIds: [...journey.completedStopIds, placeId] }
}

export function restoreProgress(raw: string | null, catalog: Catalog): { favorites: string[]; journeys: Journey[] } {
  const empty = { favorites: [], journeys: [] }
  if (!raw) return empty
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return empty
    const saved = value as Record<string, unknown>
    const favorites = Array.isArray(saved.favorites) ? [...new Set(saved.favorites.filter((id): id is string => typeof id === 'string' && catalog.places.some(place => place.id === id)))] : []
    const journeys: Journey[] = []
    if (Array.isArray(saved.journeys)) {
      for (const candidate of saved.journeys) {
        if (!candidate || typeof candidate !== 'object') continue
        const route = catalog.routes.find(item => item.id === candidate.routeId)
        if (!route || journeys.some(item => item.routeId === route.id) || !Array.isArray(candidate.completedStopIds) || typeof candidate.startedAt !== 'string' || !Number.isFinite(Date.parse(candidate.startedAt))) continue
        const completedStopIds: string[] = []
        for (const stopId of route.stopIds) {
          if (!candidate.completedStopIds.includes(stopId)) break
          completedStopIds.push(stopId)
        }
        journeys.push({ routeId: route.id, completedStopIds, startedAt: candidate.startedAt })
      }
    }
    return { favorites, journeys }
  } catch {
    return empty
  }
}
