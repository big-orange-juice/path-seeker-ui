import type { ClientTourStop } from '@/types/clientCatalog'

export const TOUR_ARRIVAL_POLICY = { radius: 100, releaseRadius: 180, maxAccuracy: 65, dwellMs: 1500, maxAgeMs: 15000 }

export function tourDistanceMeters(origin: { longitude: number; latitude: number }, target: { longitude: number; latitude: number }) {
  const latitude = (target.latitude - origin.latitude) * Math.PI / 180
  const longitude = (target.longitude - origin.longitude) * Math.PI / 180
  const arc = Math.sin(latitude / 2) ** 2 + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(target.latitude * Math.PI / 180) * Math.sin(longitude / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)))
}

export function nearbyTourStop(stops: ClientTourStop[], location: { longitude: number; latitude: number; accuracy: number; timestamp: number }, after: number, now: number) {
  if (![location.longitude, location.latitude, location.accuracy, location.timestamp].every(Number.isFinite)
    || location.accuracy < 0 || location.accuracy > TOUR_ARRIVAL_POLICY.maxAccuracy
    || now - location.timestamp > TOUR_ARRIVAL_POLICY.maxAgeMs || location.timestamp > now + 1000) return -1
  let closest = TOUR_ARRIVAL_POLICY.radius
  let selected = -1
  stops.forEach((stop, index) => {
    if (index <= after || stop.longitude == null || stop.latitude == null) return
    const distance = tourDistanceMeters(location, { longitude: stop.longitude, latitude: stop.latitude })
    if (distance < closest) { closest = distance; selected = index }
  })
  return selected
}
