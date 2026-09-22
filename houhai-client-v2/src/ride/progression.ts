import type { Coordinate, LiveLocation } from '../types.ts'

export const arrivalPolicy = { radius: 100, maxAccuracy: 65, dwellMs: 1500, maxAgeMs: 15000, releaseRadius: 180 }

export function distanceMeters(origin: Coordinate, target: Coordinate) {
  const latitude = (target[1] - origin[1]) * Math.PI / 180
  const longitude = (target[0] - origin[0]) * Math.PI / 180
  const arc = Math.sin(latitude / 2) ** 2 + Math.cos(origin[1] * Math.PI / 180) * Math.cos(target[1] * Math.PI / 180) * Math.sin(longitude / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)))
}

export function nearbyStop(stops: { coordinate?: Coordinate }[], location: LiveLocation | undefined, after: number, now: number): number | undefined {
  if (!location || !Number.isFinite(location.accuracy) || location.accuracy > arrivalPolicy.maxAccuracy || location.accuracy < 0 || now - location.timestamp > arrivalPolicy.maxAgeMs || location.timestamp > now + 1000) return
  if (!location.coordinate.every(Number.isFinite)) return
  let closest = arrivalPolicy.radius
  let selected: number | undefined
  stops.forEach((stop, index) => {
    if (index <= after || !stop.coordinate) return
    const distance = distanceMeters(location.coordinate, stop.coordinate)
    if (distance < closest) { closest = distance; selected = index }
  })
  return selected
}

export interface JourneyPlayback {
  current: number
  furthest: number
  pending?: number
  status: 'playing' | 'paused' | 'idle'
  manualPause: boolean
  finished: boolean
}
export type JourneyEvent = { type: 'arrive'; index: number } | { type: 'select'; index: number } | { type: 'end' | 'pause' | 'resume' | 'error' | 'discardPending' }

export function transitionJourney(state: JourneyPlayback, event: JourneyEvent): JourneyPlayback {
  switch (event.type) {
    case 'arrive':
      if (event.index <= state.furthest) return state
      if (state.status === 'playing' || state.manualPause) return { ...state, furthest: event.index, pending: event.index }
      return { ...state, current: event.index, furthest: event.index, pending: undefined, status: 'playing', finished: false }
    case 'end':
      if (state.pending !== undefined && !state.manualPause) return { ...state, current: state.pending, pending: undefined, status: 'playing', finished: false }
      return { ...state, status: 'idle', finished: true }
    case 'pause': return { ...state, manualPause: true, status: 'paused' }
    case 'resume':
      if (state.finished && state.pending !== undefined) return { ...state, current: state.pending, pending: undefined, status: 'playing', manualPause: false, finished: false }
      return { ...state, manualPause: false, status: 'playing', finished: false }
    case 'select': return { current: event.index, furthest: Math.max(state.furthest, event.index), pending: undefined, manualPause: false, status: 'playing', finished: false }
    case 'error': return { ...state, status: 'idle', manualPause: true }
    case 'discardPending': return { ...state, pending: undefined }
  }
}

export function scannedRoute(search: string, validIds: string[]) {
  const value = new URLSearchParams(search).get('routeId')
  return { id: value && validIds.includes(value) ? value : undefined, invalid: !!value && !validIds.includes(value) }
}
