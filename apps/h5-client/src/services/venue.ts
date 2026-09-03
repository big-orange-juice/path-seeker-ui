import { request } from '@/services/http'
import type { VenueSummary } from '@path-seeker/ts-shared'

interface VenuePageResult {
  list?: VenueSummary[] | null
}

export async function fetchVenues() {
  const response = await request<VenuePageResult>('/Museum/PageList', {
    method: 'POST',
    data: { pageIndex: 1, pageSize: 100, status: 1 },
  })
  return response.list ?? []
}

export function fetchVenue(id: string) {
  return request<VenueSummary>('/Museum/Get', { query: { id } })
}
