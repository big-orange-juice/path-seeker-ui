import { computed, reactive, ref } from 'vue'
import { mockDatabase } from '../data/mock'
import type { ArtifactStage, CollectionItem, CulturalPlace, Destination, Narration, TourRoute } from '../types'
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
    notify('景点资料已保存到 Mock 状态')
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
  /** 对话创建：新路线与站点内容一并写入演示数据，状态为草稿，继续走审核上架流程。 */
  const createRoute = (route: TourRoute, stages: ArtifactStage[] = []) => {
    database.routes.unshift(cloneValue(route))
    stages.forEach(stage => database.stages.push(cloneValue(stage)))
    notify(`已创建路线《${route.name}》，共 ${route.stops.length} 个站点`)
  }
  const saveStage = (draft: ArtifactStage) => {
    const index = database.stages.findIndex(item => item.id === draft.id)
    if (index >= 0) database.stages[index] = cloneValue(draft)
    else database.stages.push(cloneValue(draft))
    notify('站点内容已保存，将同步到 C 端讲解')
  }
  const removeStage = (stageId: string) => {
    const index = database.stages.findIndex(item => item.id === stageId)
    if (index < 0) return
    database.stages.splice(index, 1)
    notify('站点已从路线中移除')
  }
  const saveCollection = (draft: CollectionItem) => {
    const index = database.collections.findIndex(item => item.id === draft.id)
    if (index >= 0) database.collections[index] = cloneValue(draft)
    else database.collections.unshift(cloneValue(draft))
    notify(index >= 0 ? '内容已更新' : '内容已新增')
  }
  const removeCollection = (id: string) => {
    const index = database.collections.findIndex(item => item.id === id)
    if (index < 0) return
    database.collections.splice(index, 1)
    notify('内容已删除')
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
    createRoute,
    saveStage,
    removeStage,
    saveCollection,
    removeCollection,
    setRouteStatus,
    notify,
  }
}
