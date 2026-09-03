import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { VenueSummary } from '@path-seeker/ts-shared'
import { fetchVenue, fetchVenues } from '@/services/venue'

export const useVenueStore = defineStore('venues', () => {
  const venues = shallowRef<VenueSummary[]>([])
  const current = shallowRef<VenueSummary | null>(null)
  const pending = shallowRef(false)
  const error = shallowRef('')
  let requestVersion = 0

  async function loadAll() {
    const version = ++requestVersion
    pending.value = true; error.value = ''
    try { const list = await fetchVenues(); if (version === requestVersion) venues.value = list }
    catch (caught) { if (version === requestVersion) error.value = caught instanceof Error ? caught.message : '地点加载失败' }
    finally { if (version === requestVersion) pending.value = false }
  }

  async function loadOne(id: string) {
    const venueId = String(id || '').trim()
    if (!venueId) return null
    const cached = venues.value.find(item => item.id === venueId)
    if (cached) { current.value = cached; return cached }
    const version = ++requestVersion
    pending.value = true; error.value = ''
    try { const venue = await fetchVenue(venueId); if (version === requestVersion) current.value = venue; return venue }
    catch (caught) { if (version === requestVersion) error.value = caught instanceof Error ? caught.message : '地点详情加载失败'; return null }
    finally { if (version === requestVersion) pending.value = false }
  }

  return { venues, current, pending, error, loadAll, loadOne }
})
