import { request } from '@/services/http'
import type { TourLocale } from '@path-seeker/ts-shared'
import type { ClientCatalog, ClientTourDetail, RouteVisit } from '@/types/clientCatalog'

export function fetchClientCatalog(destinationId: string, locale: TourLocale) {
  return request<ClientCatalog>('/ClientCatalog/Catalog', {
    method: 'POST', data: { destinationId, locale, scene: 'rickshaw' },
  })
}

export function fetchClientTour(routeId: string, locale: TourLocale) {
  return request<ClientTourDetail>('/ClientCatalog/Route', { query: { routeId, locale } })
}

export function startRouteVisit(routeId: string, locale: TourLocale) {
  return request<RouteVisit>('/RouteVisit/Start', { method: 'POST', data: { routeId, locale } })
}

/** 查询该路线上进行中的游览记录；没有进行中记录时后端返回 null（方案 §5.3 游览恢复） */
export function fetchActiveRouteVisit(routeId: string) {
  return request<RouteVisit | null>('/RouteVisit/Active', { query: { routeId } })
}

export function updateRouteVisitStop(visit: RouteVisit, stageId: string, action: 'start' | 'complete', completionSource = 1) {
  return request<RouteVisit>('/RouteVisit/UpdateStop', {
    method: 'POST', data: { routeId: visit.routeId, visitId: visit.visitId, stageId, action, completionSource },
  })
}

export function abandonRouteVisit(visit: RouteVisit) {
  return request<RouteVisit>('/RouteVisit/Abandon', {
    method: 'POST', data: { routeId: visit.routeId, visitId: visit.visitId },
  })
}
