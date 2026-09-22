import { computed, reactive, ref } from 'vue'
import { mockDatabase } from '../data/mock'
import type { CulturalPlace, Destination, Narration, TourRoute } from '../types'
import { cloneValue } from '../utils'

const database = reactive(cloneValue(mockDatabase))
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

export function useDemoAdmin() {
  const saveDestination = (draft: Destination) => {
    const index = database.destinations.findIndex(item => item.id === draft.id)
    if (index >= 0) database.destinations[index] = cloneValue(draft)
    notify('博物馆资料已保存到 Mock 状态')
  }
  const savePlace = (draft: CulturalPlace) => {
    const index = database.places.findIndex(item => item.id === draft.id)
    if (index >= 0) database.places[index] = cloneValue(draft)
    notify('文化点与讲解版本已保存')
  }
  const saveNarration = (placeId: string, draft: Narration) => {
    const place = database.places.find(item => item.id === placeId)
    if (!place) return
    const index = place.narrations.findIndex(item => item.id === draft.id)
    if (index >= 0) place.narrations[index] = cloneValue(draft)
    else place.narrations.push({ ...cloneValue(draft), id: `${placeId}-${Date.now()}` })
    notify('导游讲解版本已保存')
  }
  const saveRoute = (draft: TourRoute) => {
    const index = database.routes.findIndex(item => item.id === draft.id)
    if (index >= 0) database.routes[index] = cloneValue(draft)
    notify('路线编排已保存')
  }
  const setRouteStatus = (routeId: string, status: TourRoute['status']) => {
    const route = database.routes.find(item => item.id === routeId)
    if (route) route.status = status
    notify(status === 'published' ? '路线已上架' : status === 'pending' ? '路线已提交审核' : '路线已转为草稿')
  }
  return {
    database,
    toast,
    enabledDestinations: computed(() => database.destinations.filter(item => item.status === 'enabled')),
    saveDestination,
    savePlace,
    saveNarration,
    saveRoute,
    setRouteStatus,
    notify,
  }
}
